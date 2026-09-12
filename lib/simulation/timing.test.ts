import { describe, it, expect } from 'vitest'
import {
  BASE_HOP_MS,
  MAX_HOP_MS,
  MIN_HOP_MS,
  REFERENCE_LENGTH_PX,
  advanceProgress,
  dispatchIntervalMs,
  hopDurationMs,
  hopLatencyMs,
  packetTrail,
} from './timing'

describe('hopDurationMs', () => {
  it('takes the base duration at the reference length and 1x speed', () => {
    expect(hopDurationMs({ lengthPx: REFERENCE_LENGTH_PX, speedMultiplier: 1 })).toBe(BASE_HOP_MS)
  })

  /**
   * The regression this whole module exists for: a hop has to last long enough to
   * be seen. At 60fps, anything under ~100ms is a handful of frames.
   */
  it('lasts long enough to be visible across the plausible range of edges', () => {
    for (const lengthPx of [60, 120, 240, 600, 1400]) {
      const ms = hopDurationMs({ lengthPx, speedMultiplier: 1 })
      expect(ms).toBeGreaterThan(300)
    }
  })

  it('scales sub-linearly with length so long edges do not crawl', () => {
    const short = hopDurationMs({ lengthPx: REFERENCE_LENGTH_PX, speedMultiplier: 1 })
    const long = hopDurationMs({ lengthPx: REFERENCE_LENGTH_PX * 4, speedMultiplier: 1 })
    expect(long).toBeGreaterThan(short)
    // Four times the distance, twice the time — not four times.
    expect(long).toBeCloseTo(short * 2, 5)
  })

  it('speeds up as the multiplier rises', () => {
    const normal = hopDurationMs({ lengthPx: REFERENCE_LENGTH_PX, speedMultiplier: 1 })
    const fast = hopDurationMs({ lengthPx: REFERENCE_LENGTH_PX, speedMultiplier: 4 })
    expect(fast).toBeLessThan(normal)
    expect(fast).toBeCloseTo(normal / 4, 5)
  })

  it('slows a marked edge by its factor', () => {
    const normal = hopDurationMs({ lengthPx: REFERENCE_LENGTH_PX, speedMultiplier: 1 })
    const slow = hopDurationMs({ lengthPx: REFERENCE_LENGTH_PX, speedMultiplier: 1, slowFactor: 3 })
    expect(slow).toBeCloseTo(normal * 3, 5)
  })

  it('clamps to the guard rails', () => {
    expect(hopDurationMs({ lengthPx: 1, speedMultiplier: 100 })).toBe(MIN_HOP_MS)
    expect(hopDurationMs({ lengthPx: 1e7, speedMultiplier: 1, slowFactor: 50 })).toBe(MAX_HOP_MS)
  })

  it('falls back to sane values for junk input rather than producing NaN', () => {
    expect(hopDurationMs({ lengthPx: 0, speedMultiplier: 0 })).toBe(BASE_HOP_MS)
    expect(hopDurationMs({ lengthPx: Number.NaN, speedMultiplier: Number.NaN })).toBe(BASE_HOP_MS)
    expect(hopDurationMs({ lengthPx: -50, speedMultiplier: -2 })).toBe(BASE_HOP_MS)
  })
})

describe('advanceProgress', () => {
  it('advances by the fraction of the duration elapsed', () => {
    expect(advanceProgress(0, 100, 1000)).toBeCloseTo(0.1)
    expect(advanceProgress(0.5, 250, 1000)).toBeCloseTo(0.75)
  })

  it('clamps at 1 so a packet never overshoots the end of its edge', () => {
    expect(advanceProgress(0.9, 5000, 1000)).toBe(1)
  })

  it('treats a zero duration as immediate arrival instead of dividing to Infinity', () => {
    expect(advanceProgress(0, 16, 0)).toBe(1)
    expect(advanceProgress(0, 16, -100)).toBe(1)
  })

  it('holds position when no time has passed', () => {
    expect(advanceProgress(0.4, 0, 1000)).toBe(0.4)
  })
})

describe('hopLatencyMs', () => {
  // Reported numbers must not move when the user drags the speed slider, so this
  // takes no multiplier at all.
  it('reports the base latency for a normal edge', () => {
    expect(hopLatencyMs(20, false, 3)).toBe(20)
  })

  it('multiplies by the slow factor for a degraded edge', () => {
    expect(hopLatencyMs(20, true, 3)).toBe(60)
  })

  it('ignores a nonsense slow factor', () => {
    expect(hopLatencyMs(20, true, 0)).toBe(20)
  })
})

describe('dispatchIntervalMs', () => {
  it('sends requests closer together as speed rises', () => {
    expect(dispatchIntervalMs(1)).toBe(BASE_HOP_MS)
    expect(dispatchIntervalMs(2)).toBe(BASE_HOP_MS / 2)
  })

  it('never busy-loops at extreme speeds', () => {
    expect(dispatchIntervalMs(1000)).toBe(80)
  })
})

describe('packetTrail', () => {
  it('always yields a fully opaque head at the packet position', () => {
    const [head] = packetTrail(0.6)
    expect(head).toEqual({ t: 0.6, scale: 1, opacity: 1 })
  })

  it('trails behind the head at the configured gap', () => {
    const dots = packetTrail(0.5, 3, 0.1)
    expect(dots).toHaveLength(4)
    ;[0.5, 0.4, 0.3, 0.2].forEach((expected, i) => {
      expect(dots[i].t).toBeCloseTo(expected)
    })
  })

  it('fades and shrinks along the tail', () => {
    const dots = packetTrail(0.9, 3, 0.1)
    const opacities = dots.map((d) => d.opacity)
    const scales = dots.map((d) => d.scale)
    expect(opacities).toEqual([...opacities].sort((a, b) => b - a))
    expect(scales).toEqual([...scales].sort((a, b) => b - a))
    expect(opacities[opacities.length - 1]).toBeGreaterThan(0)
  })

  // Clamping instead of dropping would stack the whole tail on the source node
  // for the first frames of every hop.
  it('drops tail dots that fall before the start of the edge', () => {
    expect(packetTrail(0.08, 4, 0.05).map((d) => d.t)).toEqual([0.08, 0.03])
    expect(packetTrail(0, 4, 0.05)).toHaveLength(1)
  })

  it('keeps the head inside the edge for out-of-range progress', () => {
    expect(packetTrail(1.5)[0].t).toBe(1)
    expect(packetTrail(-1)[0].t).toBe(0)
    expect(packetTrail(Number.NaN)[0].t).toBe(0)
  })
})
