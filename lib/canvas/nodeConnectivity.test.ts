import { describe, it, expect } from 'vitest'
import {
  isConnectableNode,
  normaliseNodeConnectable,
  normaliseNodesConnectable,
} from './nodeConnectivity'

/**
 * These guard a class of bug that fails silently: React Flow honours a per-node
 * `connectable: false` over the canvas-wide `nodesConnectable`, so a stale flag
 * in saved data makes a component permanently unwireable with no error shown.
 */

describe('isConnectableNode', () => {
  it('allows the real endpoint types', () => {
    for (const type of ['architecture', 'icon', 'lldClass', 'lldTable', 'lldActor']) {
      expect(isConnectableNode({ type }), type).toBe(true)
    }
  })

  it('rejects scenery', () => {
    for (const type of ['frame', 'lldBoundary', 'lldSwimlane', 'lldFragment', 'lldNote']) {
      expect(isConnectableNode({ type }), type).toBe(false)
    }
  })

  it('allows closed shapes but not linear or text ones', () => {
    expect(isConnectableNode({ type: 'shape', data: { shapeType: 'rectangle' } })).toBe(true)
    expect(isConnectableNode({ type: 'shape', data: { shapeType: 'cylinder' } })).toBe(true)
    expect(isConnectableNode({ type: 'shape', data: { shapeType: 'line' } })).toBe(false)
    expect(isConnectableNode({ type: 'shape', data: { shapeType: 'arrow' } })).toBe(false)
    expect(isConnectableNode({ type: 'shape', data: { shapeType: 'text' } })).toBe(false)
  })
})

describe('normaliseNodeConnectable', () => {
  // Absent means "defer to the canvas", which is what lets nodesConnectable
  // gate on the active tool. An explicit `true` would override that.
  it('strips a stale false from an endpoint node', () => {
    const out = normaliseNodeConnectable({ type: 'architecture', connectable: false })
    expect(out).not.toHaveProperty('connectable')
  })

  it('strips an explicit true as well, so the canvas stays in charge', () => {
    const out = normaliseNodeConnectable({ type: 'architecture', connectable: true })
    expect(out).not.toHaveProperty('connectable')
  })

  it('frees HLD shapes, which used to be spawned unconnectable', () => {
    const out = normaliseNodeConnectable({
      type: 'shape',
      data: { shapeType: 'triangle' },
      connectable: false,
    })
    expect(out).not.toHaveProperty('connectable')
  })

  it('pins scenery to false even when the flag is missing', () => {
    expect(normaliseNodeConnectable({ type: 'frame' })).toMatchObject({ connectable: false })
    expect(
      normaliseNodeConnectable({ type: 'shape', data: { shapeType: 'text' } })
    ).toMatchObject({ connectable: false })
  })

  it('is referentially stable when nothing needs changing', () => {
    const endpoint = { type: 'architecture' }
    expect(normaliseNodeConnectable(endpoint)).toBe(endpoint)

    const scenery = { type: 'frame', connectable: false as const }
    expect(normaliseNodeConnectable(scenery)).toBe(scenery)
  })
})

describe('normaliseNodesConnectable', () => {
  it('returns the same array when no node changes, so selectors do not fire', () => {
    const nodes = [{ type: 'architecture' }, { type: 'frame', connectable: false as const }]
    expect(normaliseNodesConnectable(nodes)).toBe(nodes)
  })

  it('fixes a whole board in one pass', () => {
    const nodes = [
      { type: 'architecture', connectable: false as const },
      { type: 'shape', data: { shapeType: 'triangle' }, connectable: false as const },
      { type: 'shape', data: { shapeType: 'line' }, connectable: false as const },
      { type: 'frame' },
    ]
    const out = normaliseNodesConnectable(nodes)

    expect(out[0]).not.toHaveProperty('connectable')
    expect(out[1]).not.toHaveProperty('connectable')
    expect(out[2]).toMatchObject({ connectable: false })
    expect(out[3]).toMatchObject({ connectable: false })
  })
})
