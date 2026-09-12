import { describe, it, expect } from 'vitest'
import type { ArchitectureEdge } from '@/types/diagram'
import { buildGraph, type Graph } from './traversal'
import {
  buildGroups,
  expandGraphForGroups,
  groupEntryPoints,
  groupExitPoints,
  groupLeaves,
  groupMembers,
  groupStarters,
  isGroup,
  startNodeOptionLabel,
  suggestGroupAwareStart,
  type GroupCandidate,
} from './groups'
import { suggestStartNode } from './traversal'

function box(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  type = 'architecture'
): GroupCandidate {
  return { id, type, position: { x, y }, width: w, height: h }
}

function frame(id: string, x: number, y: number, w: number, h: number): GroupCandidate {
  return box(id, x, y, w, h, 'frame')
}

function edge(id: string, source: string, target: string): ArchitectureEdge {
  return { id, source, target, type: 'architecture', data: {} } as ArchitectureEdge
}

/**
 * The shape from the user's diagram: a Client frame holding a browser and a mobile app,
 * both calling a load balancer, which fans into a datacenter frame whose server talks
 * to a cache and a database.
 */
const NODES: GroupCandidate[] = [
  frame('client', 0, 0, 200, 100),
  box('web', 10, 20, 60, 50),
  box('mobile', 110, 20, 60, 50),
  box('lb', 60, 200, 60, 50),
  frame('dc', 0, 300, 300, 200),
  box('server', 20, 320, 60, 50),
  box('redis', 20, 420, 60, 50),
  box('db', 150, 420, 60, 50),
  // Outside every frame.
  box('mongo', 500, 600, 60, 50),
]

const EDGES: ArchitectureEdge[] = [
  edge('e-web-lb', 'web', 'lb'),
  edge('e-mob-lb', 'mobile', 'lb'),
  edge('e-lb-server', 'lb', 'server'),
  edge('e-server-redis', 'server', 'redis'),
  edge('e-server-db', 'server', 'db'),
]

describe('buildGroups', () => {
  it('collects the nodes whose centre falls inside each container', () => {
    const groups = buildGroups(NODES)
    expect(groupMembers(groups, 'client').sort()).toEqual(['mobile', 'web'])
    expect(groupMembers(groups, 'dc').sort()).toEqual(['db', 'redis', 'server'])
  })

  it('leaves nodes outside every container ungrouped', () => {
    const groups = buildGroups(NODES)
    expect(groups.parentOf.has('mongo')).toBe(false)
    expect(groups.parentOf.has('lb')).toBe(false)
    expect(isGroup(groups, 'mongo')).toBe(false)
  })

  it('reports containers with contents as groups', () => {
    const groups = buildGroups(NODES)
    expect(isGroup(groups, 'client')).toBe(true)
    expect(isGroup(groups, 'web')).toBe(false)
  })

  it('treats an empty frame as not a group', () => {
    const groups = buildGroups([frame('empty', 900, 900, 100, 100)])
    expect(isGroup(groups, 'empty')).toBe(false)
  })

  /**
   * Nesting has to resolve to the innermost container, or a rack's servers would be
   * claimed by the datacenter around it and the hierarchy would flatten.
   */
  it('assigns a node to the smallest container enclosing it', () => {
    const nested = [
      frame('outer', 0, 0, 400, 400),
      frame('inner', 10, 10, 100, 100),
      box('server', 20, 20, 40, 40),
    ]
    const groups = buildGroups(nested)
    expect(groups.parentOf.get('server')).toBe('inner')
    expect(groups.parentOf.get('inner')).toBe('outer')
    expect(groupMembers(groups, 'outer')).toEqual(['inner'])
  })

  it('returns empty maps when there are no containers', () => {
    const groups = buildGroups([box('a', 0, 0, 10, 10), box('b', 20, 20, 10, 10)])
    expect(groups.members.size).toBe(0)
    expect(groups.parentOf.size).toBe(0)
  })
})

/**
 * The user's real layout: a datacenter frame whose direct members are two *more*
 * frames — one holding the services, one holding the datastores. Traffic arrives at the
 * outer frame, so resolution has to reach through both levels to the server.
 */
const NESTED_NODES: GroupCandidate[] = [
  frame('dc', 0, 0, 400, 400),
  frame('services', 10, 10, 180, 180),
  box('server', 20, 20, 50, 40),
  box('worker', 100, 20, 50, 40),
  box('mq', 20, 100, 50, 40),
  frame('stores', 10, 210, 180, 180),
  box('pg', 20, 220, 50, 40),
  box('redis', 100, 220, 50, 40),
  box('lb', 600, 0, 50, 40),
]

const NESTED_EDGES: ArchitectureEdge[] = [
  edge('e-lb-dc', 'lb', 'dc'),
  edge('e-server-mq', 'server', 'mq'),
  edge('e-mq-worker', 'mq', 'worker'),
  edge('e-server-pg', 'server', 'pg'),
  edge('e-server-redis', 'server', 'redis'),
]

describe('nested containers', () => {
  const groups = buildGroups(NESTED_NODES)
  const graph = buildGraph(NESTED_EDGES)

  it('records the inner frames as the outer frame’s direct members', () => {
    expect(groupMembers(groups, 'dc').sort()).toEqual(['services', 'stores'])
  })

  it('flattens to real components, however deep', () => {
    expect(groupLeaves(groups, 'dc').sort()).toEqual([
      'mq',
      'pg',
      'redis',
      'server',
      'worker',
    ])
  })

  /**
   * The regression. Entry points used to be direct members, so an edge into the
   * datacenter delivered to a *frame*, which has no outgoing edges — the packet arrived
   * and the branch died, so nothing inside ran.
   */
  it('resolves the front door through both levels to the server', () => {
    expect(groupEntryPoints(groups, graph, 'dc')).toEqual(['server'])
  })

  it('never leaves a container as a hop source or target', () => {
    const expanded = expandGraphForGroups(graph, groups)
    for (const [source, hops] of expanded) {
      expect(groups.containers.has(source)).toBe(false)
      for (const hop of hops) {
        expect(groups.containers.has(hop.targetId)).toBe(false)
      }
    }
  })

  it('routes the inbound edge to the server so the inner flow can run', () => {
    const expanded = expandGraphForGroups(graph, groups)
    expect(expanded.get('lb')).toEqual([{ edgeId: 'e-lb-dc', targetId: 'server' }])
    // And the server can still reach everything it feeds.
    expect((expanded.get('server') ?? []).map((h) => h.targetId).sort()).toEqual([
      'mq',
      'pg',
      'redis',
    ])
  })

  it('starts a nested group at its server', () => {
    expect(groupStarters(groups, graph, 'dc')).toEqual(['server'])
  })

  // A datastore fed from a different sub-frame must not count as a front door, or
  // traffic would bypass the service that owns it.
  it('does not treat a store in a sibling frame as an entry point', () => {
    expect(groupEntryPoints(groups, graph, 'dc')).not.toContain('pg')
    expect(groupEntryPoints(groups, graph, 'dc')).not.toContain('redis')
  })
})

describe('empty containers', () => {
  const nodes = [frame('outer', 0, 0, 300, 300), frame('hollow', 10, 10, 50, 50), box('lb', 600, 0, 40, 40)]
  const groups = buildGroups(nodes)

  it('knows a frame is a container even with nothing in it', () => {
    expect(groups.containers.has('hollow')).toBe(true)
    expect(isGroup(groups, 'hollow')).toBe(false)
  })

  // Resolving to nothing is right: an empty frame has no component to deliver to. The
  // hop must not survive pointing at the frame itself.
  it('drops an edge aimed at an empty container', () => {
    const graph = buildGraph([edge('e', 'lb', 'hollow')])
    const expanded = expandGraphForGroups(graph, groups)
    expect(expanded.get('lb') ?? []).toEqual([])
  })
})

describe('groupEntryPoints', () => {
  const groups = buildGroups(NODES)
  const graph = buildGraph(EDGES)

  // The front door. Arriving at a datacenter means reaching its server, not its cache
  // and database at the same time — those are reached through the server.
  it('is the member nothing else inside the group feeds', () => {
    expect(groupEntryPoints(groups, graph, 'dc')).toEqual(['server'])
  })

  it('is every member when none of them feed each other', () => {
    expect(groupEntryPoints(groups, graph, 'client').sort()).toEqual(['mobile', 'web'])
  })

  it('falls back to all members when the group is internally cyclic', () => {
    const cyclic = buildGraph([edge('e1', 'a', 'b'), edge('e2', 'b', 'a')])
    const g = buildGroups([frame('ring', 0, 0, 200, 200), box('a', 10, 10, 40, 40), box('b', 100, 10, 40, 40)])
    expect(groupEntryPoints(g, cyclic, 'ring').sort()).toEqual(['a', 'b'])
  })

  it('is empty for something that is not a group', () => {
    expect(groupEntryPoints(groups, graph, 'lb')).toEqual([])
  })
})

describe('groupExitPoints', () => {
  const groups = buildGroups(NODES)
  const graph = buildGraph(EDGES)

  it('is the members that talk to something outside the group', () => {
    expect(groupExitPoints(groups, graph, 'client').sort()).toEqual(['mobile', 'web'])
  })

  it('falls back to all members when nothing inside talks outward', () => {
    // The datacenter is a sink: server feeds redis and db, none of them leave.
    expect(groupExitPoints(groups, graph, 'dc').sort()).toEqual(['db', 'redis', 'server'])
  })
})

describe('groupStarters', () => {
  const groups = buildGroups(NODES)
  const graph = buildGraph(EDGES)

  /**
   * The feature request: selecting Client should fire the browser *and* the mobile app,
   * not whichever one happened to be found first.
   */
  it('starts a run from every front-door member with somewhere to go', () => {
    expect(groupStarters(groups, graph, 'client').sort()).toEqual(['mobile', 'web'])
  })

  it('starts a datacenter run at its server rather than its stores', () => {
    expect(groupStarters(groups, graph, 'dc')).toEqual(['server'])
  })

  it('is empty for a group whose members have no outgoing edges', () => {
    const isolated = buildGroups([frame('f', 0, 0, 200, 200), box('x', 10, 10, 40, 40)])
    expect(groupStarters(isolated, new Map(), 'f')).toEqual([])
  })
})

describe('expandGraphForGroups', () => {
  const groups = buildGroups(NODES)

  it('leaves a graph untouched when there are no groups', () => {
    const graph = buildGraph(EDGES)
    expect(expandGraphForGroups(graph, buildGroups([]))).toBe(graph)
  })

  it('keeps hops between plain nodes as they were', () => {
    const expanded = expandGraphForGroups(buildGraph(EDGES), groups)
    expect(expanded.get('web')).toEqual([{ edgeId: 'e-web-lb', targetId: 'lb' }])
  })

  // An edge drawn to the frame itself should reach the front door, and keep the edge id
  // so the packet still animates along the line the user drew.
  it('redirects an edge aimed at a container to its entry point', () => {
    const withGroupEdge = [...EDGES, edge('e-lb-dc', 'lb', 'dc')]
    const graph = buildGraph(withGroupEdge)
    const expanded = expandGraphForGroups(graph, groups)

    expect(expanded.get('lb')).toEqual([
      { edgeId: 'e-lb-server', targetId: 'server' },
      { edgeId: 'e-lb-dc', targetId: 'server' },
    ])
  })

  it('re-attaches an edge drawn from a container to its outward-facing members', () => {
    const withGroupEdge = [edge('e-client-lb', 'client', 'lb')]
    const graph = buildGraph(withGroupEdge)
    const expanded = expandGraphForGroups(graph, groups)

    expect(expanded.get('client')).toBeUndefined()
    // Neither member talks outward in this graph, so both stand in for the group.
    expect(expanded.get('web')).toEqual([{ edgeId: 'e-client-lb', targetId: 'lb' }])
    expect(expanded.get('mobile')).toEqual([{ edgeId: 'e-client-lb', targetId: 'lb' }])
  })

  it('drops a rewrite that would point a member at itself', () => {
    // An edge from the frame to something inside it: web -> web after resolution.
    const graph = buildGraph([edge('e-client-web', 'client', 'web')])
    const expanded = expandGraphForGroups(graph, groups)
    expect(expanded.get('web') ?? []).toEqual([])
  })

  it('never leaves a container as the source or target of a hop', () => {
    const withGroupEdges = [...EDGES, edge('e-lb-dc', 'lb', 'dc'), edge('e-client-lb', 'client', 'lb')]
    const expanded: Graph = expandGraphForGroups(buildGraph(withGroupEdges), groups)

    for (const [source, hops] of expanded) {
      expect(isGroup(groups, source)).toBe(false)
      for (const hop of hops) {
        expect(isGroup(groups, hop.targetId)).toBe(false)
      }
    }
  })
})

describe('suggestGroupAwareStart', () => {
  const groups = buildGroups(NODES)
  const graph = buildGraph(EDGES)
  const ids = NODES.map((n) => n.id)

  /**
   * Without promotion the default picks one of the two client apps and the other never
   * runs, which is the thing that made grouping feel broken.
   */
  it('promotes a suggestion to the group that encloses it', () => {
    expect(suggestGroupAwareStart(groups, graph, ids, suggestStartNode)).toBe('client')
  })

  it('leaves an ungrouped suggestion alone', () => {
    const flat = [box('a', 0, 0, 40, 40), box('b', 200, 0, 40, 40)]
    const flatGraph = buildGraph([edge('e', 'a', 'b')])
    expect(
      suggestGroupAwareStart(buildGroups(flat), flatGraph, ['a', 'b'], suggestStartNode)
    ).toBe('a')
  })

  // Promotion must not quietly move the start somewhere else: if the group would begin
  // at a different member, keep the node that was actually chosen.
  it('does not promote when the group would start elsewhere', () => {
    expect(suggestGroupAwareStart(groups, graph, ['redis', 'db'], suggestStartNode)).not.toBe(
      'dc'
    )
  })

  it('returns undefined for an empty diagram', () => {
    expect(suggestGroupAwareStart(groups, graph, [], suggestStartNode)).toBeUndefined()
  })
})

describe('startNodeOptionLabel', () => {
  const groups = buildGroups(NODES)

  it('marks a group with its component count', () => {
    expect(startNodeOptionLabel(groups, 'client', 'Client')).toBe('Client — group of 2')
  })

  it('leaves a plain component unchanged', () => {
    expect(startNodeOptionLabel(groups, 'lb', 'Load Balancer')).toBe('Load Balancer')
  })

  // Counts what is really inside, not the two sub-frames holding it.
  it('counts through nested frames', () => {
    const nested = buildGroups(NESTED_NODES)
    expect(startNodeOptionLabel(nested, 'dc', 'Data Center')).toBe('Data Center — group of 5')
  })
})
