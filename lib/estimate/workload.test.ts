import { describe, it, expect } from 'vitest'
import type { WorkloadInputs } from '@/types/estimate'
import { DEFAULT_WORKLOAD, estimate, normaliseWorkload, peakQpsFrom } from './workload'

const KB = 1024

/** A round workload so the expected arithmetic is obvious by inspection. */
const ROUND: WorkloadInputs = {
  dau: 1_000_000,
  requestsPerUserPerDay: 10,
  peakFactor: 2,
  readsPerWrite: 9,
  requestKb: 1,
  responseKb: 2,
  storedPerWriteKb: 1,
  retentionDays: 100,
  replicationFactor: 3,
  compressionRatio: 1,
  cacheHitRate: 0.5,
  secondsPerDay: 100_000,
}

describe('normaliseWorkload', () => {
  it('fills in defaults for anything missing', () => {
    expect(normaliseWorkload({})).toEqual(DEFAULT_WORKLOAD)
    expect(normaliseWorkload(undefined)).toEqual(DEFAULT_WORKLOAD)
  })

  it('keeps supplied values', () => {
    expect(normaliseWorkload({ dau: 500 }).dau).toBe(500)
  })

  // A peak factor under 1 would make peak traffic quieter than average, and a zero
  // compression ratio divides storage to infinity.
  it('clamps values that would make the arithmetic meaningless', () => {
    expect(normaliseWorkload({ peakFactor: 0.1 }).peakFactor).toBe(1)
    expect(normaliseWorkload({ compressionRatio: 0 }).compressionRatio).toBe(0.01)
    expect(normaliseWorkload({ cacheHitRate: 5 }).cacheHitRate).toBe(1)
    expect(normaliseWorkload({ replicationFactor: 0 }).replicationFactor).toBe(1)
    expect(normaliseWorkload({ dau: -100 }).dau).toBe(0)
  })

  it('ignores non-numeric input rather than producing NaN', () => {
    expect(normaliseWorkload({ dau: Number.NaN }).dau).toBe(DEFAULT_WORKLOAD.dau)
  })
})

describe('estimate', () => {
  const { byId } = estimate(ROUND)

  it('derives daily traffic from users and their activity', () => {
    expect(byId['requests-per-day'].value).toBe(10_000_000)
  })

  it('spreads it over the day for the average', () => {
    expect(byId['avg-qps'].value).toBe(100)
  })

  it('applies the peak factor', () => {
    expect(byId['peak-qps'].value).toBe(200)
    expect(peakQpsFrom(estimate(ROUND))).toBe(200)
  })

  it('splits reads from writes by the ratio', () => {
    // 9 reads per write → one in ten requests is a write.
    expect(byId['write-qps'].value).toBeCloseTo(20)
    expect(byId['read-qps'].value).toBeCloseTo(180)
    expect(byId['writes-per-day'].value).toBeCloseTo(1_000_000)
  })

  it('takes the cache out of the read path', () => {
    expect(byId['origin-read-qps'].value).toBeCloseTo(90)
  })

  it('derives bandwidth from payload sizes at peak', () => {
    expect(byId.ingress.value).toBeCloseTo(200 * 1 * KB)
    expect(byId.egress.value).toBeCloseTo(200 * 2 * KB)
  })

  it('grows storage from writes only', () => {
    expect(byId['storage-per-day'].value).toBeCloseTo(1_000_000 * KB)
    expect(byId['storage-retained'].value).toBeCloseTo(1_000_000 * KB * 100 * 3)
  })

  it('divides stored size by the compression ratio', () => {
    const compressed = estimate({ ...ROUND, compressionRatio: 4 })
    expect(compressed.byId['storage-per-day'].value).toBeCloseTo((1_000_000 * KB) / 4)
  })

  it('treats an all-write workload as every request writing', () => {
    const writes = estimate({ ...ROUND, readsPerWrite: 0 })
    expect(writes.byId['write-qps'].value).toBeCloseTo(200)
    expect(writes.byId['read-qps'].value).toBeCloseTo(0)
  })

  it('never reports negative reads', () => {
    const { byId: b } = estimate({ ...ROUND, readsPerWrite: 0 })
    expect(b['read-qps'].value).toBeGreaterThanOrEqual(0)
  })
})

describe('shown working', () => {
  const { steps, byId } = estimate(ROUND)

  /**
   * The panel renders these, so the arithmetic has to be legible with real values in
   * it — an estimate nobody can check is an estimate nobody should trust.
   */
  it('substitutes real values into each formula', () => {
    expect(byId['requests-per-day'].formula).toBe('1M DAU × 10 req/user')
    expect(byId['avg-qps'].formula).toBe('10M ÷ 100K s')
    expect(byId['peak-qps'].formula).toBe('100 × 2 peak factor')
  })

  it('gives every step a label, a note and a unit', () => {
    for (const step of steps) {
      expect(step.label.length).toBeGreaterThan(0)
      expect(step.note.length).toBeGreaterThan(0)
      expect(step.unit).toBeTruthy()
    }
  })

  it('exposes every step by id and in order', () => {
    expect(steps).toHaveLength(11)
    expect(Object.keys(byId)).toHaveLength(11)
    expect(steps[0].id).toBe('requests-per-day')
    expect(steps[steps.length - 1].id).toBe('storage-retained')
  })
})

describe('overrides', () => {
  it('pins a value and reports it as overridden', () => {
    const { byId } = estimate(ROUND, { 'peak-qps': 5_000 })
    expect(byId['peak-qps'].value).toBe(5_000)
    expect(byId['peak-qps'].overridden).toBe(true)
    // The arithmetic is kept so the panel can show what was replaced.
    expect(byId['peak-qps'].computed).toBe(200)
  })

  /**
   * The reason overrides exist: the assumptions are the disputed part, not the
   * multiplication. Pinning peak QPS has to move everything derived from it.
   */
  it('propagates downstream', () => {
    const { byId } = estimate(ROUND, { 'peak-qps': 1_000 })
    expect(byId['write-qps'].value).toBeCloseTo(100)
    expect(byId['read-qps'].value).toBeCloseTo(900)
    expect(byId.egress.value).toBeCloseTo(1_000 * 2 * KB)
  })

  it('leaves untouched steps computed', () => {
    const { byId } = estimate(ROUND, { 'peak-qps': 1_000 })
    expect(byId['requests-per-day'].overridden).toBe(false)
    expect(byId['storage-per-day'].overridden).toBe(false)
  })

  // Storage comes from writes per day, not from peak, so pinning peak must not move it.
  it('does not disturb figures on a different branch of the derivation', () => {
    const base = estimate(ROUND)
    const pinned = estimate(ROUND, { 'peak-qps': 9_999 })
    expect(pinned.byId['storage-retained'].value).toBe(base.byId['storage-retained'].value)
  })

  it('ignores a non-finite pin', () => {
    const { byId } = estimate(ROUND, { 'peak-qps': Number.NaN })
    expect(byId['peak-qps'].value).toBe(200)
    expect(byId['peak-qps'].overridden).toBe(false)
  })

  it('allows pinning zero', () => {
    const { byId } = estimate(ROUND, { 'peak-qps': 0 })
    expect(byId['peak-qps'].value).toBe(0)
    expect(byId['peak-qps'].overridden).toBe(true)
  })
})
