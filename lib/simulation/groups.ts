import {
  centerInside,
  isContainerNode,
  nodeBounds,
  type MeasurableNode,
} from '@/lib/canvas/geometry'
import type { Graph, Hop } from './traversal'

/**
 * Containers as simulation participants.
 *
 * A diagram groups things visually: a Client frame holding a web browser and a mobile
 * app, a datacenter frame holding a server, a queue, a cache and a database. Those
 * frames were invisible to the engine — a frame carries no edges of its own, so
 * selecting one as the start node found no outgoing hops and the run did nothing.
 *
 * Membership is not stored anywhere. It is geometric, and already defined: group-drag
 * decides what moves with a frame using isContainerNode plus centerInside. Reusing
 * that same rule means grouping needs no new data, no migration, and matches what the
 * user sees on the canvas — if it looks inside the box, it is inside the box.
 */

export interface GroupCandidate extends MeasurableNode {
  id: string
  type?: string
  data?: Record<string, unknown>
}

export interface GroupMap {
  /** Container id → the ids directly inside it. */
  members: Map<string, string[]>
  /** Node id → the smallest container enclosing it. */
  parentOf: Map<string, string>
  /**
   * Everything that can hold other nodes, whether or not it currently does.
   *
   * Needed to tell a container apart from a component: an empty frame has no members,
   * so membership alone cannot say whether a node is a real thing traffic can reach.
   */
  containers: Set<string>
}

export const EMPTY_GROUPS: GroupMap = {
  members: new Map(),
  parentOf: new Map(),
  containers: new Set(),
}

/**
 * Work out what sits inside what.
 *
 * A node can fall inside several nested containers — a server inside a rack group
 * inside a datacenter frame — so the smallest enclosing one wins. Anything else would
 * make a nested group's members belong to the outermost frame and collapse the
 * hierarchy.
 */
export function buildGroups(nodes: GroupCandidate[]): GroupMap {
  const containerNodes = nodes.filter(isContainerNode)
  const containers = new Set(containerNodes.map((c) => c.id))
  if (containerNodes.length === 0) {
    return { members: new Map(), parentOf: new Map(), containers }
  }

  const members = new Map<string, string[]>()
  const parentOf = new Map<string, string>()

  for (const node of nodes) {
    let bestId: string | undefined
    let bestArea = Infinity

    for (const container of containerNodes) {
      if (container.id === node.id) continue
      const box = nodeBounds(container)
      if (!centerInside(node, box)) continue

      const area = box.w * box.h
      if (area < bestArea) {
        bestArea = area
        bestId = container.id
      }
    }

    if (!bestId) continue
    parentOf.set(node.id, bestId)
    const list = members.get(bestId)
    if (list) list.push(node.id)
    else members.set(bestId, [node.id])
  }

  return { members, parentOf, containers }
}

export function isGroup(groups: GroupMap, id: string): boolean {
  return (groups.members.get(id)?.length ?? 0) > 0
}

export function groupMembers(groups: GroupMap, id: string): string[] {
  return groups.members.get(id) ?? []
}

/**
 * Every real component inside a container, however deeply nested.
 *
 * Resolution has to reach actual components. A datacenter frame's direct members are
 * often other frames — one holding the services, another the datastores — and a frame
 * has no edges of its own, so stopping at the first level handed traffic to something
 * that could not forward it and the flow died on arrival.
 */
export function groupLeaves(groups: GroupMap, id: string): string[] {
  const leaves: string[] = []
  const seen = new Set<string>([id])

  const walk = (containerId: string) => {
    for (const member of groupMembers(groups, containerId)) {
      if (seen.has(member)) continue
      seen.add(member)

      if (groups.containers.has(member)) walk(member)
      else leaves.push(member)
    }
  }

  walk(id)
  return leaves
}

/** target id → the nodes that can reach it in one hop. */
function inboundMap(graph: Graph): Map<string, string[]> {
  const inbound = new Map<string, string[]>()
  for (const [source, hops] of graph) {
    for (const hop of hops) {
      const list = inbound.get(hop.targetId)
      if (list) list.push(source)
      else inbound.set(hop.targetId, [source])
    }
  }
  return inbound
}

/**
 * The members traffic should be handed to when it arrives at a group.
 *
 * The front door: members that nothing else inside the group feeds. Delivering to a
 * datacenter frame means the request reaches its server, not its database and cache
 * simultaneously — those are reached through the server, which is what the internal
 * edges say.
 *
 * A group whose members all feed each other has no front door, so everything in it is
 * treated as reachable rather than nothing being reachable.
 */
export function groupEntryPoints(groups: GroupMap, graph: Graph, id: string): string[] {
  const leaves = groupLeaves(groups, id)
  if (leaves.length === 0) return []

  // Judged against everything in the group, not just immediate siblings. A datastore
  // in a sub-frame is fed by a service in a different sub-frame, so a sibling-only
  // test would call it a front door and let traffic bypass the service entirely.
  const inside = new Set(leaves)
  const inbound = inboundMap(graph)

  const entries = leaves.filter(
    (leaf) => !(inbound.get(leaf) ?? []).some((source) => inside.has(source))
  )
  return entries.length > 0 ? entries : leaves
}

/**
 * The members an edge leaving the group should originate from.
 *
 * Mirror of the entry rule: whichever members actually talk to something outside.
 */
export function groupExitPoints(groups: GroupMap, graph: Graph, id: string): string[] {
  const leaves = groupLeaves(groups, id)
  if (leaves.length === 0) return []

  const inside = new Set(leaves)
  const exits = leaves.filter((leaf) =>
    (graph.get(leaf) ?? []).some(
      (hop) => !inside.has(hop.targetId) && hop.targetId !== id
    )
  )
  return exits.length > 0 ? exits : leaves
}

/**
 * Where a run starting at a group should begin.
 *
 * Every front-door member that has somewhere to go. Selecting Client fires both the
 * web browser and the mobile app, since neither feeds the other and both call out —
 * which is the whole point of being able to pick the group.
 *
 * Falling back to any member with outgoing edges keeps a group usable when its
 * internal wiring has no clear front door.
 */
export function groupStarters(groups: GroupMap, graph: Graph, id: string): string[] {
  const hasOut = (m: string) => (graph.get(m)?.length ?? 0) > 0

  const entries = groupEntryPoints(groups, graph, id).filter(hasOut)
  if (entries.length > 0) return entries

  return groupLeaves(groups, id).filter(hasOut)
}

/**
 * Rewrite the graph so no hop begins or ends on a container.
 *
 * Group handling lives here rather than in nextHops: traversal stays a plain graph
 * walk, and every caller — fan-out, cycle guard, node stats, capacity — keeps dealing
 * only in real components. Hops keep their original edge id, so a packet still
 * animates along the line actually drawn on the canvas.
 */
export function expandGraphForGroups(graph: Graph, groups: GroupMap): Graph {
  if (groups.containers.size === 0) return graph

  const expanded: Graph = new Map()
  const push = (from: string, hop: Hop) => {
    const list = expanded.get(from)
    if (list) list.push(hop)
    else expanded.set(from, [hop])
  }

  // Keyed off containerness rather than "has members", so an empty frame is resolved
  // away to nothing instead of being left in the graph as a dead end.
  const resolveTargets = (targetId: string): string[] =>
    groups.containers.has(targetId) ? groupEntryPoints(groups, graph, targetId) : [targetId]

  for (const [source, hops] of graph) {
    // An edge drawn from a container belongs to the members that talk outward.
    const sources = groups.containers.has(source)
      ? groupExitPoints(groups, graph, source)
      : [source]

    for (const hop of hops) {
      for (const target of resolveTargets(hop.targetId)) {
        for (const from of sources) {
          // A rewrite can point a member at itself — an edge from a frame to something
          // inside it, say. That is not a hop.
          if (from === target) continue
          push(from, { edgeId: hop.edgeId, targetId: target })
        }
      }
    }
  }

  return expanded
}

/**
 * Group-aware default start node.
 *
 * The plain suggestion picks a single component, so on a diagram whose entry point is a
 * Client frame holding two apps it would fire one of them and leave the other dark.
 * Promoting the choice to the enclosing group makes the default run exercise both,
 * which is what the frame is expressing.
 *
 * Only promotes when starting from the group would actually include the node that was
 * picked, so a member buried behind its siblings is never silently swapped for a
 * different entry point.
 */
export function suggestGroupAwareStart(
  groups: GroupMap,
  graph: Graph,
  nodeIds: string[],
  suggestPlain: (graph: Graph, nodeIds: string[]) => string | undefined
): string | undefined {
  const base = suggestPlain(graph, nodeIds)
  if (!base) return undefined

  const parent = groups.parentOf.get(base)
  if (!parent || !isGroup(groups, parent)) return base

  return groupStarters(groups, graph, parent).includes(base) ? parent : base
}

/**
 * How a node should read in a start-node picker.
 *
 * Counts real components rather than direct members, so a datacenter frame holding two
 * sub-frames reads as the five things actually in it rather than as "group of 2".
 */
export function startNodeOptionLabel(
  groups: GroupMap,
  id: string,
  label: string
): string {
  const count = groupLeaves(groups, id).length
  return count > 0 ? `${label} — group of ${count}` : label
}
