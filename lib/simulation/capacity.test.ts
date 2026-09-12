import { describe, it, expect } from 'vitest'
import {
  BOTTLENECK_QUEUE_DEPTH,
  CAPACITY_BY_CATEGORY,
  GENERIC_CAPACITY,
  MAX_CONCURRENCY,
  MAX_SERVICE_MS,
  bottleneckSeverity,
  expectedWaitMs,
  isBottleneck,
  nodeCapacity,
  utilisation,
} from './capacity'

describe('nodeCapacity', () => {
  it('uses the profile for the node category', () => {
    expect(nodeCapacity({ category: 'databases' })).toEqual(
      CAPACITY_BY_CATEGORY.databases
    )
  })

  it('falls back to the generic profile for an unprofiled or missing category', () => {
    expect(nodeCapacity({ category: 'patterns' })).toEqual(GENERIC_CAPACITY)
    expect(nodeCapacity({})).toEqual(GENERIC_CAPACITY)
    expect(nodeCapacity(null)).toEqual(GENERIC_CAPACITY)
    expect(nodeCapacity({ category: 42 })).toEqual(GENERIC_CAPACITY)
  })

  /**
   * The relative ordering is what makes a bottleneck findable at all: the store tier
   * has to be slower and narrower than the cache in front of it.
   */
  it('models stores as slower and narrower than caches', () => {
    const db = nodeCapacity({ category: 'databases' })
    const cache = nodeCapacity({ category: 'caching' })
    expect(db.serviceMs).toBeGreaterThan(cache.serviceMs)
    expect(db.concurrency).toBeLessThan(cache.concurrency)
  })

  it('models edge tiers as cheap and wide', () => {
    const lb = nodeCapacity({ category: 'networking' })
    const server = nodeCapacity({ category: 'compute' })
    expect(lb.serviceMs).toBeLessThan(server.serviceMs)
    expect(lb.concurrency).toBeGreaterThan(server.concurrency)
  })

  it('lets a node override either number', () => {
    expect(nodeCapacity({ category: 'databases', serviceMs: 5 })).toEqual({
      serviceMs: 5,
      concurrency: CAPACITY_BY_CATEGORY.databases!.concurrency,
    })
    expect(nodeCapacity({ category: 'databases', concurrency: 64 }).concurrency).toBe(64)
  })

  it('clamps overrides so one bad value cannot stall a run', () => {
    expect(nodeCapacity({ serviceMs: -100 }).serviceMs).toBe(0)
    expect(nodeCapacity({ serviceMs: 1e9 }).serviceMs).toBe(MAX_SERVICE_MS)
    expect(nodeCapacity({ concurrency: 0 }).concurrency).toBe(1)
    expect(nodeCapacity({ concurrency: 1e9 }).concurrency).toBe(MAX_CONCURRENCY)
  })

  it('ignores non-numeric overrides rather than producing NaN capacity', () => {
    expect(nodeCapacity({ serviceMs: '40' }).serviceMs).toBe(GENERIC_CAPACITY.serviceMs)
    expect(nodeCapacity({ serviceMs: Number.NaN }).serviceMs).toBe(GENERIC_CAPACITY.serviceMs)
  })
})

describe('utilisation', () => {
  it('is the busy fraction of total serving capacity', () => {
    // One server busy the whole window, out of four.
    expect(utilisation(1000, 1000, 4)).toBeCloseTo(0.25)
    // All four busy the whole window.
    expect(utilisation(4000, 1000, 4)).toBeCloseTo(1)
  })

  it('never exceeds 1 even if bookkeeping overshoots', () => {
    expect(utilisation(9999, 1000, 4)).toBe(1)
  })

  it('is zero for a node that never worked, or before any time passed', () => {
    expect(utilisation(0, 1000, 4)).toBe(0)
    expect(utilisation(500, 0, 4)).toBe(0)
  })

  it('treats a nonsense concurrency as a single server', () => {
    expect(utilisation(500, 1000, 0)).toBeCloseTo(0.5)
  })
})

describe('bottleneckSeverity', () => {
  // One request necessarily finds every server free, so it can never contend. This
  // is also why request-flow mode never flags anything.
  it('says nothing on too little traffic', () => {
    expect(bottleneckSeverity({ utilisation: 1, maxQueueDepth: 9, requestsIn: 1 })).toBe('none')
  })

  it('leaves a node with headroom alone', () => {
    expect(bottleneckSeverity({ utilisation: 0.3, maxQueueDepth: 0, requestsIn: 20 })).toBe('none')
    expect(isBottleneck({ utilisation: 0.3, maxQueueDepth: 0, requestsIn: 20 })).toBe(false)
  })

  it('flags a busy node', () => {
    expect(bottleneckSeverity({ utilisation: 0.75, maxQueueDepth: 0, requestsIn: 20 })).toBe('busy')
  })

  it('flags a saturated node', () => {
    expect(bottleneckSeverity({ utilisation: 0.95, maxQueueDepth: 0, requestsIn: 20 })).toBe(
      'saturated'
    )
  })

  // A burst can build a real queue while average utilisation still looks modest, and
  // waiting behind other requests is a bottleneck from the caller's point of view.
  it('flags on queue depth even when utilisation looks fine', () => {
    expect(
      bottleneckSeverity({
        utilisation: 0.2,
        maxQueueDepth: BOTTLENECK_QUEUE_DEPTH,
        requestsIn: 20,
      })
    ).toBe('busy')
    expect(
      bottleneckSeverity({
        utilisation: 0.2,
        maxQueueDepth: BOTTLENECK_QUEUE_DEPTH + 1,
        requestsIn: 20,
      })
    ).toBe('saturated')
  })
})

describe('expectedWaitMs', () => {
  it('is zero for an idle node', () => {
    expect(expectedWaitMs(40, 0)).toBe(0)
  })

  it('equals the service time at half utilisation', () => {
    expect(expectedWaitMs(40, 0.5)).toBeCloseTo(40)
  })

  // The knee: wait climbs steeply as the node runs out of headroom, which is the
  // whole reason a bottleneck matters.
  it('grows sharply as utilisation approaches 1', () => {
    expect(expectedWaitMs(40, 0.9)).toBeCloseTo(360)
    expect(expectedWaitMs(40, 0.95)).toBeGreaterThan(expectedWaitMs(40, 0.9))
  })

  it('stays finite at full utilisation rather than dividing by zero', () => {
    expect(Number.isFinite(expectedWaitMs(40, 1))).toBe(true)
  })

  it('is zero when there is no service time to wait for', () => {
    expect(expectedWaitMs(0, 0.9)).toBe(0)
  })
})
