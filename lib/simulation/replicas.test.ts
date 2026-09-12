import { describe, it, expect } from 'vitest'
import type { ArchitectureEdge } from '@/types/diagram'
import { buildGraph } from './traversal'
import {
  buildReplicaSets,
  findFailover,
  hasStandby,
  type ReplicaCandidate,
} from './replicas'

function node(id: string, data: Record<string, unknown> = {}): ReplicaCandidate {
  return { id, data }
}

function edge(id: string, source: string, target: string): ArchitectureEdge {
  return { id, source, target, type: 'architecture', data: {} } as ArchitectureEdge
}

/** A service wired to a primary and two read replicas — how redundancy is usually drawn. */
const NODES: ReplicaCandidate[] = [
  node('server'),
  node('pg-primary', { isPrimary: true }),
  node('pg-replica-1', { isReplica: true, replicaOf: 'pg-primary' }),
  node('pg-replica-2', { isReplica: true, replicaOf: 'pg-primary' }),
  node('redis'),
]

const EDGES: ArchitectureEdge[] = [
  edge('e-primary', 'server', 'pg-primary'),
  edge('e-r1', 'server', 'pg-replica-1'),
  edge('e-r2', 'server', 'pg-replica-2'),
  edge('e-redis', 'server', 'redis'),
]

describe('buildReplicaSets', () => {
  it('makes every member of a set a standby for the others', () => {
    const { standbys } = buildReplicaSets(NODES)
    expect(standbys.get('pg-primary')?.sort()).toEqual(['pg-replica-1', 'pg-replica-2'])
    // Mutual: the primary can cover for a replica too.
    expect(standbys.get('pg-replica-1')?.sort()).toEqual(['pg-primary', 'pg-replica-2'])
  })

  it('leaves unrelated nodes without standbys', () => {
    const replicas = buildReplicaSets(NODES)
    expect(hasStandby(replicas, 'redis')).toBe(false)
    expect(hasStandby(replicas, 'server')).toBe(false)
    expect(hasStandby(replicas, 'pg-primary')).toBe(true)
  })

  it('ignores a set of one', () => {
    const replicas = buildReplicaSets([node('a'), node('b', { replicaOf: 'missing-and-alone' })])
    expect(replicas.standbys.size).toBe(0)
  })

  // A primary deleted from the canvas still leaves its replicas able to cover each other.
  it('keeps a set alive when the primary is gone', () => {
    const replicas = buildReplicaSets([
      node('r1', { replicaOf: 'deleted' }),
      node('r2', { replicaOf: 'deleted' }),
    ])
    expect(replicas.standbys.get('r1')).toEqual(['r2'])
  })

  it('returns nothing for a diagram with no replicas', () => {
    expect(buildReplicaSets([node('a'), node('b')]).standbys.size).toBe(0)
  })
})

describe('findFailover', () => {
  const replicas = buildReplicaSets(NODES)
  const graph = buildGraph(EDGES)

  /** The point of the feature: a downed primary should be covered by a replica. */
  it('retries a downed primary against a replica on a real edge', () => {
    const result = findFailover(replicas, graph, {
      failedId: 'pg-primary',
      fromId: 'server',
      unavailable: new Set(['pg-primary']),
      trail: ['server', 'pg-primary'],
    })
    expect(result).toEqual({ nodeId: 'pg-replica-1', edgeId: 'e-r1' })
  })

  it('skips standbys that are also down', () => {
    const result = findFailover(replicas, graph, {
      failedId: 'pg-primary',
      fromId: 'server',
      unavailable: new Set(['pg-primary', 'pg-replica-1']),
      trail: ['server', 'pg-primary'],
    })
    expect(result).toEqual({ nodeId: 'pg-replica-2', edgeId: 'e-r2' })
  })

  it('gives up when the whole set is down', () => {
    expect(
      findFailover(replicas, graph, {
        failedId: 'pg-primary',
        fromId: 'server',
        unavailable: new Set(['pg-primary', 'pg-replica-1', 'pg-replica-2']),
        trail: ['server', 'pg-primary'],
      })
    ).toBeNull()
  })

  it('has nothing to offer a node without replicas', () => {
    expect(
      findFailover(replicas, graph, {
        failedId: 'redis',
        fromId: 'server',
        unavailable: new Set(['redis']),
        trail: ['server', 'redis'],
      })
    ).toBeNull()
  })

  /**
   * Failover has to animate along an edge that exists. A replica the caller is not wired
   * to is not a route, however related it is in the data.
   */
  it('will not fail over to a replica the caller cannot reach', () => {
    const unwired = buildGraph([edge('e-primary', 'server', 'pg-primary')])
    expect(
      findFailover(replicas, unwired, {
        failedId: 'pg-primary',
        fromId: 'server',
        unavailable: new Set(['pg-primary']),
        trail: ['server', 'pg-primary'],
      })
    ).toBeNull()
  })

  it('will not retry into a node this branch already visited', () => {
    expect(
      findFailover(replicas, graph, {
        failedId: 'pg-primary',
        fromId: 'server',
        unavailable: new Set(['pg-primary']),
        trail: ['server', 'pg-replica-1', 'pg-primary'],
      })
    ).toEqual({ nodeId: 'pg-replica-2', edgeId: 'e-r2' })
  })

  it('returns null when the caller has no outgoing edges at all', () => {
    expect(
      findFailover(replicas, new Map(), {
        failedId: 'pg-primary',
        fromId: 'server',
        unavailable: new Set(['pg-primary']),
        trail: [],
      })
    ).toBeNull()
  })
})
