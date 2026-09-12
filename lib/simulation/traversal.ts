import type { ArchitectureEdge } from '@/types/diagram'

/**
 * Graph traversal for the simulation.
 *
 * A request is modelled as a branching walk, not a single line. The engine used to
 * pre-enumerate every simple path from the start node, sort them longest-first, and
 * send one request down `paths[0]`. On a realistic diagram that meant exactly one
 * route was ever animated: a server that fans out to a cache, a database and a
 * message queue showed only whichever branch happened to sit on the longest path,
 * and every other connection stayed dark for the whole run.
 *
 * Fanning out at each node is also the more faithful model. A request reaching an
 * application server really does hit several downstreams, so lighting them up
 * together is what the diagram is trying to say.
 */

/** One traversable step out of a node. */
export interface Hop {
  edgeId: string
  targetId: string
}

/** Adjacency list: node id → the hops leaving it. */
export type Graph = Map<string, Hop[]>

/** How many nodes deep a single branch may go before it is cut off. */
export const MAX_TRAIL = 12

/**
 * How many downstreams a single node may fan out to.
 *
 * A guard against a hub node with dozens of edges turning one request into a
 * flood that buries the canvas.
 */
export const MAX_FANOUT = 8

/**
 * Ceiling on packets in flight across the whole run.
 *
 * Branching is multiplicative: the cycle guard keeps each branch to a simple path,
 * but a densely connected diagram still has a great many of those, and every one is
 * a dot to advance and draw each frame. Past this point extra branches add load
 * without adding information.
 */
export const MAX_LIVE_PACKETS = 150

/** Read a string field off a React Flow `data` bag without asserting its shape. */
export function readDataString(data: unknown, key: string): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const value = (data as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

/**
 * Adjacency list for the diagram.
 *
 * Edges are directed, which is what makes the animation meaningful: a queue with
 * no outgoing edge is genuinely the end of the flow. An edge marked bidirectional
 * is traversable both ways.
 */
export function buildGraph(edges: ArchitectureEdge[]): Graph {
  const graph: Graph = new Map()

  const link = (from: string, hop: Hop) => {
    const existing = graph.get(from)
    if (existing) existing.push(hop)
    else graph.set(from, [hop])
  }

  for (const edge of edges) {
    link(edge.source, { edgeId: edge.id, targetId: edge.target })
    if (readDataString(edge.data, 'connectionType') === 'bidirectional') {
      link(edge.target, { edgeId: edge.id, targetId: edge.source })
    }
  }

  return graph
}

/**
 * Every hop a branch should take on from `from`.
 *
 * `trail` is the branch's own history and must include `from`; anything already in
 * it is skipped, which keeps a cycle from looping forever and stops a bidirectional
 * edge from bouncing a packet back where it came from.
 *
 * An empty result means this branch has reached the end of the flow.
 */
export function nextHops(
  graph: Graph,
  from: string,
  trail: readonly string[],
  maxDepth: number = MAX_TRAIL
): Hop[] {
  if (trail.length >= maxDepth) return []

  const hops = graph.get(from)
  if (!hops || hops.length === 0) return []

  const onward: Hop[] = []
  for (const hop of hops) {
    if (trail.includes(hop.targetId)) continue
    onward.push(hop)
    if (onward.length >= MAX_FANOUT) break
  }
  return onward
}

/** Whether a request starting here has anywhere to go. */
export function hasOutgoing(graph: Graph, nodeId: string): boolean {
  return (graph.get(nodeId)?.length ?? 0) > 0
}

/**
 * The most sensible node to start a run from.
 *
 * Defaulting to "whichever node happens to be first in the array" is a second,
 * independent way to end up with most of the diagram sitting dark: start halfway
 * down and everything upstream never runs, start on a sink and nothing runs at all.
 *
 * A node with outgoing edges and no incoming ones is an entry point — the browser
 * or client in almost every architecture drawing — so prefer those, and among them
 * the busiest, which is the one that reaches the most of the diagram.
 */
export function suggestStartNode(graph: Graph, nodeIds: string[]): string | undefined {
  if (nodeIds.length === 0) return undefined

  const inbound = new Set<string>()
  for (const hops of graph.values()) {
    for (const hop of hops) inbound.add(hop.targetId)
  }

  const outDegree = (id: string) => graph.get(id)?.length ?? 0
  const busiest = (ids: string[]) =>
    ids.reduce((best, id) => (outDegree(id) > outDegree(best) ? id : best), ids[0])

  const connected = nodeIds.filter((id) => outDegree(id) > 0)
  if (connected.length === 0) return nodeIds[0]

  const sources = connected.filter((id) => !inbound.has(id))
  return busiest(sources.length > 0 ? sources : connected)
}
