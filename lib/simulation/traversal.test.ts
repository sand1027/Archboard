import { describe, it, expect } from 'vitest'
import type { ArchitectureEdge } from '@/types/diagram'
import {
  MAX_FANOUT,
  buildGraph,
  hasOutgoing,
  nextHops,
  readDataString,
  suggestStartNode,
  type Graph,
} from './traversal'

function edge(id: string, source: string, target: string, connectionType?: string): ArchitectureEdge {
  return {
    id,
    source,
    target,
    type: 'architecture',
    data: connectionType ? { connectionType } : {},
  } as ArchitectureEdge
}

/**
 * The shape that exposed the bug: one request arrives at the server, which fans out
 * to a queue, a cache and a database.
 */
const FAN_OUT: ArchitectureEdge[] = [
  edge('e1', 'client', 'lb'),
  edge('e2', 'lb', 'server'),
  edge('e3', 'server', 'queue'),
  edge('e4', 'server', 'redis'),
  edge('e5', 'server', 'db'),
]

describe('readDataString', () => {
  it('reads a string field', () => {
    expect(readDataString({ protocol: 'HTTPS' }, 'protocol')).toBe('HTTPS')
  })

  it('returns undefined for missing, non-string or non-object input', () => {
    expect(readDataString({}, 'protocol')).toBeUndefined()
    expect(readDataString({ protocol: 42 }, 'protocol')).toBeUndefined()
    expect(readDataString(null, 'protocol')).toBeUndefined()
    expect(readDataString('nope', 'protocol')).toBeUndefined()
  })
})

describe('buildGraph', () => {
  it('links each edge from its source', () => {
    const graph = buildGraph(FAN_OUT)
    expect(graph.get('client')).toEqual([{ edgeId: 'e1', targetId: 'lb' }])
    expect(graph.get('server')).toEqual([
      { edgeId: 'e3', targetId: 'queue' },
      { edgeId: 'e4', targetId: 'redis' },
      { edgeId: 'e5', targetId: 'db' },
    ])
  })

  // Direction is the whole point: a queue with no outgoing edge really is the end
  // of the flow, and the animation should say so.
  it('leaves a sink with no outgoing hops', () => {
    const graph = buildGraph(FAN_OUT)
    expect(graph.get('queue')).toBeUndefined()
    expect(hasOutgoing(graph, 'queue')).toBe(false)
    expect(hasOutgoing(graph, 'server')).toBe(true)
  })

  it('makes a bidirectional edge traversable both ways', () => {
    const graph = buildGraph([edge('e1', 'a', 'b', 'bidirectional')])
    expect(graph.get('a')).toEqual([{ edgeId: 'e1', targetId: 'b' }])
    expect(graph.get('b')).toEqual([{ edgeId: 'e1', targetId: 'a' }])
  })

  it('keeps parallel edges between the same pair separate', () => {
    const graph = buildGraph([edge('e1', 'a', 'b'), edge('e2', 'a', 'b')])
    expect(graph.get('a')).toHaveLength(2)
  })
})

describe('nextHops', () => {
  const graph = buildGraph(FAN_OUT)

  /**
   * The regression. Previously a request took one pre-computed path, so only one of
   * these three downstreams was ever animated.
   */
  it('returns every downstream of a fan-out node', () => {
    const hops = nextHops(graph, 'server', ['client', 'lb', 'server'])
    expect(hops.map((h) => h.targetId).sort()).toEqual(['db', 'queue', 'redis'])
  })

  it('reports the end of the flow as no hops', () => {
    expect(nextHops(graph, 'queue', ['client', 'lb', 'server', 'queue'])).toEqual([])
  })

  it('skips nodes the branch already visited, so a cycle terminates', () => {
    const cyclic = buildGraph([edge('e1', 'a', 'b'), edge('e2', 'b', 'a')])
    expect(nextHops(cyclic, 'b', ['a', 'b'])).toEqual([])
  })

  it('does not bounce a bidirectional edge straight back', () => {
    const bidi = buildGraph([edge('e1', 'a', 'b', 'bidirectional')])
    expect(nextHops(bidi, 'b', ['a', 'b'])).toEqual([])
  })

  it('stops at the depth limit', () => {
    const trail = Array.from({ length: 12 }, (_, i) => `n${i}`)
    expect(nextHops(graph, 'server', trail, 12)).toEqual([])
    expect(nextHops(graph, 'server', trail.slice(0, 11), 12)).not.toEqual([])
  })

  it('caps fan-out so a hub node cannot flood the canvas', () => {
    const hub: ArchitectureEdge[] = Array.from({ length: MAX_FANOUT + 5 }, (_, i) =>
      edge(`e${i}`, 'hub', `leaf${i}`)
    )
    expect(nextHops(buildGraph(hub), 'hub', ['hub'])).toHaveLength(MAX_FANOUT)
  })

  it('returns nothing for an unknown node', () => {
    expect(nextHops(graph, 'ghost', ['ghost'])).toEqual([])
  })
})

describe('whole-graph coverage', () => {
  /**
   * Walking the fan-out must reach every reachable node from a single request,
   * which is what the user is looking for: the queue, the cache and the database
   * all light up, not just one of them.
   */
  it('reaches every reachable node from one starting request', () => {
    const graph: Graph = buildGraph(FAN_OUT)
    const seen = new Set<string>()
    const queue: { node: string; trail: string[] }[] = [{ node: 'client', trail: ['client'] }]

    while (queue.length > 0) {
      const { node, trail } = queue.shift()!
      seen.add(node)
      for (const hop of nextHops(graph, node, trail)) {
        queue.push({ node: hop.targetId, trail: [...trail, hop.targetId] })
      }
    }

    expect([...seen].sort()).toEqual(['client', 'db', 'lb', 'queue', 'redis', 'server'])
  })
})

describe('suggestStartNode', () => {
  const ids = ['db', 'queue', 'redis', 'server', 'lb', 'client']

  // Starting halfway down leaves everything upstream dark, which looks identical
  // to the fan-out bug from the user's side.
  it('picks the entry point regardless of node ordering', () => {
    expect(suggestStartNode(buildGraph(FAN_OUT), ids)).toBe('client')
  })

  it('prefers the busiest entry point when there are several', () => {
    const graph = buildGraph([
      edge('e1', 'lonely', 'server'),
      edge('e2', 'gateway', 'server'),
      edge('e3', 'gateway', 'cache'),
    ])
    expect(suggestStartNode(graph, ['lonely', 'gateway', 'server', 'cache'])).toBe('gateway')
  })

  // A ring has no node without inbound edges, but any of them can still start.
  it('falls back to a connected node when every node has an inbound edge', () => {
    const ring = buildGraph([edge('e1', 'a', 'b'), edge('e2', 'b', 'c'), edge('e3', 'c', 'a')])
    expect(['a', 'b', 'c']).toContain(suggestStartNode(ring, ['a', 'b', 'c']))
  })

  it('falls back to the first node when nothing is connected', () => {
    expect(suggestStartNode(new Map(), ['solo', 'other'])).toBe('solo')
  })

  it('returns undefined for an empty diagram', () => {
    expect(suggestStartNode(new Map(), [])).toBeUndefined()
  })

  it('never suggests a sink over a source', () => {
    const graph = buildGraph(FAN_OUT)
    const picked = suggestStartNode(graph, ids)
    expect(picked).toBeDefined()
    expect(hasOutgoing(graph, picked!)).toBe(true)
  })
})
