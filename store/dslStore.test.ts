import { describe, it, expect, beforeEach } from 'vitest'
import { normalisePins, useDslStore } from './dslStore'

const store = () => useDslStore.getState()

beforeEach(() => {
  store().reset()
})

describe('source', () => {
  it('starts empty and disabled, so a drawn diagram is unaffected', () => {
    expect(store().source).toBe('')
    expect(store().enabled).toBe(false)
  })

  it('holds the source text', () => {
    store().setSource('server api "API"')
    expect(store().source).toBe('server api "API"')
  })

  it('records diagnostics for the editor gutter', () => {
    const diagnostic = {
      severity: 'error' as const,
      message: 'nope',
      span: {
        start: { offset: 0, line: 1, column: 1 },
        end: { offset: 4, line: 1, column: 5 },
      },
    }
    store().setDiagnostics([diagnostic])
    expect(store().diagnostics).toEqual([diagnostic])
  })
})

describe('pins', () => {
  it('records a position by DSL name', () => {
    store().pin('api', { x: 10, y: 20 })
    expect(store().pins).toEqual({ api: { x: 10, y: 20 } })
  })

  it('overwrites an existing pin', () => {
    store().pin('api', { x: 10, y: 20 })
    store().pin('api', { x: 99, y: 99 })
    expect(store().pins.api).toEqual({ x: 99, y: 99 })
  })

  it('removes one pin and keeps the rest', () => {
    store().pin('api', { x: 1, y: 1 })
    store().pin('db', { x: 2, y: 2 })
    store().unpin('api')
    expect(store().pins).toEqual({ db: { x: 2, y: 2 } })
  })

  it('clears every pin, handing the diagram back to auto layout', () => {
    store().pin('api', { x: 1, y: 1 })
    store().clearPins()
    expect(store().pins).toEqual({})
  })

  /** A renamed or deleted component must not leave a pin behind to resurrect later. */
  it('prunes pins whose name has left the source', () => {
    store().pin('api', { x: 1, y: 1 })
    store().pin('gone', { x: 2, y: 2 })
    store().prunePins(['api'])
    expect(store().pins).toEqual({ api: { x: 1, y: 1 } })
  })

  it('leaves the pin object alone when nothing needs pruning', () => {
    store().pin('api', { x: 1, y: 1 })
    const before = store().pins
    store().prunePins(['api'])
    expect(store().pins).toBe(before)
  })

  it('strips a pin down to plain coordinates', () => {
    store().pin('api', { x: 1, y: 2 })
    expect(Object.keys(store().pins.api)).toEqual(['x', 'y'])
  })
})

describe('persistence', () => {
  it('reports the payload the document stores', () => {
    store().setSource('server api')
    store().pin('api', { x: 5, y: 6 })
    store().setEnabled(true)

    expect(store().getPersistPayload()).toEqual({
      source: 'server api',
      pins: { api: { x: 5, y: 6 } },
      enabled: true,
    })
  })

  it('hydrates from a stored document', () => {
    store().hydrate({ source: 'redis cache', pins: { cache: { x: 1, y: 2 } }, enabled: true })
    expect(store().source).toBe('redis cache')
    expect(store().pins).toEqual({ cache: { x: 1, y: 2 } })
    expect(store().enabled).toBe(true)
  })

  /** Pre-v5 documents have no DSL block. */
  it('hydrates from nothing without complaint', () => {
    store().setSource('stale')
    store().hydrate(undefined)
    expect(store().source).toBe('')
    expect(store().enabled).toBe(false)
  })

  it('clears diagnostics on hydrate, so a previous diagram does not leak errors', () => {
    store().setDiagnostics([
      {
        severity: 'error',
        message: 'old',
        span: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 1, line: 1, column: 2 } },
      },
    ])
    store().hydrate({ source: 'server api', pins: {}, enabled: true })
    expect(store().diagnostics).toEqual([])
  })
})

describe('normalisePins', () => {
  it('keeps finite pairs', () => {
    expect(normalisePins({ api: { x: 1, y: 2 } })).toEqual({ api: { x: 1, y: 2 } })
  })

  it('drops anything that is not a finite coordinate pair', () => {
    expect(
      normalisePins({
        good: { x: 1, y: 2 },
        missingY: { x: 1 },
        stringy: { x: '1', y: 2 },
        infinite: { x: Infinity, y: 0 },
        nan: { x: NaN, y: 0 },
        nully: null,
        arrayish: [1, 2],
      })
    ).toEqual({ good: { x: 1, y: 2 } })
  })

  it('returns an empty map for junk', () => {
    expect(normalisePins(undefined)).toEqual({})
    expect(normalisePins('nope')).toEqual({})
    expect(normalisePins([])).toEqual({})
  })
})
