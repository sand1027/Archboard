import { describe, it, expect } from 'vitest'
import { nodeBounds, nodeSize, centerInside, isContainerNode, boundsOf, snap } from './geometry'

const at = (x: number, y: number) => ({ position: { x, y } })

describe('nodeBounds fallback chain', () => {
  it('prefers explicit width/height', () => {
    const b = nodeBounds({
      ...at(0, 0),
      width: 10,
      height: 20,
      measured: { width: 99, height: 99 },
      style: { width: 77, height: 77 },
    })
    expect([b.w, b.h]).toEqual([10, 20])
  })

  it('falls back to measured', () => {
    const b = nodeBounds({
      ...at(0, 0),
      measured: { width: 30, height: 40 },
      style: { width: 77, height: 77 },
    })
    expect([b.w, b.h]).toEqual([30, 40])
  })

  it('falls back to numeric style', () => {
    const b = nodeBounds({ ...at(0, 0), style: { width: 50, height: 60 } })
    expect([b.w, b.h]).toEqual([50, 60])
  })

  it('ignores non-numeric style values', () => {
    const b = nodeBounds({ ...at(0, 0), style: { width: '100%', height: 'auto' } })
    expect([b.w, b.h]).toEqual([100, 80])
  })

  it('falls back to defaults when nothing is known', () => {
    const b = nodeBounds(at(5, 6))
    expect(b).toEqual({ x: 5, y: 6, w: 100, h: 80 })
  })

  it('nodeSize returns just the size', () => {
    expect(nodeSize({ ...at(3, 4), width: 8, height: 9 })).toEqual({ w: 8, h: 9 })
  })
})

describe('centerInside', () => {
  const parent = { x: 0, y: 0, w: 100, h: 100 }

  it('is true when the centre falls inside', () => {
    expect(centerInside({ ...at(40, 40), width: 20, height: 20 }, parent)).toBe(true)
  })

  it('is false when the centre falls outside even if the box overlaps', () => {
    expect(centerInside({ ...at(95, 95), width: 40, height: 40 }, parent)).toBe(false)
  })

  it('includes the boundary', () => {
    expect(centerInside({ ...at(90, 90), width: 20, height: 20 }, parent)).toBe(true)
  })
})

describe('isContainerNode', () => {
  it('treats frames, swimlanes and fragments as containers', () => {
    expect(isContainerNode({ type: 'frame' })).toBe(true)
    expect(isContainerNode({ type: 'lldSwimlane' })).toBe(true)
    expect(isContainerNode({ type: 'lldFragment' })).toBe(true)
  })

  it('treats closed shapes as containers but linear/text ones not', () => {
    expect(isContainerNode({ type: 'shape', data: { shapeType: 'rectangle' } })).toBe(true)
    expect(isContainerNode({ type: 'shape', data: { shapeType: 'line' } })).toBe(false)
    expect(isContainerNode({ type: 'shape', data: { shapeType: 'arrow' } })).toBe(false)
    expect(isContainerNode({ type: 'shape', data: { shapeType: 'text' } })).toBe(false)
  })

  it('is false for ordinary nodes', () => {
    expect(isContainerNode({ type: 'lldClass' })).toBe(false)
  })
})

describe('boundsOf', () => {
  it('returns null for an empty list', () => {
    expect(boundsOf([])).toBeNull()
  })

  it('unions the boxes', () => {
    const r = boundsOf([
      { ...at(0, 0), width: 10, height: 10 },
      { ...at(90, 40), width: 10, height: 10 },
    ])
    expect(r).toEqual({ x: 0, y: 0, w: 100, h: 50 })
  })
})

describe('snap', () => {
  it('snaps to the nearest multiple', () => {
    expect(snap(17, 16)).toBe(16)
    expect(snap(25, 16)).toBe(32)
  })

  it('is a no-op for a non-positive grid', () => {
    expect(snap(17, 0)).toBe(17)
  })
})
