import { describe, it, expect } from 'vitest'
import {
  componentRegistry,
  getAllCategories,
  getAllProviders,
  getComponentById,
  getComponentsByCategory,
  getComponentsByProvider,
  searchComponents,
} from './index'

describe('the registry', () => {
  it('is not empty', () => {
    expect(componentRegistry.length).toBeGreaterThan(100)
  })

  /** Ids are the DSL's vocabulary and are stored in every saved document. */
  it('has unique ids', () => {
    const ids = componentRegistry.map((c) => c.id)
    const seen = new Set<string>()
    const duplicates = ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)))
    expect(duplicates).toEqual([])
  })

  it('gives every component the fields the canvas renders', () => {
    for (const component of componentRegistry) {
      expect(component.id).toBeTruthy()
      expect(component.name).toBeTruthy()
      expect(component.category).toBeTruthy()
      expect(component.icon).toBeTruthy()
      expect(Array.isArray(component.tags)).toBe(true)
    }
  })

  it('points every icon at a plausible path', () => {
    for (const component of componentRegistry) {
      expect(component.icon.startsWith('/')).toBe(true)
      expect(component.icon.endsWith('.svg')).toBe(true)
    }
  })
})

describe('lookups', () => {
  it('finds a component by id', () => {
    expect(getComponentById('postgresql')?.category).toBe('databases')
    expect(getComponentById('load-balancer')?.name).toBe('Load Balancer')
  })

  it('returns undefined for an unknown id', () => {
    expect(getComponentById('not-a-component')).toBeUndefined()
  })

  it('returns a non-empty set for every category it reports', () => {
    for (const category of getAllCategories()) {
      expect(getComponentsByCategory(category).length).toBeGreaterThan(0)
    }
  })

  it('searches name, category, description and tags', () => {
    expect(searchComponents('redis').map((c) => c.id)).toContain('redis')
    expect(searchComponents('').length).toBe(componentRegistry.length)
  })
})

describe('providers', () => {
  /**
   * The library used to hardcode AWS, GCP, Azure and K8s as tabs while only AWS had any
   * components, so three of the four buttons did nothing but empty the panel. The tab list is
   * now derived from this function, which makes this the test that keeps it honest.
   */
  it('only reports providers that have components', () => {
    const reported = getAllProviders()
    expect(reported.length).toBeGreaterThan(0)

    for (const provider of reported) {
      expect(getComponentsByProvider(provider).length).toBeGreaterThan(0)
    }
  })

  it('reports no provider twice', () => {
    const reported = getAllProviders()
    expect(new Set(reported).size).toBe(reported.length)
  })

  it('returns nothing for a provider with no components', () => {
    // True today for gcp and azure. If either gains components this stops being vacuous and
    // the library grows the tab on its own.
    const empty = (['gcp', 'azure'] as const).filter(
      (p) => getComponentsByProvider(p).length === 0
    )
    for (const provider of empty) {
      expect(getAllProviders()).not.toContain(provider)
    }
  })

  it('tags AWS components with the aws provider', () => {
    const aws = getComponentsByProvider('aws')
    expect(aws.length).toBeGreaterThan(0)
    for (const component of aws) {
      expect(component.provider).toBe('aws')
    }
  })
})
