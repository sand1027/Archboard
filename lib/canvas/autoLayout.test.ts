import { describe, it, expect } from 'vitest'
import type { ArchitectureEdge, ArchitectureNode } from '@/types/diagram'
import type { ArchitectureNodeData, FrameNodeData } from '@/types/architecture'
import { compileSource } from '@/lib/dsl/compile'
import { centerInside, nodeBounds } from './geometry'
import { autoLayout, pinsByDslName, pinsByNodeId } from './autoLayout'

function node(id: string, size = { w: 72, h: 88 }): ArchitectureNode {
  return {
    id,
    type: 'architecture',
    position: { x: 0, y: 0 },
    width: size.w,
    height: size.h,
    style: { width: size.w, height: size.h },
    data: { componentId: 'server', label: id, category: 'compute', icon: '/x.svg' } as ArchitectureNodeData,
  }
}

function frame(id: string): ArchitectureNode {
  return {
    id,
    type: 'frame',
    position: { x: 0, y: 0 },
    data: { label: id, frameType: 'custom' } as FrameNodeData,
  }
}

function edge(source: string, target: string): ArchitectureEdge {
  return { id: `${source}-${target}`, type: 'architecture', source, target, data: {} }
}

const at = (result: { nodes: ArchitectureNode[] }, id: string) =>
  result.nodes.find((n) => n.id === id)!.position

const rectOf = (result: { nodes: ArchitectureNode[] }, id: string) =>
  nodeBounds(result.nodes.find((n) => n.id === id)!)

describe('ranking', () => {
  it('stacks a chain along the flow', () => {
    const result = autoLayout({
      nodes: [node('a'), node('b'), node('c')],
      edges: [edge('a', 'b'), edge('b', 'c')],
    })

    expect(at(result, 'a').y).toBeLessThan(at(result, 'b').y)
    expect(at(result, 'b').y).toBeLessThan(at(result, 'c').y)
  })

  it('puts siblings that share a source on the same rank', () => {
    const result = autoLayout({
      nodes: [node('lb'), node('a'), node('b')],
      edges: [edge('lb', 'a'), edge('lb', 'b')],
    })

    expect(at(result, 'a').y).toBe(at(result, 'b').y)
    expect(at(result, 'a').x).not.toBe(at(result, 'b').x)
  })

  /** Longest path, so a node sits below everything that feeds it, not just the first thing. */
  it('ranks by the longest path, not the shortest', () => {
    const result = autoLayout({
      nodes: [node('a'), node('b'), node('c')],
      // a → c directly, and a → b → c. c must land below b.
      edges: [edge('a', 'b'), edge('b', 'c'), edge('a', 'c')],
    })

    expect(at(result, 'c').y).toBeGreaterThan(at(result, 'b').y)
  })

  it('places unconnected nodes together on the first rank', () => {
    const result = autoLayout({ nodes: [node('a'), node('b')], edges: [] })
    expect(at(result, 'a').y).toBe(at(result, 'b').y)
  })

  it('does not hang or overlap on a cycle', () => {
    const result = autoLayout({
      nodes: [node('a'), node('b'), node('c')],
      edges: [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')],
    })

    const positions = result.nodes.map((n) => `${n.position.x},${n.position.y}`)
    expect(new Set(positions).size).toBe(3)
  })

  it('handles a self-loop', () => {
    expect(() => autoLayout({ nodes: [node('a')], edges: [edge('a', 'a')] })).not.toThrow()
  })

  it('lays out an empty diagram', () => {
    expect(autoLayout({ nodes: [], edges: [] })).toEqual({ nodes: [], width: 0, height: 0 })
  })
})

describe('direction', () => {
  it('flows left to right when asked', () => {
    const result = autoLayout(
      { nodes: [node('a'), node('b')], edges: [edge('a', 'b')] },
      { direction: 'right' }
    )
    expect(at(result, 'a').x).toBeLessThan(at(result, 'b').x)
    expect(at(result, 'a').y).toBe(at(result, 'b').y)
  })
})

describe('determinism and stability', () => {
  const nodes = [node('a'), node('b'), node('c')]
  const edges = [edge('a', 'b'), edge('b', 'c')]

  /** Same text must always give the same diagram, or the canvas jitters as you type. */
  it('produces identical output for identical input', () => {
    const first = autoLayout({ nodes, edges })
    const second = autoLayout({ nodes, edges })
    expect(first.nodes.map((n) => n.position)).toEqual(second.nodes.map((n) => n.position))
  })

  it('is unaffected by the order edges happen to be listed in', () => {
    const forwards = autoLayout({ nodes, edges: [edge('a', 'b'), edge('b', 'c')] })
    const backwards = autoLayout({ nodes, edges: [edge('b', 'c'), edge('a', 'b')] })
    expect(forwards.nodes.map((n) => n.position)).toEqual(backwards.nodes.map((n) => n.position))
  })

  /**
   * The reason this is hand-written rather than delegated to a layered library: adding one
   * node must not rearrange the rest.
   */
  it('leaves existing ranks alone when a node is appended', () => {
    const before = autoLayout({ nodes, edges })
    const after = autoLayout({
      nodes: [...nodes, node('d')],
      edges: [...edges, edge('c', 'd')],
    })

    // Every original node keeps its rank, and the chain keeps its spacing.
    for (const id of ['a', 'b', 'c']) {
      expect(at(after, id).y).toBe(at(before, id).y)
    }
  })

  it('keeps upstream nodes put when a leaf is added off a middle node', () => {
    const before = autoLayout({ nodes, edges })
    const after = autoLayout({
      nodes: [...nodes, node('side')],
      edges: [...edges, edge('b', 'side')],
    })
    expect(at(after, 'a').y).toBe(at(before, 'a').y)
    expect(at(after, 'b').y).toBe(at(before, 'b').y)
  })
})

describe('frames', () => {
  const nodes = [frame('f'), node('a'), node('b')]
  const hierarchy = { a: 'f', b: 'f' }

  it('sizes a frame around its members', () => {
    const result = autoLayout({ nodes, edges: [] }, { hierarchy })
    const box = rectOf(result, 'f')
    const a = rectOf(result, 'a')
    expect(box.w).toBeGreaterThan(a.w)
    expect(box.h).toBeGreaterThan(a.h)
  })

  /** Containment in this app *is* geometry, so a frame must actually cover its children. */
  it('encloses every member, by the same rule the rest of the app uses', () => {
    const result = autoLayout({ nodes, edges: [edge('a', 'b')] }, { hierarchy })
    const box = rectOf(result, 'f')

    for (const id of ['a', 'b']) {
      const child = result.nodes.find((n) => n.id === id)!
      expect(centerInside(child, box)).toBe(true)
    }
  })

  it('leaves room at the top for the frame label', () => {
    const result = autoLayout({ nodes, edges: [] }, { hierarchy })
    const box = rectOf(result, 'f')
    const a = rectOf(result, 'a')
    expect(a.y - box.y).toBeGreaterThanOrEqual(32)
  })

  it('gives an empty frame a usable size', () => {
    const result = autoLayout({ nodes: [frame('f')], edges: [] }, { hierarchy: {} })
    const box = rectOf(result, 'f')
    expect(box.w).toBeGreaterThan(0)
    expect(box.h).toBeGreaterThan(0)
  })

  it('nests frames, each enclosing the next', () => {
    const result = autoLayout(
      { nodes: [frame('outer'), frame('inner'), node('a')], edges: [] },
      { hierarchy: { inner: 'outer', a: 'inner' } }
    )

    const outer = rectOf(result, 'outer')
    const inner = rectOf(result, 'inner')
    expect(centerInside(result.nodes.find((n) => n.id === 'inner')!, outer)).toBe(true)
    expect(centerInside(result.nodes.find((n) => n.id === 'a')!, inner)).toBe(true)
    expect(outer.w).toBeGreaterThan(inner.w)
  })

  /** An arrow between two frames' contents has to rank the frames themselves. */
  it('ranks two frames from an edge between their members', () => {
    const result = autoLayout(
      {
        nodes: [frame('f1'), frame('f2'), node('a'), node('b')],
        edges: [edge('a', 'b')],
      },
      { hierarchy: { a: 'f1', b: 'f2' } }
    )
    expect(at(result, 'f1').y).toBeLessThan(at(result, 'f2').y)
  })

  it('sets frame size on width, height and style, as the canvas expects', () => {
    const result = autoLayout({ nodes, edges: [] }, { hierarchy })
    const f = result.nodes.find((n) => n.id === 'f')!
    expect(f.width).toBeGreaterThan(0)
    expect(f.height).toBeGreaterThan(0)
    expect(f.style).toMatchObject({ width: f.width, height: f.height })
  })

  it('falls back to geometry when no hierarchy is given', () => {
    // A frame already sized and positioned around a node, as if drawn on the canvas.
    const drawn: ArchitectureNode[] = [
      { ...frame('f'), position: { x: 0, y: 0 }, width: 400, height: 300, style: { width: 400, height: 300 } },
      { ...node('a'), position: { x: 100, y: 100 } },
    ]
    const result = autoLayout({ nodes: drawn, edges: [] })
    expect(centerInside(result.nodes.find((n) => n.id === 'a')!, rectOf(result, 'f'))).toBe(true)
  })
})

describe('pins', () => {
  const nodes = [node('a'), node('b')]
  const edges = [edge('a', 'b')]

  /** This is what keeps coordinates out of the text: the arrangement lives beside it. */
  it('puts a pinned node exactly where it was pinned', () => {
    const result = autoLayout({ nodes, edges }, { pins: { b: { x: 900, y: 40 } } })
    expect(at(result, 'b')).toEqual({ x: 900, y: 40 })
  })

  it('still lays out everything unpinned', () => {
    const result = autoLayout({ nodes, edges }, { pins: { b: { x: 900, y: 40 } } })
    expect(at(result, 'a')).not.toEqual({ x: 900, y: 40 })
  })

  it('ignores a pin for a node that no longer exists', () => {
    expect(() => autoLayout({ nodes, edges }, { pins: { gone: { x: 1, y: 1 } } })).not.toThrow()
  })

  it('ignores a pin with a non-finite coordinate', () => {
    const result = autoLayout({ nodes, edges }, { pins: { b: { x: NaN, y: 0 } } })
    expect(Number.isFinite(at(result, 'b').x)).toBe(true)
  })

  /**
   * A dragged child must not silently leave its frame — containment is geometric, so the
   * frame has to grow to keep holding it.
   */
  it('grows a frame to keep holding a pinned member', () => {
    const result = autoLayout(
      { nodes: [frame('f'), node('a'), node('b')], edges: [] },
      { hierarchy: { a: 'f', b: 'f' }, pins: { b: { x: 800, y: 600 } } }
    )

    const box = rectOf(result, 'f')
    expect(centerInside(result.nodes.find((n) => n.id === 'b')!, box)).toBe(true)
    expect(centerInside(result.nodes.find((n) => n.id === 'a')!, box)).toBe(true)
  })

  it('grows an outer frame when an inner one is pinned outwards', () => {
    const result = autoLayout(
      { nodes: [frame('outer'), frame('inner'), node('a')], edges: [] },
      { hierarchy: { inner: 'outer', a: 'inner' }, pins: { inner: { x: 700, y: 500 } } }
    )
    expect(
      centerInside(result.nodes.find((n) => n.id === 'inner')!, rectOf(result, 'outer'))
    ).toBe(true)
  })
})

describe('origin', () => {
  it('places the diagram at the origin given', () => {
    const result = autoLayout(
      { nodes: [node('a'), node('b')], edges: [edge('a', 'b')] },
      { origin: { x: 200, y: 100 } }
    )
    const minX = Math.min(...result.nodes.map((n) => n.position.x))
    const minY = Math.min(...result.nodes.map((n) => n.position.y))
    expect(minX).toBe(200)
    expect(minY).toBe(100)
  })

  it('starts at zero by default, with no negative coordinates', () => {
    const result = autoLayout({
      nodes: [node('lb'), node('a'), node('b'), node('c')],
      edges: [edge('lb', 'a'), edge('lb', 'b'), edge('lb', 'c')],
    })
    expect(Math.min(...result.nodes.map((n) => n.position.x))).toBe(0)
    expect(Math.min(...result.nodes.map((n) => n.position.y))).toBe(0)
  })

  it('reports the bounding size', () => {
    const result = autoLayout({ nodes: [node('a'), node('b')], edges: [edge('a', 'b')] })
    expect(result.width).toBeGreaterThan(0)
    expect(result.height).toBeGreaterThan(88 * 2)
  })
})

describe('pin key translation', () => {
  /** Pins key by DSL name because a generated node id does not survive a recompile. */
  it('maps names to ids and back', () => {
    const nodeIdsByName = { api: 'n-1', db: 'n-2' }
    const byId = pinsByNodeId({ api: { x: 10, y: 20 } }, nodeIdsByName)
    expect(byId).toEqual({ 'n-1': { x: 10, y: 20 } })
    expect(pinsByDslName(byId, nodeIdsByName)).toEqual({ api: { x: 10, y: 20 } })
  })

  it('drops a pin whose name is gone from the source', () => {
    expect(pinsByNodeId({ removed: { x: 1, y: 1 } }, { api: 'n-1' })).toEqual({})
  })

  it('survives a recompile that changes ids', () => {
    const pins = { api: { x: 10, y: 20 } }
    // Same name, different generated id — the pin must still land.
    expect(pinsByNodeId(pins, { api: 'n-7' })).toEqual({ 'n-7': { x: 10, y: 20 } })
  })
})

describe('a compiled diagram', () => {
  const source = `diagram "Photos" {
  group client "Client" {
    web-browser web "Web"
    mobile-app mobile "Mobile"
  }

  load-balancer lb "Load Balancer"

  group dc "Data Center" : data-center {
    group svc "Services" : cluster {
      server api "API"
    }
    redis cache "Redis"
    postgresql db "Orders"
  }

  web    -> lb
  mobile -> lb
  lb     -> api
  api    -> cache
  api    -> db
}`

  const laidOut = () => {
    const compiled = compileSource(source)
    expect(compiled.diagnostics).toEqual([])
    return {
      compiled,
      result: autoLayout(
        { nodes: compiled.nodes, edges: compiled.edges },
        { hierarchy: compiled.hierarchy }
      ),
    }
  }

  /** Compiled nodes all arrive at the origin; layout is what makes the diagram real. */
  it('moves every node off the origin', () => {
    const { result } = laidOut()
    const stacked = result.nodes.filter((n) => n.position.x === 0 && n.position.y === 0)
    expect(stacked.length).toBeLessThanOrEqual(1)
  })

  it('gives no two nodes the same position', () => {
    const { result } = laidOut()
    const positions = result.nodes.map((n) => `${n.position.x},${n.position.y}`)
    expect(new Set(positions).size).toBe(result.nodes.length)
  })

  /**
   * The invariant the whole app depends on: every group's members must fall inside it, or
   * the simulation and group-drag stop seeing them as members at all.
   */
  it('satisfies geometric containment for every compiled group', () => {
    const { compiled, result } = laidOut()

    for (const [childId, parentId] of Object.entries(compiled.hierarchy)) {
      const child = result.nodes.find((n) => n.id === childId)!
      const parent = result.nodes.find((n) => n.id === parentId)!
      expect(centerInside(child, nodeBounds(parent))).toBe(true)
    }
  })

  it('flows clients above the balancer above the data centre', () => {
    const { compiled, result } = laidOut()
    const y = (name: string) => at(result, compiled.nodeIdsByName[name]).y

    expect(y('web')).toBeLessThan(y('lb'))
    expect(y('lb')).toBeLessThan(y('api'))
  })

  it('is stable when a component is appended to the source', () => {
    const { compiled: before, result: first } = laidOut()

    const grown = source.replace('  api    -> db', '  api    -> db\n  monitoring mon "Metrics"')
    const after = compileSource(grown)
    const second = autoLayout(
      { nodes: after.nodes, edges: after.edges },
      { hierarchy: after.hierarchy }
    )

    // The API tier keeps its rank despite a new component in the document.
    expect(at(second, after.nodeIdsByName.api).y).toBe(
      at(first, before.nodeIdsByName.api).y
    )
  })
})
