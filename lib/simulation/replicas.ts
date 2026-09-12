import type { Graph } from './traversal'

/**
 * Replica failover.
 *
 * `isPrimary`, `isReplica` and `replicaOf` have been on ArchitectureNodeData all along
 * and were read by nothing. Without them, marking a primary database down just kills
 * every branch that reaches it, which answers "what breaks" but not the question worth
 * asking of a diagram that has replicas at all: does the redundancy work.
 *
 * Failover needs somewhere to go, so a candidate must be reachable in one hop from the
 * same place the failed attempt came from. That is how redundancy is normally drawn — a
 * balancer or service wired to both the primary and its replicas — and it means the
 * retry can animate along an edge the user actually drew rather than teleporting.
 */

export interface ReplicaSet {
  /** Node id → the ids that can stand in for it. */
  standbys: Map<string, string[]>
}

export const EMPTY_REPLICAS: ReplicaSet = { standbys: new Map() }

export interface ReplicaCandidate {
  id: string
  data?: Record<string, unknown>
}

function readString(data: unknown, key: string): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const value = (data as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

/**
 * Group nodes into replica sets, then record every peer as a standby for every member.
 *
 * A set is a primary plus everything pointing at it through `replicaOf`. Peers are
 * mutual: a replica can cover for its primary, the primary can cover for a replica, and
 * two replicas of the same primary can cover for each other. Modelling it as a set
 * rather than a direction avoids special-casing which member happened to fail.
 */
export function buildReplicaSets(nodes: ReplicaCandidate[]): ReplicaSet {
  const setsByPrimary = new Map<string, Set<string>>()

  for (const node of nodes) {
    const primaryId = readString(node.data, 'replicaOf')
    if (!primaryId) continue

    const existing = setsByPrimary.get(primaryId)
    if (existing) existing.add(node.id)
    else setsByPrimary.set(primaryId, new Set([node.id]))
  }

  const known = new Set(nodes.map((n) => n.id))
  const standbys = new Map<string, string[]>()

  for (const [primaryId, replicas] of setsByPrimary) {
    // A replicaOf pointing at something that is no longer on the canvas still describes
    // a valid set between the remaining replicas.
    const group = [...(known.has(primaryId) ? [primaryId] : []), ...replicas]
    if (group.length < 2) continue

    for (const member of group) {
      standbys.set(
        member,
        group.filter((other) => other !== member)
      )
    }
  }

  return { standbys }
}

/**
 * Where a failed request at `failedId` should be retried.
 *
 * Requires a healthy standby wired to the same caller. Returns the edge to take as well
 * as the node, so the retry is a real hop on the diagram.
 */
export function findFailover(
  replicas: ReplicaSet,
  graph: Graph,
  options: {
    /** The node that just failed. */
    failedId: string
    /** Where the failed attempt came from. */
    fromId: string
    /** Nodes known to be unavailable, including the one that just failed. */
    unavailable: ReadonlySet<string>
    /** Nodes this branch has already visited. */
    trail: readonly string[]
  }
): { nodeId: string; edgeId: string } | null {
  const { failedId, fromId, unavailable, trail } = options

  const candidates = replicas.standbys.get(failedId)
  if (!candidates || candidates.length === 0) return null

  const hops = graph.get(fromId)
  if (!hops) return null

  for (const candidate of candidates) {
    if (candidate === failedId) continue
    if (unavailable.has(candidate)) continue
    // Retrying into a node this branch already passed through would loop.
    if (trail.includes(candidate)) continue

    const hop = hops.find((h) => h.targetId === candidate)
    if (hop) return { nodeId: candidate, edgeId: hop.edgeId }
  }

  return null
}

export function hasStandby(replicas: ReplicaSet, nodeId: string): boolean {
  return (replicas.standbys.get(nodeId)?.length ?? 0) > 0
}
