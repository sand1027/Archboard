import { describe, it, expect } from 'vitest'
import {
  CONFIG_BY_CATEGORY,
  CONFIG_BY_COMPONENT,
  configFieldsFor,
  configGroupsFor,
  fieldDriving,
} from './fields'
import { INSTANCE_TYPE_IDS, findInstanceType, instanceTypeLabel } from './instanceTypes'

describe('configGroupsFor', () => {
  const keysFor = (componentId: unknown, category: unknown) =>
    configFieldsFor(componentId, category).map((f) => f.key)

  /**
   * The whole point: a database and a balancer are not configured the same way, so one
   * shared set of fields was a placeholder.
   */
  it('gives a database an engine and a connection pool', () => {
    const keys = keysFor('postgresql', 'databases')
    expect(keys).toContain('engine')
    expect(keys).toContain('connectionPool')
    expect(keys).toContain('storageGb')
  })

  it('gives a load balancer an algorithm and health checks', () => {
    const keys = keysFor('load-balancer', 'load-balancing')
    expect(keys).toContain('algorithm')
    expect(keys).toContain('healthCheckSeconds')
    expect(keys).not.toContain('engine')
  })

  it('gives a cache an eviction policy', () => {
    expect(keysFor('redis', 'caching')).toContain('evictionPolicy')
  })

  it('gives a queue partitions and a delivery guarantee', () => {
    const keys = keysFor('message-queue', 'messaging')
    expect(keys).toContain('partitions')
    expect(keys).toContain('deliveryGuarantee')
  })

  it('adds component specifics on top of the category', () => {
    const keys = keysFor('aws-ec2', 'compute')
    // Its own fields.
    expect(keys).toContain('ami')
    expect(keys).toContain('ebsGb')
    // Plus the compute category's.
    expect(keys).toContain('instanceType')
    expect(keys).toContain('autoscaling')
  })

  it('puts component specifics before category fields', () => {
    const keys = keysFor('aws-ec2', 'compute')
    expect(keys.indexOf('ami')).toBeLessThan(keys.indexOf('autoscaling'))
  })

  // Otherwise a component override could be silently shadowed by its category.
  it('does not duplicate a key defined in both places', () => {
    const keys = keysFor('aws-lambda', 'compute')
    expect(keys.filter((k) => k === 'runtime')).toHaveLength(1)
  })

  it('always offers deployment fields, even for an unknown component', () => {
    const groups = configGroupsFor('nothing-real', 'patterns')
    expect(groups.map((g) => g.title)).toContain('Deployment')
    expect(configFieldsFor('nothing-real', 'patterns').map((f) => f.key)).toContain('region')
  })

  it('skips the Configuration group when a category has no schema', () => {
    expect(configGroupsFor(undefined, 'patterns').map((g) => g.title)).toEqual(['Deployment'])
  })

  it('every field declares a usable type', () => {
    for (const fields of [
      ...Object.values(CONFIG_BY_CATEGORY),
      ...Object.values(CONFIG_BY_COMPONENT),
    ]) {
      for (const field of fields ?? []) {
        expect(['number', 'text', 'select', 'boolean']).toContain(field.type)
        expect(field.key).toMatch(/^[a-zA-Z][a-zA-Z0-9]*$/)
        if (field.type === 'select') expect(field.options?.length ?? 0).toBeGreaterThan(0)
      }
    }
  })
})

describe('fieldDriving', () => {
  it('finds the field that caps a database', () => {
    expect(fieldDriving('postgresql', 'databases', 'concurrency')?.key).toBe('connectionPool')
  })

  it('finds the sizing field where an instance type applies', () => {
    expect(fieldDriving('aws-ec2', 'compute', 'sizing')?.key).toBe('instanceType')
  })

  it('returns nothing when no field drives that input', () => {
    expect(fieldDriving(undefined, 'observability', 'concurrency')).toBeUndefined()
  })
})

describe('instance types', () => {
  it('resolves a known type to its hardware', () => {
    expect(findInstanceType('m5.large')).toMatchObject({ vcpu: 2, memoryGb: 8 })
    expect(findInstanceType('r5.2xlarge')).toMatchObject({ vcpu: 8, memoryGb: 64 })
  })

  it('returns nothing for an unknown or non-string id', () => {
    expect(findInstanceType('m9.enormous')).toBeUndefined()
    expect(findInstanceType(42)).toBeUndefined()
    expect(findInstanceType(undefined)).toBeUndefined()
  })

  it('offers every catalogue id as an option', () => {
    expect(INSTANCE_TYPE_IDS).toContain('t3.medium')
    expect(INSTANCE_TYPE_IDS.length).toBeGreaterThan(10)
  })

  // Memory-optimised types must actually have more RAM per core, or picking one would
  // quietly do the opposite of what the user intended.
  it('gives memory-optimised types more RAM per core than compute-optimised', () => {
    const memory = findInstanceType('r5.xlarge')!
    const compute = findInstanceType('c5.xlarge')!
    expect(memory.memoryGb / memory.vcpu).toBeGreaterThan(compute.memoryGb / compute.vcpu)
  })

  it('labels a type with its hardware', () => {
    expect(instanceTypeLabel(findInstanceType('m5.large')!)).toBe('m5.large — 2 vCPU, 8 GB')
  })
})
