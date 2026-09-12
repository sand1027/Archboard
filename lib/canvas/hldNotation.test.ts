import { describe, it, expect } from 'vitest'
import {
  CONNECTION_TYPES,
  CONNECTION_TYPE_HINT,
  CONNECTION_TYPE_LABEL,
  HLD_NOTATION,
  PROTOCOL_COLORS,
  PROTOCOL_DEFAULT_TYPE,
} from './hldNotation'
import { MARKER_GLYPHS } from './markers'
import { migrateDocument } from '@/lib/persistence/documentPayload'
import type { ConnectionType } from '@/types/architecture'

describe('HLD notation', () => {
  it('references only markers that exist', () => {
    for (const [type, style] of Object.entries(HLD_NOTATION)) {
      for (const marker of [style.startMarker, style.endMarker]) {
        if (marker === 'none') continue
        expect(MARKER_GLYPHS, `${type} → ${marker}`).toHaveProperty(marker)
      }
    }
  })

  it('labels and explains every connection type', () => {
    for (const type of CONNECTION_TYPES) {
      expect(CONNECTION_TYPE_LABEL[type]).toBeTruthy()
      expect(CONNECTION_TYPE_HINT[type]).toBeTruthy()
    }
  })

  // The point of the change: HLD used to draw one arrowhead for everything.
  it('renders each connection type distinguishably', () => {
    const signatures = CONNECTION_TYPES.map((t) => {
      const s = HLD_NOTATION[t]
      return `${s.line}|${s.startMarker}|${s.endMarker}|${s.stroke}|${s.strokeWidth}`
    })
    expect(new Set(signatures).size).toBe(CONNECTION_TYPES.length)
  })

  it('marks async and event as non-solid so they read as non-blocking', () => {
    expect(HLD_NOTATION.asynchronous.line).not.toBe('solid')
    expect(HLD_NOTATION.event.line).not.toBe('solid')
    expect(HLD_NOTATION.synchronous.line).toBe('solid')
  })

  it('puts arrowheads at both ends of a bidirectional connection', () => {
    expect(HLD_NOTATION.bidirectional.startMarker).not.toBe('none')
    expect(HLD_NOTATION.bidirectional.endMarker).not.toBe('none')
  })

  it('gives replication the heaviest stroke', () => {
    const widths = CONNECTION_TYPES.map((t) => HLD_NOTATION[t].strokeWidth)
    expect(HLD_NOTATION.replication.strokeWidth).toBe(Math.max(...widths))
  })

  it('maps messaging protocols onto their implied semantics', () => {
    expect(PROTOCOL_DEFAULT_TYPE.Kafka).toBe('event')
    expect(PROTOCOL_DEFAULT_TYPE.WebSocket).toBe('bidirectional')
    for (const type of Object.values(PROTOCOL_DEFAULT_TYPE)) {
      expect(CONNECTION_TYPES).toContain(type as ConnectionType)
    }
  })

  it('colours every protocol', () => {
    for (const color of Object.values(PROTOCOL_COLORS)) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
})

describe('connectable migration', () => {
  // Regression guard: React Flow honours a per-node `connectable: false` over
  // the canvas-wide nodesConnectable, so old components would stay unwireable.
  it('frees previously saved architecture nodes to be connected', () => {
    const doc = migrateDocument({
      activeBoard: 'hld',
      boards: {
        hld: {
          diagramId: 'd1',
          diagramName: 'Test',
          nodes: [
            { id: 'a', type: 'architecture', position: { x: 0, y: 0 }, connectable: false, data: {} },
            { id: 'b', type: 'icon', position: { x: 0, y: 0 }, connectable: false, data: {} },
          ],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
        lld: { diagramId: 'd2', diagramName: 'L', nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
      },
    })

    expect(doc).not.toBeNull()
    for (const node of doc!.boards.hld.nodes) {
      expect(node, node.id).not.toHaveProperty('connectable')
    }
  })

  // Closed shapes are endpoints on both boards, so a stale flag is stripped.
  // Only genuine scenery — lines, arrows, text, frames — stays pinned to false.
  it('frees closed shapes but keeps scenery unconnectable', () => {
    const doc = migrateDocument({
      activeBoard: 'lld',
      boards: {
        hld: { diagramId: 'd1', diagramName: 'H', nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
        lld: {
          diagramId: 'd2',
          diagramName: 'L',
          nodes: [
            {
              id: 'box',
              type: 'shape',
              position: { x: 0, y: 0 },
              connectable: false,
              data: { shapeType: 'rectangle' },
            },
            {
              id: 'text',
              type: 'shape',
              position: { x: 0, y: 0 },
              data: { shapeType: 'text' },
            },
            { id: 'frame', type: 'frame', position: { x: 0, y: 0 }, data: {} },
          ],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      },
    })

    const [box, text, frame] = doc!.boards.lld.nodes
    expect(box).not.toHaveProperty('connectable')
    expect(text).toHaveProperty('connectable', false)
    expect(frame).toHaveProperty('connectable', false)
  })
})

describe('handle migration', () => {
  const doc = (hldEdges: unknown[], lldEdges: unknown[] = []) =>
    migrateDocument({
      activeBoard: 'hld',
      boards: {
        hld: {
          diagramId: 'd1',
          diagramName: 'H',
          nodes: [],
          edges: hldEdges,
          viewport: { x: 0, y: 0, zoom: 1 },
        },
        lld: {
          diagramId: 'd2',
          diagramName: 'L',
          nodes: [],
          edges: lldEdges,
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      },
    })

  // Architecture nodes briefly had paired handles per side. An edge still
  // pointing at `t-in` would reference a handle that no longer exists and stop
  // rendering with no error.
  it('rewrites legacy -in handles on HLD edges', () => {
    const result = doc([
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'r', targetHandle: 'l-in' },
    ])
    expect(result!.boards.hld.edges[0]).toMatchObject({
      sourceHandle: 'r',
      targetHandle: 'l',
    })
  })

  it('rewrites every side', () => {
    const result = doc(
      (['t', 'r', 'b', 'l'] as const).map((side, i) => ({
        id: `e${i}`,
        source: 'a',
        target: 'b',
        targetHandle: `${side}-in`,
      }))
    )
    expect(result!.boards.hld.edges.map((e) => e.targetHandle)).toEqual(['t', 'r', 'b', 'l'])
  })

  it('leaves already-correct and absent handles untouched', () => {
    const result = doc([
      { id: 'e1', source: 'a', target: 'b', sourceHandle: 'r', targetHandle: 'l' },
      { id: 'e2', source: 'a', target: 'b' },
    ])
    expect(result!.boards.hld.edges[0]).toMatchObject({ targetHandle: 'l' })
    expect(result!.boards.hld.edges[1].targetHandle).toBeUndefined()
  })

  // Architecture nodes expose only `t`/`r`/`b`/`l`. Anything else cannot be
  // resolved, and keeping it leaves the endpoint collapsed at the origin — so an
  // id that merely looks handle-shaped is dropped rather than preserved.
  it('drops handle ids no node exposes, even if they look plausible', () => {
    const result = doc([{ id: 'e1', source: 'a', target: 'b', targetHandle: 'main-in' }])
    expect(result!.boards.hld.edges[0].targetHandle).toBeUndefined()
  })

  // The legacy LLD board still renders paired handles, so rewriting there would
  // repoint a target at a source.
  it('leaves the LLD board alone', () => {
    const result = doc([], [
      { id: 'l1', source: 'a', target: 'b', targetHandle: 't-in' },
    ])
    expect(result!.boards.lld.edges[0]).toMatchObject({ targetHandle: 't-in' })
  })
})

describe('unresolvable handle repair', () => {
  const hldEdge = (edge: Record<string, unknown>) =>
    migrateDocument({
      activeBoard: 'hld',
      boards: {
        hld: {
          diagramId: 'd1',
          diagramName: 'H',
          nodes: [],
          edges: [{ id: 'e1', source: 'a', target: 'b', ...edge }],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
        lld: {
          diagramId: 'd2',
          diagramName: 'L',
          nodes: [],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      },
    })!.boards.hld.edges[0]

  /**
   * The `body` handle covers a whole icon but only mounts while a connector
   * preset is armed. An edge that stored it loses its anchor the moment the
   * preset clears — React Flow cannot resolve the handle, so the endpoint
   * collapses toward the origin and the edge becomes a curve to nowhere.
   */
  it('drops the transient body handle so the edge can float', () => {
    const edge = hldEdge({ sourceHandle: 'body', targetHandle: 'l' })
    expect(edge.sourceHandle).toBeUndefined()
    expect(edge.targetHandle).toBe('l')
  })

  it('drops body on either end', () => {
    const edge = hldEdge({ sourceHandle: 'body', targetHandle: 'body' })
    expect(edge.sourceHandle).toBeUndefined()
    expect(edge.targetHandle).toBeUndefined()
  })

  it('drops any other id an architecture node never exposes', () => {
    const edge = hldEdge({ sourceHandle: 'left', targetHandle: 'some-old-id' })
    expect(edge.sourceHandle).toBeUndefined()
    expect(edge.targetHandle).toBeUndefined()
  })

  it('keeps the four real side handles', () => {
    for (const side of ['t', 'r', 'b', 'l'] as const) {
      expect(hldEdge({ sourceHandle: side }).sourceHandle, side).toBe(side)
    }
  })

  it('still folds paired -in ids down to their side', () => {
    expect(hldEdge({ targetHandle: 'b-in' }).targetHandle).toBe('b')
  })

  it('leaves an already-absent handle absent', () => {
    expect(hldEdge({}).sourceHandle).toBeUndefined()
  })
})

describe('edge routing', () => {
  // The notation table asks for orthogonal connectors. ArchitectureEdge used to
  // hardcode 'bezier' and ignore this, so every HLD edge rendered as a curve.
  it('routes every connection type orthogonally', () => {
    for (const type of CONNECTION_TYPES) {
      expect(HLD_NOTATION[type].path, type).toBe('smoothstep')
    }
  })

  const hldEdgeData = (data: Record<string, unknown>) =>
    migrateDocument({
      activeBoard: 'hld',
      boards: {
        hld: {
          diagramId: 'd1',
          diagramName: 'H',
          nodes: [],
          edges: [{ id: 'e1', source: 'a', target: 'b', data }],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
        lld: {
          diagramId: 'd2',
          diagramName: 'L',
          nodes: [],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      },
    })!.boards.hld.edges[0].data as Record<string, unknown> | undefined

  /**
   * Connections used to inherit the default edge preset, whose lineStyle was
   * 'bezier' — so the field recorded a default rather than a decision. Clearing
   * it lets the notation's routing apply.
   */
  it('clears an auto-stamped bezier so the notation default applies', () => {
    const data = hldEdgeData({ connectionType: 'synchronous', edgeLineStyle: 'bezier' })
    expect(data).not.toHaveProperty('edgeLineStyle')
    // Everything else on the edge survives.
    expect(data).toMatchObject({ connectionType: 'synchronous' })
  })

  it('preserves a routing the user actually chose', () => {
    for (const chosen of ['straight', 'step', 'smoothstep']) {
      expect(hldEdgeData({ edgeLineStyle: chosen })).toMatchObject({
        edgeLineStyle: chosen,
      })
    }
  })

  it('leaves an edge with no routing set alone', () => {
    expect(hldEdgeData({ protocol: 'HTTPS' })).toMatchObject({ protocol: 'HTTPS' })
  })
})
