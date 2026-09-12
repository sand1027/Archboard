import { describe, it, expect } from 'vitest'
import {
  clamp01,
  edgePathElement,
  isPathLike,
  lerpPoint,
  pointAlongEdge,
  pointOnPath,
  type PathLike,
  type Point,
} from './pathGeometry'

/** Stand-in for a rendered <path>: a straight horizontal line of `length`. */
function horizontalPath(length: number): PathLike {
  return {
    getTotalLength: () => length,
    getPointAtLength: (d) => ({ x: d, y: 0 }),
  }
}

describe('clamp01', () => {
  it('passes through values already in range', () => {
    expect(clamp01(0)).toBe(0)
    expect(clamp01(0.42)).toBe(0.42)
    expect(clamp01(1)).toBe(1)
  })

  it('clamps outside the range', () => {
    expect(clamp01(-3)).toBe(0)
    expect(clamp01(9)).toBe(1)
  })

  it('treats non-finite input as the start of the path', () => {
    expect(clamp01(Number.NaN)).toBe(0)
    expect(clamp01(Infinity)).toBe(1)
    expect(clamp01(-Infinity)).toBe(0)
  })
})

describe('lerpPoint', () => {
  const from: Point = { x: 0, y: 0 }
  const to: Point = { x: 100, y: 50 }

  it('interpolates between the endpoints', () => {
    expect(lerpPoint(from, to, 0)).toEqual({ x: 0, y: 0 })
    expect(lerpPoint(from, to, 0.5)).toEqual({ x: 50, y: 25 })
    expect(lerpPoint(from, to, 1)).toEqual({ x: 100, y: 50 })
  })

  it('never leaves the segment', () => {
    expect(lerpPoint(from, to, -1)).toEqual({ x: 0, y: 0 })
    expect(lerpPoint(from, to, 2)).toEqual({ x: 100, y: 50 })
  })
})

describe('isPathLike', () => {
  it('accepts an object exposing both geometry methods', () => {
    expect(isPathLike(horizontalPath(10))).toBe(true)
  })

  it('rejects anything missing the geometry API', () => {
    expect(isPathLike(null)).toBe(false)
    expect(isPathLike(undefined)).toBe(false)
    expect(isPathLike({})).toBe(false)
    expect(isPathLike({ getTotalLength: () => 1 })).toBe(false)
    expect(isPathLike('path')).toBe(false)
  })
})

describe('pointOnPath', () => {
  it('samples proportionally along the path length', () => {
    const path = horizontalPath(200)
    expect(pointOnPath(path, 0)).toEqual({ x: 0, y: 0 })
    expect(pointOnPath(path, 0.25)).toEqual({ x: 50, y: 0 })
    expect(pointOnPath(path, 1)).toEqual({ x: 200, y: 0 })
  })

  it('clamps progress rather than sampling past the end', () => {
    expect(pointOnPath(horizontalPath(200), 5)).toEqual({ x: 200, y: 0 })
  })

  // A path that has not been laid out yet reports no length; drawing at the
  // origin would park every packet in the top-left corner of the canvas.
  it('returns null for a path with no length', () => {
    expect(pointOnPath(horizontalPath(0), 0.5)).toBeNull()
    expect(pointOnPath(horizontalPath(Number.NaN), 0.5)).toBeNull()
  })

  it('returns null when the browser hands back a non-finite point', () => {
    const broken: PathLike = {
      getTotalLength: () => 100,
      getPointAtLength: () => ({ x: Number.NaN, y: 0 }),
    }
    expect(pointOnPath(broken, 0.5)).toBeNull()
  })

  it('copies the point, since SVGPoint instances are live and reused', () => {
    const live = { x: 0, y: 0 }
    const path: PathLike = {
      getTotalLength: () => 100,
      getPointAtLength: (d) => {
        live.x = d
        return live
      },
    }
    const first = pointOnPath(path, 0.25)
    pointOnPath(path, 0.75)
    expect(first).toEqual({ x: 25, y: 0 })
  })
})

describe('edgePathElement / pointAlongEdge without a DOM', () => {
  // The test environment is node, which is exactly the SSR case: these must
  // degrade quietly instead of throwing on a missing `document`.
  it('returns null instead of throwing', () => {
    expect(edgePathElement('edge-1')).toBeNull()
    expect(pointAlongEdge('edge-1', 0.5)).toBeNull()
  })

  it('returns null for an empty id', () => {
    expect(edgePathElement('')).toBeNull()
  })
})
