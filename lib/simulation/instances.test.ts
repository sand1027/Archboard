import { describe, it, expect } from 'vitest'
import {
  DEFAULT_INSTANCE_PROFILE,
  PROFILE_BY_CATEGORY,
  TIGHT_UTILISATION,
  concurrencyPerInstance,
  configuredConcurrencyLimit,
  derivedConcurrency,
  hasInstanceConfig,
  instanceProfile,
  requiredConcurrency,
  requiredInstances,
  sizing,
  totalMemoryGb,
  totalVcpu,
} from './instances'

describe('instanceProfile', () => {
  it('falls back to a general-purpose instance', () => {
    expect(instanceProfile({})).toEqual(DEFAULT_INSTANCE_PROFILE)
    expect(instanceProfile(null)).toEqual(DEFAULT_INSTANCE_PROFILE)
  })

  it('uses the category profile where one exists', () => {
    const db = instanceProfile({ category: 'databases' })
    expect(db.vcpu).toBe(PROFILE_BY_CATEGORY.databases!.vcpu)
    expect(db.memoryGb).toBe(PROFILE_BY_CATEGORY.databases!.memoryGb)
  })

  /**
   * The relative shape has to match how these tiers are really run, or the sizing advice
   * will be nonsense: stateless tiers scale out, datastores scale up.
   */
  it('models stateless tiers as many small boxes and stores as few large ones', () => {
    const service = instanceProfile({ category: 'services' })
    const db = instanceProfile({ category: 'databases' })
    expect(service.instances).toBeGreaterThan(db.instances)
    expect(db.vcpu).toBeGreaterThan(service.vcpu)
    expect(db.memoryGb).toBeGreaterThan(service.memoryGb)
  })

  it('gives caches memory over cores', () => {
    const cache = instanceProfile({ category: 'caching' })
    expect(cache.memoryGb).toBeGreaterThan(DEFAULT_INSTANCE_PROFILE.memoryGb)
  })

  it('lets a node override any field', () => {
    const profile = instanceProfile({ category: 'databases', instances: 6, vcpu: 16, memoryGb: 64 })
    expect(profile).toMatchObject({ instances: 6, vcpu: 16, memoryGb: 64 })
  })

  it('clamps nonsense rather than propagating it', () => {
    expect(instanceProfile({ instances: 0 }).instances).toBe(1)
    expect(instanceProfile({ instances: -5 }).instances).toBe(1)
    expect(instanceProfile({ vcpu: 0 }).vcpu).toBe(1)
    expect(instanceProfile({ concurrencyPerVcpu: 0 }).concurrencyPerVcpu).toBe(1)
  })

  it('ignores non-numeric values', () => {
    expect(instanceProfile({ instances: '4' }).instances).toBe(DEFAULT_INSTANCE_PROFILE.instances)
    expect(instanceProfile({ vcpu: Number.NaN }).vcpu).toBe(DEFAULT_INSTANCE_PROFILE.vcpu)
  })
})

describe('hasInstanceConfig', () => {
  it('detects any explicit sizing', () => {
    expect(hasInstanceConfig({ instances: 3 })).toBe(true)
    expect(hasInstanceConfig({ vcpu: 8 })).toBe(true)
    expect(hasInstanceConfig({ memoryGb: 16 })).toBe(true)
    expect(hasInstanceConfig({ category: 'databases' })).toBe(false)
    expect(hasInstanceConfig(undefined)).toBe(false)
  })
})

describe('derived capacity', () => {
  const profile = { instances: 3, vcpu: 2, memoryGb: 4, concurrencyPerVcpu: 4 }

  it('derives concurrency from cores rather than taking it separately', () => {
    expect(concurrencyPerInstance(profile)).toBe(8)
    expect(derivedConcurrency(profile)).toBe(24)
  })

  it('totals hardware across the tier', () => {
    expect(totalVcpu(profile)).toBe(6)
    expect(totalMemoryGb(profile)).toBe(12)
  })

  it('never derives zero concurrency', () => {
    expect(derivedConcurrency({ ...profile, instances: 1, vcpu: 1, concurrencyPerVcpu: 1 })).toBe(1)
  })

  it('scales linearly with instances', () => {
    const one = derivedConcurrency({ ...profile, instances: 1 })
    expect(derivedConcurrency({ ...profile, instances: 4 })).toBe(one * 4)
  })
})

describe("requiredConcurrency (Little's Law)", () => {
  /** 1,000 req/s at 40ms each means 40 requests in flight at any moment. */
  it('is arrival rate times service time', () => {
    expect(requiredConcurrency(1000, 40)).toBeCloseTo(40)
    expect(requiredConcurrency(11_574, 10)).toBeCloseTo(115.74)
  })

  it('is zero without load or without service time', () => {
    expect(requiredConcurrency(0, 40)).toBe(0)
    expect(requiredConcurrency(1000, 0)).toBe(0)
    expect(requiredConcurrency(Number.NaN, 40)).toBe(0)
  })
})

describe('requiredInstances', () => {
  const profile = { instances: 1, vcpu: 2, memoryGb: 4, concurrencyPerVcpu: 4 }

  // You cannot run 3.2 instances, and rounding down would under-provision.
  it('rounds up', () => {
    // 1000 req/s × 40ms = 40 concurrency; 8 per instance → 5 instances.
    expect(requiredInstances(1000, 40, profile)).toBe(5)
    // 41 concurrency still needs 6.
    expect(requiredInstances(1025, 40, profile)).toBe(6)
  })

  it('needs nothing without load', () => {
    expect(requiredInstances(0, 40, profile)).toBe(0)
  })

  it('needs fewer bigger boxes', () => {
    const big = { ...profile, vcpu: 16 }
    expect(requiredInstances(1000, 40, big)).toBeLessThan(requiredInstances(1000, 40, profile))
  })
})

describe('sizing', () => {
  const profile = { instances: 5, vcpu: 2, memoryGb: 4, concurrencyPerVcpu: 4 }

  it('reports comfortable headroom as ok', () => {
    const result = sizing(100, 40, profile)
    expect(result.verdict).toBe('ok')
    expect(result.provided).toBe(40)
    expect(result.required).toBeCloseTo(4)
  })

  /**
   * A tier sized exactly to its average has no room for a spike, a deploy, or losing an
   * instance — and queue wait climbs steeply as utilisation approaches 1.
   */
  it('warns before the tier is actually full', () => {
    const atThreshold = sizing((TIGHT_UTILISATION * 40 * 1000) / 40, 40, profile)
    expect(atThreshold.utilisation).toBeCloseTo(TIGHT_UTILISATION)
    expect(atThreshold.verdict).toBe('tight')
  })

  it('flags a tier that cannot keep up', () => {
    const result = sizing(2000, 40, profile)
    expect(result.verdict).toBe('under')
    expect(result.utilisation).toBeGreaterThan(1)
    expect(result.requiredInstances).toBeGreaterThan(result.configuredInstances)
  })

  it('says nothing about a tier with no load', () => {
    expect(sizing(0, 40, profile).verdict).toBe('idle')
  })

  // The number someone can act on: how many more do I need?
  it('reports required against configured instances', () => {
    const result = sizing(2000, 40, profile)
    expect(result.configuredInstances).toBe(5)
    expect(result.requiredInstances).toBe(10)
  })
})

describe('instance type from component config', () => {
  /**
   * Picking a machine is how people size a tier — nobody thinks "6 vCPU", they think
   * "three m5.large". Selecting a type has to actually move the hardware.
   */
  it('takes vCPU and RAM from the chosen instance type', () => {
    const profile = instanceProfile({
      category: 'compute',
      config: { instanceType: 'r5.2xlarge' },
    })
    expect(profile.vcpu).toBe(8)
    expect(profile.memoryGb).toBe(64)
  })

  it('counts as explicit sizing, so it reaches the simulation', () => {
    expect(hasInstanceConfig({ config: { instanceType: 'm5.large' } })).toBe(true)
    expect(hasInstanceConfig({ config: { instanceType: 'not-a-machine' } })).toBe(false)
  })

  it('lets typed-in numbers beat the instance type', () => {
    const profile = instanceProfile({
      category: 'compute',
      config: { instanceType: 't3.micro' },
      vcpu: 32,
    })
    expect(profile.vcpu).toBe(32)
    // Untouched fields still follow the machine.
    expect(profile.memoryGb).toBe(1)
  })

  it('ignores an unknown instance type', () => {
    const profile = instanceProfile({ category: 'compute', config: { instanceType: 'zz.huge' } })
    expect(profile.vcpu).toBe(PROFILE_BY_CATEGORY.compute!.vcpu)
  })
})

describe('configuredConcurrencyLimit', () => {
  it('reads a database connection pool', () => {
    expect(configuredConcurrencyLimit({ config: { connectionPool: 20 } })).toBe(20)
  })

  it('reads the other declared ceilings', () => {
    expect(configuredConcurrencyLimit({ config: { maxConnections: 500 } })).toBe(500)
    expect(configuredConcurrencyLimit({ config: { partitions: 12 } })).toBe(12)
    expect(configuredConcurrencyLimit({ config: { reservedConcurrency: 50 } })).toBe(50)
  })

  // They compound rather than override, so the tightest one is the real ceiling.
  it('takes the smallest when several are set', () => {
    expect(
      configuredConcurrencyLimit({ config: { connectionPool: 100, maxConnections: 30 } })
    ).toBe(30)
  })

  it('is undefined when nothing is declared', () => {
    expect(configuredConcurrencyLimit({ config: {} })).toBeUndefined()
    expect(configuredConcurrencyLimit({})).toBeUndefined()
    expect(configuredConcurrencyLimit(undefined)).toBeUndefined()
  })

  it('ignores nonsense values', () => {
    expect(configuredConcurrencyLimit({ config: { connectionPool: 0 } })).toBeUndefined()
    expect(configuredConcurrencyLimit({ config: { connectionPool: '20' } })).toBeUndefined()
  })
})
