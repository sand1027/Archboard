import { describe, it, expect } from 'vitest'
import type { ArchitectureNode, ArchitectureEdge } from '@/types/diagram'
import type { CollabOp } from '@/types/collab'
import {
  applyStamped,
  applyStampedBatch,
  compareStamps,
  createClock,
  isNewer,
  keysFor,
  noteLocal,
  type StampedOp,
  type VersionMap,
} from './crdt'
import type { DocumentSlice } from './ops'

function node(id: string, x = 0, y = 0): ArchitectureNode {
  return {
    id,
    type: 'architecture',
    position: { x, y },
    data: { componentId: 'server', label: id, category: 'compute', icon: '/s.svg' },
  } as ArchitectureNode
}

function edge(id: string, source: string, target: string): ArchitectureEdge {
  return { id, source, target, type: 'architecture', data: {} } as ArchitectureEdge
}

const doc = (): DocumentSlice => ({ nodes: [node('a'), node('b')], edges: [] })
const stamped = (op: CollabOp, c: number, by: string): StampedOp => ({ op, stamp: { c, by } })

describe('compareStamps', () => {
  it('orders by counter', () => {
    expect(compareStamps({ c: 2, by: 'x' }, { c: 1, by: 'x' })).toBeGreaterThan(0)
  })

  /** With equal counters every replica must still agree, so the id decides. */
  it('breaks ties on client id', () => {
    expect(compareStamps({ c: 1, by: 'b' }, { c: 1, by: 'a' })).toBeGreaterThan(0)
    expect(compareStamps({ c: 1, by: 'a' }, { c: 1, by: 'b' })).toBeLessThan(0)
    expect(compareStamps({ c: 1, by: 'a' }, { c: 1, by: 'a' })).toBe(0)
  })

  it('treats a missing current value as older', () => {
    expect(isNewer({ c: 1, by: 'a' }, undefined)).toBe(true)
    expect(isNewer({ c: 1, by: 'a' }, { c: 1, by: 'a' })).toBe(false)
  })
})

describe('createClock', () => {
  it('increments on each write', () => {
    const clock = createClock('me')
    expect(clock.next()).toEqual({ c: 1, by: 'me' })
    expect(clock.next()).toEqual({ c: 2, by: 'me' })
  })

  /**
   * Without this, a client that has seen a remote edit would issue its next write with a
   * lower counter and lose for no reason.
   */
  it('advances past anything observed', () => {
    const clock = createClock('me')
    clock.observe({ c: 41, by: 'them' })
    expect(clock.next().c).toBe(42)
  })

  it('ignores older observations', () => {
    const clock = createClock('me', 10)
    clock.observe({ c: 3, by: 'them' })
    expect(clock.next().c).toBe(11)
  })
})

describe('keysFor', () => {
  it('scopes data writes per field, so different fields do not compete', () => {
    expect(keysFor({ t: 'node:data', id: 'a', data: { label: 'x', serviceMs: 5 } })).toEqual([
      'n:a:d:label',
      'n:a:d:serviceMs',
    ])
  })

  it('separates position from data', () => {
    expect(keysFor({ t: 'node:move', id: 'a', position: { x: 0, y: 0 } })).toEqual(['n:a:position'])
  })

  it('uses one existence key for add and remove alike', () => {
    expect(keysFor({ t: 'node:add', node: node('z') })).toEqual(['n:z'])
    expect(keysFor({ t: 'node:remove', id: 'z' })).toEqual(['n:z'])
  })
})

describe('applyStamped', () => {
  it('accepts a newer write', () => {
    const versions: VersionMap = new Map()
    const result = applyStamped(doc(), versions, stamped({ t: 'node:data', id: 'a', data: { label: 'One' } }, 1, 'x'))
    expect(result.applied).toBe(true)
    expect(result.doc.nodes[0].data.label).toBe('One')
  })

  it('rejects a stale write', () => {
    const versions: VersionMap = new Map()
    const first = applyStamped(doc(), versions, stamped({ t: 'node:data', id: 'a', data: { label: 'New' } }, 5, 'x'))
    const second = applyStamped(first.doc, versions, stamped({ t: 'node:data', id: 'a', data: { label: 'Old' } }, 2, 'y'))

    expect(second.applied).toBe(false)
    expect(second.doc.nodes[0].data.label).toBe('New')
  })

  /**
   * Rejecting a whole message because one of its fields was stale would throw away a good
   * edit for travelling next to an old one.
   */
  it('accepts the fresh fields of a partly stale write', () => {
    const versions: VersionMap = new Map()
    let current = doc()

    current = applyStamped(current, versions, stamped({ t: 'node:data', id: 'a', data: { label: 'Kept' } }, 9, 'x')).doc
    const mixed = applyStamped(
      current,
      versions,
      stamped({ t: 'node:data', id: 'a', data: { label: 'Stale', serviceMs: 40 } }, 3, 'y')
    )

    expect(mixed.doc.nodes[0].data.label).toBe('Kept')
    expect(mixed.doc.nodes[0].data.serviceMs).toBe(40)
  })

  it('keeps edits to different fields of one node', () => {
    const versions: VersionMap = new Map()
    let current = doc()
    current = applyStamped(current, versions, stamped({ t: 'node:data', id: 'a', data: { label: 'Mine' } }, 1, 'x')).doc
    current = applyStamped(current, versions, stamped({ t: 'node:data', id: 'a', data: { serviceMs: 12 } }, 1, 'y')).doc

    expect(current.nodes[0].data).toMatchObject({ label: 'Mine', serviceMs: 12 })
  })

  /** A late add must not resurrect something already deleted. */
  it('keeps a removal against an older add', () => {
    const versions: VersionMap = new Map()
    const removed = applyStamped(doc(), versions, stamped({ t: 'node:remove', id: 'b' }, 5, 'x'))
    const resurrect = applyStamped(removed.doc, versions, stamped({ t: 'node:add', node: node('b') }, 2, 'y'))

    expect(resurrect.applied).toBe(false)
    expect(resurrect.doc.nodes.map((n) => n.id)).toEqual(['a'])
  })

  it('allows a genuinely newer re-add', () => {
    const versions: VersionMap = new Map()
    const removed = applyStamped(doc(), versions, stamped({ t: 'node:remove', id: 'b' }, 5, 'x'))
    const readded = applyStamped(removed.doc, versions, stamped({ t: 'node:add', node: node('b') }, 6, 'y'))

    expect(readded.doc.nodes.map((n) => n.id)).toEqual(['a', 'b'])
  })
})

describe('convergence', () => {
  /**
   * The property the whole module exists for, and the exact scenario that broke before:
   * two people rename the same node at once. Applying the pair in either order must give the
   * same answer, or the two clients end up looking at different documents.
   */
  it('reaches the same state whatever order concurrent writes arrive in', () => {
    const mine = stamped({ t: 'node:data', id: 'a', data: { label: 'Cache' } }, 4, 'alice')
    const theirs = stamped({ t: 'node:data', id: 'a', data: { label: 'Redis' } }, 4, 'bob')

    const alice = applyStampedBatch(doc(), new Map(), [mine, theirs])
    const bob = applyStampedBatch(doc(), new Map(), [theirs, mine])

    expect(alice.nodes[0].data.label).toBe(bob.nodes[0].data.label)
    // Equal counters, so the higher client id wins on both sides.
    expect(alice.nodes[0].data.label).toBe('Redis')
  })

  it('converges on a longer interleaving', () => {
    const ops: StampedOp[] = [
      stamped({ t: 'node:add', node: node('c') }, 1, 'alice'),
      stamped({ t: 'node:move', id: 'a', position: { x: 10, y: 0 } }, 2, 'bob'),
      stamped({ t: 'node:data', id: 'a', data: { label: 'A2' } }, 3, 'alice'),
      stamped({ t: 'node:move', id: 'a', position: { x: 99, y: 9 } }, 4, 'bob'),
      stamped({ t: 'node:remove', id: 'b' }, 5, 'alice'),
      stamped({ t: 'node:data', id: 'a', data: { label: 'A1' } }, 2, 'bob'),
    ]

    const forwards = applyStampedBatch(doc(), new Map(), ops)
    const backwards = applyStampedBatch(doc(), new Map(), [...ops].reverse())
    const shuffled = applyStampedBatch(doc(), new Map(), [ops[3], ops[0], ops[5], ops[2], ops[4], ops[1]])

    expect(backwards).toEqual(forwards)
    expect(shuffled).toEqual(forwards)
    // Newest wins on each field independently.
    expect(forwards.nodes.find((n) => n.id === 'a')?.data.label).toBe('A2')
    expect(forwards.nodes.find((n) => n.id === 'a')?.position).toEqual({ x: 99, y: 9 })
    expect(forwards.nodes.map((n) => n.id)).toEqual(['a', 'c'])
  })

  it('is idempotent under redelivery', () => {
    const ops: StampedOp[] = [
      stamped({ t: 'node:add', node: node('c') }, 1, 'alice'),
      stamped({ t: 'node:data', id: 'c', data: { label: 'C' } }, 2, 'alice'),
    ]
    const once = applyStampedBatch(doc(), new Map(), ops)
    const twice = applyStampedBatch(doc(), new Map(), [...ops, ...ops])
    expect(twice).toEqual(once)
  })

  it('converges on edge data too', () => {
    const base: DocumentSlice = { nodes: [node('a'), node('b')], edges: [edge('e1', 'a', 'b')] }
    const mine = stamped({ t: 'edge:data', id: 'e1', data: { protocol: 'HTTPS' } }, 7, 'alice')
    const theirs = stamped({ t: 'edge:data', id: 'e1', data: { protocol: 'gRPC' } }, 7, 'bob')

    expect(applyStampedBatch(base, new Map(), [mine, theirs])).toEqual(
      applyStampedBatch(base, new Map(), [theirs, mine])
    )
  })
})

describe('noteLocal', () => {
  /**
   * A local edit is already in the store, but its stamp must be registered or a concurrent
   * remote write with an older stamp would look newer and overwrite it.
   */
  it('makes a local write beat an older remote one', () => {
    const versions: VersionMap = new Map()
    const local: CollabOp = { t: 'node:data', id: 'a', data: { label: 'Local' } }

    noteLocal(versions, local, { c: 9, by: 'me' })

    const remote = applyStamped(doc(), versions, stamped({ t: 'node:data', id: 'a', data: { label: 'Remote' } }, 4, 'them'))
    expect(remote.applied).toBe(false)
  })
})
