import { describe, it, expect, beforeEach } from 'vitest'
import { countByKind, normaliseItems, useNotesStore } from './notesStore'

const store = () => useNotesStore.getState()

beforeEach(() => {
  store().reset()
})

describe('adding', () => {
  it('starts empty', () => {
    expect(store().items).toEqual([])
  })

  it('adds an item of the requested kind', () => {
    store().add('functional')
    expect(store().items).toHaveLength(1)
    expect(store().items[0]).toMatchObject({ kind: 'functional', title: '', body: '', done: false })
  })

  /** Only non-functional items sit on an axis, so nothing else should carry one. */
  it('gives a non-functional item a category and others none', () => {
    store().add('nonFunctional')
    store().add('functional')
    store().add('assumption')

    const [nfr, fr, assumption] = store().items
    expect(nfr.category).toBe('other')
    expect(fr).not.toHaveProperty('category')
    expect(assumption).not.toHaveProperty('category')
  })

  it('takes an explicit category', () => {
    store().add('nonFunctional', 'latency')
    expect(store().items[0].category).toBe('latency')
  })

  it('gives every item a unique id', () => {
    for (let i = 0; i < 5; i++) store().add('functional')
    const ids = store().items.map((i) => i.id)
    expect(new Set(ids).size).toBe(5)
  })

  it('keeps insertion order', () => {
    store().add('functional')
    store().add('assumption')
    expect(store().items.map((i) => i.kind)).toEqual(['functional', 'assumption'])
  })
})

describe('editing', () => {
  it('updates the title and body', () => {
    store().add('functional')
    const { id } = store().items[0]

    store().update(id, { title: 'Users can upload', body: 'Up to 10MB' })
    expect(store().items[0]).toMatchObject({ title: 'Users can upload', body: 'Up to 10MB' })
  })

  it('updates a category', () => {
    store().add('nonFunctional')
    store().update(store().items[0].id, { category: 'availability' })
    expect(store().items[0].category).toBe('availability')
  })

  it('moves the updated timestamp', async () => {
    store().add('functional')
    const before = store().items[0].updatedAt

    await new Promise((resolve) => setTimeout(resolve, 2))
    store().update(store().items[0].id, { title: 'x' })
    expect(store().items[0].updatedAt).not.toBe(before)
  })

  it('ignores an unknown id', () => {
    store().add('functional')
    store().update('nope', { title: 'x' })
    expect(store().items[0].title).toBe('')
  })

  it('leaves other items alone', () => {
    store().add('functional')
    store().add('functional')
    store().update(store().items[0].id, { title: 'first' })
    expect(store().items[1].title).toBe('')
  })
})

describe('done and removal', () => {
  it('toggles done both ways', () => {
    store().add('functional')
    const { id } = store().items[0]

    store().toggleDone(id)
    expect(store().items[0].done).toBe(true)
    store().toggleDone(id)
    expect(store().items[0].done).toBe(false)
  })

  it('removes one item and keeps the rest', () => {
    store().add('functional')
    store().add('assumption')
    store().remove(store().items[0].id)

    expect(store().items).toHaveLength(1)
    expect(store().items[0].kind).toBe('assumption')
  })

  it('ignores removing an unknown id', () => {
    store().add('functional')
    store().remove('nope')
    expect(store().items).toHaveLength(1)
  })
})

describe('persistence', () => {
  /** Keeps the stored JSON free of a key for a feature the diagram never used. */
  it('reports nothing when empty', () => {
    expect(store().getPersistPayload()).toBeUndefined()
  })

  it('reports the items once there are some', () => {
    store().add('functional')
    expect(store().getPersistPayload()?.items).toHaveLength(1)
  })

  it('stops reporting once the last item is deleted', () => {
    store().add('functional')
    store().remove(store().items[0].id)
    expect(store().getPersistPayload()).toBeUndefined()
  })

  it('hydrates from a stored document', () => {
    store().hydrate({
      items: [
        {
          id: 'req-1',
          kind: 'nonFunctional',
          title: 'p95 under 200ms',
          body: '',
          category: 'latency',
          done: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })

    expect(store().items).toHaveLength(1)
    expect(store().items[0]).toMatchObject({ title: 'p95 under 200ms', category: 'latency', done: true })
  })

  it('hydrates from nothing without complaint', () => {
    store().add('functional')
    store().hydrate(undefined)
    expect(store().items).toEqual([])
  })

  it('round-trips through JSON, which is how it is stored', () => {
    store().add('nonFunctional', 'cost')
    store().update(store().items[0].id, { title: 'Under $5k/month' })

    const raw = JSON.parse(JSON.stringify(store().getPersistPayload()))
    store().reset()
    store().hydrate(raw)

    expect(store().items[0]).toMatchObject({ title: 'Under $5k/month', category: 'cost' })
  })
})

describe('normaliseItems', () => {
  const valid = {
    id: 'req-1',
    kind: 'functional',
    title: 'a',
    body: 'b',
    done: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  it('keeps a valid item', () => {
    expect(normaliseItems([valid])).toHaveLength(1)
  })

  /** These come back from stored JSON, so a hand edit could leave anything here. */
  it('drops items with no recognisable kind', () => {
    expect(normaliseItems([{ ...valid, kind: 'wishful' }])).toEqual([])
    expect(normaliseItems([{ ...valid, kind: undefined }])).toEqual([])
  })

  it('drops anything that is not an object', () => {
    expect(normaliseItems([null, 'x', 42, []])).toEqual([])
  })

  it('returns empty for junk', () => {
    expect(normaliseItems(undefined)).toEqual([])
    expect(normaliseItems({})).toEqual([])
    expect(normaliseItems('nope')).toEqual([])
  })

  it('replaces missing text with empty strings', () => {
    const [item] = normaliseItems([{ ...valid, title: undefined, body: 42 }])
    expect(item.title).toBe('')
    expect(item.body).toBe('')
  })

  it('mints an id when one is missing', () => {
    const [item] = normaliseItems([{ ...valid, id: '' }])
    expect(item.id).toBeTruthy()
  })

  it('treats a non-true done as false', () => {
    expect(normaliseItems([{ ...valid, done: 'yes' }])[0].done).toBe(false)
  })

  it('falls back to other for an unknown category', () => {
    const [item] = normaliseItems([
      { ...valid, kind: 'nonFunctional', category: 'vibes' },
    ])
    expect(item.category).toBe('other')
  })

  /** A functional item arriving with an axis would render a select that means nothing. */
  it('strips a category from a kind that cannot have one', () => {
    const [item] = normaliseItems([{ ...valid, kind: 'functional', category: 'latency' }])
    expect(item).not.toHaveProperty('category')
  })

  it('supplies timestamps when absent', () => {
    const [item] = normaliseItems([{ ...valid, createdAt: undefined, updatedAt: null }])
    expect(item.createdAt).toBeTruthy()
    expect(item.updatedAt).toBeTruthy()
  })
})

describe('countByKind', () => {
  it('counts each kind', () => {
    store().add('functional')
    store().add('functional')
    store().add('nonFunctional')

    expect(countByKind(store().items)).toEqual({
      functional: 2,
      nonFunctional: 1,
      assumption: 0,
    })
  })

  it('counts an empty list as zeroes', () => {
    expect(countByKind([])).toEqual({ functional: 0, nonFunctional: 0, assumption: 0 })
  })
})
