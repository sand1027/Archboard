import { describe, it, expect } from 'vitest'
import type { ArchitectureEdge, ArchitectureNode } from '@/types/diagram'
import { applyOp, applyOps, diffEdges, diffNodes, type DocumentSlice } from './ops'

function node(id: string, x = 0, y = 0, data: Record<string, unknown> = {}): ArchitectureNode {
  return {
    id,
    type: 'architecture',
    position: { x, y },
    data: { componentId: 'server', label: id, category: 'compute', icon: '/s.svg', ...data },
  } as ArchitectureNode
}

function edge(id: string, source: string, target: string): ArchitectureEdge {
  return { id, source, target, type: 'architecture', data: {} } as ArchitectureEdge
}

const DOC: DocumentSlice = {
  nodes: [node('a'), node('b', 100, 100)],
  edges: [edge('e1', 'a', 'b')],
}

describe('applyOp', () => {
  it('adds a node', () => {
    const next = applyOp(DOC, { t: 'node:add', node: node('c') })
    expect(next.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c'])
  })

  /**
   * Broadcast is at-most-once, but a client can still see a message twice — its own echo, or
   * a replay after reconnecting. A duplicated node is worse than a dropped one.
   */
  it('is idempotent for adds', () => {
    const once = applyOp(DOC, { t: 'node:add', node: node('c') })
    const twice = applyOp(once, { t: 'node:add', node: node('c') })
    expect(twice.nodes).toHaveLength(3)
    expect(twice).toBe(once)
  })

  it('moves a node', () => {
    const next = applyOp(DOC, { t: 'node:move', id: 'a', position: { x: 50, y: 60 } })
    expect(next.nodes.find((n) => n.id === 'a')?.position).toEqual({ x: 50, y: 60 })
  })

  it('returns the same object when a move changes nothing', () => {
    expect(applyOp(DOC, { t: 'node:move', id: 'a', position: { x: 0, y: 0 } })).toBe(DOC)
  })

  /**
   * The sender transmits only the fields it changed, so replacing wholesale would wipe
   * anything the receiver knows and the sender does not.
   */
  it('merges node data rather than replacing it', () => {
    const withConfig = applyOp(
      { nodes: [node('a', 0, 0, { serviceMs: 40 })], edges: [] },
      { t: 'node:data', id: 'a', data: { instances: 3 } }
    )
    expect(withConfig.nodes[0].data).toMatchObject({ serviceMs: 40, instances: 3, label: 'a' })
  })

  it('removes a node and its edges', () => {
    const next = applyOp(DOC, { t: 'node:remove', id: 'b' })
    expect(next.nodes.map((n) => n.id)).toEqual(['a'])
    // An edge to a node that no longer exists would render as a line to nowhere.
    expect(next.edges).toHaveLength(0)
  })

  it('ignores operations for unknown ids', () => {
    expect(applyOp(DOC, { t: 'node:move', id: 'zz', position: { x: 1, y: 1 } })).toBe(DOC)
    expect(applyOp(DOC, { t: 'node:data', id: 'zz', data: { a: 1 } })).toBe(DOC)
    expect(applyOp(DOC, { t: 'node:remove', id: 'zz' })).toBe(DOC)
    expect(applyOp(DOC, { t: 'edge:remove', id: 'zz' })).toBe(DOC)
  })

  it('adds an edge between known nodes', () => {
    const next = applyOp(DOC, { t: 'edge:add', edge: edge('e2', 'b', 'a') })
    expect(next.edges.map((e) => e.id)).toEqual(['e1', 'e2'])
  })

  // Operations can arrive out of order; an edge whose endpoints have not landed yet cannot
  // be drawn, and a dangling edge is worse than a missing one.
  it('drops an edge whose endpoints are not present yet', () => {
    expect(applyOp(DOC, { t: 'edge:add', edge: edge('e9', 'a', 'ghost') })).toBe(DOC)
  })

  it('merges edge data', () => {
    const next = applyOp(DOC, { t: 'edge:data', id: 'e1', data: { protocol: 'HTTPS' } })
    expect(next.edges[0].data).toMatchObject({ protocol: 'HTTPS' })
  })

  it('leaves the slice alone for a name change', () => {
    expect(applyOp(DOC, { t: 'diagram:name', name: 'New' })).toBe(DOC)
  })
})

describe('applyOps', () => {
  it('applies a batch in order', () => {
    const next = applyOps(DOC, [
      { t: 'node:add', node: node('c', 5, 5) },
      { t: 'edge:add', edge: edge('e2', 'a', 'c') },
      { t: 'node:move', id: 'c', position: { x: 9, y: 9 } },
    ])
    expect(next.nodes).toHaveLength(3)
    expect(next.edges.map((e) => e.id)).toEqual(['e1', 'e2'])
    expect(next.nodes.find((n) => n.id === 'c')?.position).toEqual({ x: 9, y: 9 })
  })

  /** Two people working on different nodes must both keep their work. */
  it('merges independent edits from two peers', () => {
    const mine = applyOp(DOC, { t: 'node:move', id: 'a', position: { x: 10, y: 0 } })
    const both = applyOp(mine, { t: 'node:data', id: 'b', data: { label: 'Theirs' } })

    expect(both.nodes.find((n) => n.id === 'a')?.position).toEqual({ x: 10, y: 0 })
    expect(both.nodes.find((n) => n.id === 'b')?.data).toMatchObject({ label: 'Theirs' })
  })
})

describe('diffNodes', () => {
  // Instances are reused deliberately. `data` is compared by reference, so calling the
  // factory twice for "the same" node would look like a data change and emit a spurious op.
  const a = node('a')
  const b = node('b', 100, 100)

  it('reports an addition', () => {
    expect(diffNodes([a], [a, b])).toEqual([{ t: 'node:add', node: b }])
  })

  it('reports a removal', () => {
    expect(diffNodes([a, b], [a])).toEqual([{ t: 'node:remove', id: 'b' }])
  })

  // Dragging should send a small move, not the node's whole data bag.
  it('reports a move without the data', () => {
    const after = { ...a, position: { x: 30, y: 40 } } as ArchitectureNode
    expect(diffNodes([a], [after])).toEqual([
      { t: 'node:move', id: 'a', position: { x: 30, y: 40 } },
    ])
  })

  /**
   * Reference equality on `data` is the cheap test, and it is the right one here: every
   * store mutation builds a fresh data object, so a changed node always reports. The cost is
   * a redundant op when data is rebuilt without changing values, which the idempotent merge
   * on the receiving side absorbs.
   */
  it('reports a data change when the data object changed identity', () => {
    const after = { ...a, data: { ...a.data, label: 'Renamed' } } as ArchitectureNode
    const ops = diffNodes([a], [after])
    expect(ops).toHaveLength(1)
    expect(ops[0]).toMatchObject({ t: 'node:data', id: 'a' })
  })

  it('reports both when a node moved and changed', () => {
    const after = {
      ...a,
      position: { x: 1, y: 2 },
      data: { ...a.data, label: 'x' },
    } as ArchitectureNode
    expect(diffNodes([a], [after]).map((o) => o.t)).toEqual(['node:move', 'node:data'])
  })

  it('reports nothing when nothing changed', () => {
    const nodes = [a, b]
    expect(diffNodes(nodes, nodes)).toEqual([])
  })
})

describe('diffEdges', () => {
  it('reports additions and removals', () => {
    const e1 = edge('e1', 'a', 'b')
    expect(diffEdges([], [e1])).toEqual([{ t: 'edge:add', edge: e1 }])
    expect(diffEdges([e1], [])).toEqual([{ t: 'edge:remove', id: 'e1' }])
  })

  it('reports a data change', () => {
    const before = edge('e1', 'a', 'b')
    const after = { ...before, data: { protocol: 'gRPC' } } as ArchitectureEdge
    expect(diffEdges([before], [after])).toEqual([
      { t: 'edge:data', id: 'e1', data: { protocol: 'gRPC' } },
    ])
  })

  it('reports nothing when nothing changed', () => {
    const edges = [edge('e1', 'a', 'b')]
    expect(diffEdges(edges, edges)).toEqual([])
  })
})
