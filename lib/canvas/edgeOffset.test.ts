import { describe, it, expect } from 'vitest'
import {
  curveThrough,
  hasOffset,
  naturalMidpoint,
  nextOffset,
  offsetMidpoint,
  polylineThrough,
  screenDeltaToFlow,
} from './edgeOffset'

const points = { sourceX: 0, sourceY: 0, targetX: 200, targetY: 100 }

describe('hasOffset', () => {
  it('ignores absent and zero offsets', () => {
    expect(hasOffset(undefined)).toBe(false)
    expect(hasOffset(null)).toBe(false)
    expect(hasOffset({ x: 0, y: 0 })).toBe(false)
  })

  it('ignores sub-pixel jitter so a click does not register as a drag', () => {
    expect(hasOffset({ x: 1, y: 0 })).toBe(false)
  })

  it('accepts a real nudge on either axis', () => {
    expect(hasOffset({ x: 40, y: 0 })).toBe(true)
    expect(hasOffset({ x: 0, y: -40 })).toBe(true)
  })

  it('rejects non-finite values rather than producing NaN paths', () => {
    expect(hasOffset({ x: Number.NaN, y: 0 })).toBe(false)
    expect(hasOffset({ x: Infinity, y: 0 })).toBe(false)
  })
})

describe('midpoints', () => {
  it('places the natural midpoint between the endpoints', () => {
    expect(naturalMidpoint(points)).toEqual({ x: 100, y: 50 })
  })

  it('shifts by the offset', () => {
    expect(offsetMidpoint(points, { x: 30, y: -10 })).toEqual({ x: 130, y: 40 })
  })

  it('falls back to the natural midpoint when there is no offset', () => {
    expect(offsetMidpoint(points, undefined)).toEqual({ x: 100, y: 50 })
    expect(offsetMidpoint(points, { x: 0, y: 0 })).toEqual({ x: 100, y: 50 })
  })
})

describe('curveThrough', () => {
  /**
   * The curve must pass through the dragged point, not merely lean toward it —
   * otherwise the grab handle drifts off the line it is supposed to control.
   */
  it('passes exactly through the requested point at its midpoint', () => {
    const through = { x: 160, y: 20 }
    const d = curveThrough(points, through)

    const [, cx, cy] = /Q ([-\d.]+),([-\d.]+)/.exec(d)!.map(Number) as unknown as number[]
    // Quadratic at t=0.5 is (start + 2·control + end) / 4.
    const midX = (points.sourceX + 2 * cx + points.targetX) / 4
    const midY = (points.sourceY + 2 * cy + points.targetY) / 4

    expect(midX).toBeCloseTo(through.x)
    expect(midY).toBeCloseTo(through.y)
  })

  it('degenerates to a straight line through the natural midpoint', () => {
    const d = curveThrough(points, naturalMidpoint(points))
    const [, cx, cy] = /Q ([-\d.]+),([-\d.]+)/.exec(d)!.map(Number) as unknown as number[]
    // Control point lands on the line, so the curve is visually straight.
    expect(cx).toBeCloseTo(100)
    expect(cy).toBeCloseTo(50)
  })

  it('starts and ends at the endpoints', () => {
    const d = curveThrough(points, { x: 160, y: 20 })
    expect(d.startsWith('M 0,0')).toBe(true)
    expect(d.endsWith('200,100')).toBe(true)
  })
})

describe('polylineThrough', () => {
  // The orthogonal routings must not gain curvature just because they were
  // nudged; a bend is expected, a bow is not.
  it('bends at the dragged point with straight segments', () => {
    expect(polylineThrough(points, { x: 160, y: 20 })).toBe('M 0,0 L 160,20 L 200,100')
  })

  it('is collinear when the bend sits on the natural midpoint', () => {
    expect(polylineThrough(points, naturalMidpoint(points))).toBe('M 0,0 L 100,50 L 200,100')
  })
})

describe('screenDeltaToFlow', () => {
  it('divides by zoom so a drag tracks the cursor when zoomed', () => {
    expect(screenDeltaToFlow(100, 50, 2)).toEqual({ x: 50, y: 25 })
    expect(screenDeltaToFlow(100, 50, 0.5)).toEqual({ x: 200, y: 100 })
  })

  it('treats a zero or negative zoom as 1 rather than dividing by zero', () => {
    expect(screenDeltaToFlow(10, 10, 0)).toEqual({ x: 10, y: 10 })
  })
})

describe('nextOffset', () => {
  it('accumulates onto the existing offset', () => {
    expect(nextOffset({ x: 20, y: 0 }, { x: 15, y: 5 })).toEqual({ x: 35, y: 5 })
  })

  it('starts from zero when there is no current offset', () => {
    expect(nextOffset(undefined, { x: 25, y: 0 })).toEqual({ x: 25, y: 0 })
  })

  // Dragging a line back to where it started should leave no residue in the
  // saved document.
  it('clears the offset when dragged back to the midpoint', () => {
    expect(nextOffset({ x: 30, y: 0 }, { x: -30, y: 0 })).toBeUndefined()
  })
})
