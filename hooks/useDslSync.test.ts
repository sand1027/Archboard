import { describe, it, expect } from 'vitest'
import type { ArchitectureEdge, ArchitectureNode } from '@/types/diagram'
import type { ArchitectureNodeData, ShapeNodeData } from '@/types/architecture'
import { compileSource } from '@/lib/dsl/compile'
import { keepUnownedEdges, keepUnownedNodes } from './useDslSync'

/**
 * These two functions are the whole reason a text-driven diagram can coexist with a drawn
 * one. Before them the sync layer replaced the entire node array on every recompile, which
 * silently deleted every hand-drawn shape the moment anyone typed a character.
 */

function drawnShape(id: string, label = 'Legend'): ArchitectureNode {
  return {
    id,
    type: 'shape',
    position: { x: 500, y: 300 },
    data: { shapeType: 'rectangle', label } as ShapeNodeData,
  }
}

function drawnComponent(id: string): ArchitectureNode {
  return {
    id,
    type: 'architecture',
    position: { x: 10, y: 20 },
    data: {
      componentId: 'server',
      label: 'Hand-placed',
      category: 'compute',
      icon: '/x.svg',
    } as ArchitectureNodeData,
  }
}

function drawnEdge(id: string): ArchitectureEdge {
  return { id, type: 'architecture', source: 'a', target: 'b', data: { label: 'drawn' } }
}

describe('keepUnownedNodes', () => {
  it('keeps a hand-drawn shape', () => {
    expect(keepUnownedNodes([drawnShape('s1')]).map((n) => n.id)).toEqual(['s1'])
  })

  it('drops a node the text generated', () => {
    const generated = compileSource('server api "API"').nodes
    expect(keepUnownedNodes(generated)).toEqual([])
  })

  /** The case that was broken: a drawn shape beside a text-driven architecture. */
  it('keeps the drawn nodes and drops only the generated ones', () => {
    const generated = compileSource('server api "API"\npostgresql db "DB"').nodes
    const mixed = [drawnShape('s1'), ...generated, drawnComponent('c1')]

    expect(keepUnownedNodes(mixed).map((n) => n.id)).toEqual(['s1', 'c1'])
  })

  it('keeps a component someone dragged in by hand, since the text never claimed it', () => {
    expect(keepUnownedNodes([drawnComponent('c1')])).toHaveLength(1)
  })

  it('keeps an LLD node', () => {
    const uml: ArchitectureNode = {
      id: 'u1',
      type: 'umlClass',
      position: { x: 0, y: 0 },
      data: { name: 'Order', attributes: [], methods: [] },
    }
    expect(keepUnownedNodes([uml])).toHaveLength(1)
  })

  /** A shape written in the DSL *is* the text's, and has to be replaced like anything else. */
  it('drops a shape the text generated', () => {
    const generated = compileSource('shape hint "Note" : note').nodes
    expect(keepUnownedNodes(generated)).toEqual([])
  })

  it('treats an empty or non-string marker as unowned', () => {
    const odd: ArchitectureNode = {
      id: 'x1',
      type: 'shape',
      position: { x: 0, y: 0 },
      data: { shapeType: 'rectangle', dslName: 42 } as unknown as ShapeNodeData,
    }
    expect(keepUnownedNodes([odd])).toHaveLength(1)
  })

  it('handles an empty list', () => {
    expect(keepUnownedNodes([])).toEqual([])
  })

  /** A full recompile must be lossless for everything it does not own. */
  it('loses nothing across a simulated recompile', () => {
    const drawn = [drawnShape('s1'), drawnShape('s2', 'Title'), drawnComponent('c1')]
    const first = compileSource('server api "API"').nodes
    const afterFirst = [...keepUnownedNodes(drawn), ...first]

    const second = compileSource('server api "API"\nredis cache "Cache"').nodes
    const afterSecond = [...keepUnownedNodes(afterFirst), ...second]

    expect(afterSecond.filter((n) => n.data?.dslName === undefined).map((n) => n.id)).toEqual([
      's1',
      's2',
      'c1',
    ])
    expect(afterSecond).toHaveLength(3 + 2)
  })
})

describe('keepUnownedEdges', () => {
  it('keeps a hand-drawn edge', () => {
    expect(keepUnownedEdges([drawnEdge('e1')]).map((e) => e.id)).toEqual(['e1'])
  })

  it('drops an edge the text generated', () => {
    const generated = compileSource('server api\npostgresql db\napi -> db').edges
    expect(keepUnownedEdges(generated)).toEqual([])
  })

  it('keeps the drawn edges and drops only the generated ones', () => {
    const generated = compileSource('server api\npostgresql db\napi -> db').edges
    const mixed = [drawnEdge('e1'), ...generated]
    expect(keepUnownedEdges(mixed).map((e) => e.id)).toEqual(['e1'])
  })

  it('treats a missing marker as unowned', () => {
    const bare: ArchitectureEdge = { id: 'e1', source: 'a', target: 'b' }
    expect(keepUnownedEdges([bare])).toHaveLength(1)
  })

  it('handles an empty list', () => {
    expect(keepUnownedEdges([])).toEqual([])
  })
})

describe('merging a recompile into a canvas', () => {
  /**
   * The end-to-end shape of what the sync layer does, without the React plumbing: keep what
   * is not owned, replace what is.
   */
  const merge = (
    canvas: ArchitectureNode[],
    source: string
  ): ArchitectureNode[] => [...keepUnownedNodes(canvas), ...compileSource(source).nodes]

  it('keeps a drawn shape while the architecture changes underneath it', () => {
    const canvas = merge([drawnShape('s1')], 'server api "API"')
    expect(canvas.map((n) => n.id)).toContain('s1')

    const afterEdit = merge(canvas, 'server api "API"\npostgresql db "DB"')
    expect(afterEdit.map((n) => n.id)).toContain('s1')
    expect(afterEdit.filter((n) => typeof n.data?.dslName === 'string')).toHaveLength(2)
  })

  it('removes a component once its declaration is deleted', () => {
    const canvas = merge([], 'server api "API"\nredis cache "Cache"')
    expect(canvas).toHaveLength(2)

    const afterDelete = merge(canvas, 'server api "API"')
    expect(afterDelete).toHaveLength(1)
    expect(afterDelete[0].data?.dslName).toBe('api')
  })

  it('never duplicates a node across repeated recompiles', () => {
    let canvas = merge([drawnShape('s1')], 'server api "API"')
    for (let i = 0; i < 5; i++) canvas = merge(canvas, 'server api "API"')

    expect(canvas).toHaveLength(2)
    expect(new Set(canvas.map((n) => n.id)).size).toBe(2)
  })

  it('keeps drawn and generated shapes apart', () => {
    const canvas = merge([drawnShape('s1', 'Drawn')], 'shape written "Written" : note')

    const labels = canvas.map((n) => n.data?.label)
    expect(labels).toContain('Drawn')
    expect(labels).toContain('Written')
    expect(canvas).toHaveLength(2)
  })
})
