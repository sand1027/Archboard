import { describe, it, expect } from 'vitest'
import { migrateDocument } from './documentPayload'
import { NOTE_KINDS } from '@/types/notes'

/**
 * Component configuration has to survive a save/load round trip, or every value the user
 * types is lost the moment the document is rehydrated.
 */
const NODE_WITH_CONFIG = {
  id: 'n1',
  type: 'architecture',
  position: { x: 0, y: 0 },
  data: {
    componentId: 'postgresql',
    label: 'Orders DB',
    category: 'databases',
    icon: '/x.svg',
    serviceMs: 25,
    instances: 3,
    vcpu: 8,
    memoryGb: 32,
    config: {
      engine: 'postgres',
      connectionPool: 20,
      multiAz: true,
      region: 'us-east-1',
    },
  },
}

function docWith(node: unknown) {
  return {
    version: 4,
    activeBoard: 'hld',
    boards: {
      hld: { diagramId: 'd1', diagramName: 'Test', nodes: [node], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
      lld: { diagramId: 'd2', diagramName: 'LLD', nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
    },
    lldWorkspaces: {},
  }
}

describe('node data survives migration', () => {
  it('keeps the component config bag intact', () => {
    const doc = migrateDocument(docWith(NODE_WITH_CONFIG))
    const node = doc?.boards.hld.nodes[0] as typeof NODE_WITH_CONFIG | undefined

    expect(node?.data.config).toEqual({
      engine: 'postgres',
      connectionPool: 20,
      multiAz: true,
      region: 'us-east-1',
    })
  })

  it('keeps the typed sizing fields', () => {
    const doc = migrateDocument(docWith(NODE_WITH_CONFIG))
    const node = doc?.boards.hld.nodes[0] as typeof NODE_WITH_CONFIG | undefined

    expect(node?.data).toMatchObject({ serviceMs: 25, instances: 3, vcpu: 8, memoryGb: 32 })
  })

  it('round-trips through JSON, which is how it is actually stored', () => {
    const raw = JSON.parse(JSON.stringify(docWith(NODE_WITH_CONFIG)))
    const doc = migrateDocument(raw)
    const node = doc?.boards.hld.nodes[0] as typeof NODE_WITH_CONFIG | undefined

    expect(node?.data.config?.connectionPool).toBe(20)
  })
})

describe('workload persistence', () => {
  it('carries the capacity workload through', () => {
    const doc = migrateDocument({
      ...docWith(NODE_WITH_CONFIG),
      workload: { inputs: { dau: 5_000_000 }, overrides: { 'peak-qps': 999 } },
    })

    expect(doc?.workload?.inputs.dau).toBe(5_000_000)
    expect(doc?.workload?.overrides['peak-qps']).toBe(999)
  })

  // Documents written before v4 have no workload at all.
  it('leaves the workload undefined when absent', () => {
    expect(migrateDocument(docWith(NODE_WITH_CONFIG))?.workload).toBeUndefined()
  })
})

describe('DSL persistence', () => {
  const dsl = {
    source: 'server api "API"\npostgresql db "Orders"\napi -> db',
    pins: { api: { x: 120, y: 40 } },
    enabled: true,
  }

  it('carries the source and pins through', () => {
    const doc = migrateDocument({ ...docWith(NODE_WITH_CONFIG), dsl })
    expect(doc?.dsl?.source).toBe(dsl.source)
    expect(doc?.dsl?.pins).toEqual({ api: { x: 120, y: 40 } })
    expect(doc?.dsl?.enabled).toBe(true)
  })

  /** Additive: a pre-v5 document must open exactly as it did. */
  it('leaves the DSL undefined when absent', () => {
    expect(migrateDocument(docWith(NODE_WITH_CONFIG))?.dsl).toBeUndefined()
  })

  it('ignores a DSL block with nothing in it', () => {
    const doc = migrateDocument({
      ...docWith(NODE_WITH_CONFIG),
      dsl: { source: '', pins: {}, enabled: false },
    })
    expect(doc?.dsl).toBeUndefined()
  })

  /** Pins arrive from stored JSON, where a NaN would put a node somewhere unrenderable. */
  it('drops a pin with a bad coordinate', () => {
    const doc = migrateDocument({
      ...docWith(NODE_WITH_CONFIG),
      dsl: {
        source: 'server api',
        pins: { api: { x: 10, y: 20 }, bad: { x: 'left', y: 3 }, worse: null },
        enabled: true,
      },
    })
    expect(doc?.dsl?.pins).toEqual({ api: { x: 10, y: 20 } })
  })

  it('treats stored source with no flag as enabled', () => {
    const doc = migrateDocument({
      ...docWith(NODE_WITH_CONFIG),
      dsl: { source: 'server api' },
    })
    expect(doc?.dsl?.enabled).toBe(true)
  })

  it('round-trips through JSON, which is how it is actually stored', () => {
    const raw = JSON.parse(JSON.stringify({ ...docWith(NODE_WITH_CONFIG), dsl }))
    expect(migrateDocument(raw)?.dsl).toEqual(dsl)
  })

  it('bumps a v1 flat document to the current version', () => {
    const doc = migrateDocument({ nodes: [NODE_WITH_CONFIG], edges: [], dsl })
    expect(doc?.version).toBe(5)
    expect(doc?.dsl?.source).toBe(dsl.source)
  })
})

describe('notebook persistence', () => {
  const notes = {
    pages: [
      {
        kind: 'functional',
        paper: 'ruled',
        font: 'serif',
        blocks: [
          { id: 'blk-1', type: 'heading', text: 'Uploads' },
          { id: 'blk-2', type: 'bullet', text: 'JPEG or PNG, up to 10MB' },
        ],
      },
      {
        kind: 'nonFunctional',
        paper: 'unruled',
        font: 'sans',
        blocks: [{ id: 'blk-3', type: 'body', text: 'Feed under 200ms at p95' }],
      },
    ],
  }

  it('carries the pages and their blocks through', () => {
    const doc = migrateDocument({ ...docWith(NODE_WITH_CONFIG), notes })
    const functional = doc?.notes?.pages.find((p) => p.kind === 'functional')

    expect(functional).toMatchObject({ paper: 'ruled', font: 'serif' })
    expect(functional?.blocks.map((b) => b.text)).toEqual(['Uploads', 'JPEG or PNG, up to 10MB'])
  })

  /**
   * The tabs are static, so every kind needs a page whether the document had one or not.
   *
   * Asserted against NOTE_KINDS rather than a literal list, so adding a page is a one-line
   * change here instead of a failing test that says nothing useful.
   */
  it('produces a page for every kind', () => {
    const doc = migrateDocument({ ...docWith(NODE_WITH_CONFIG), notes })
    expect(doc?.notes?.pages.map((p) => p.kind)).toEqual(NOTE_KINDS)
  })

  /** Additive: a document written before the notebook existed opens exactly as it did. */
  it('leaves the notebook undefined when absent', () => {
    expect(migrateDocument(docWith(NODE_WITH_CONFIG))?.notes).toBeUndefined()
  })

  it('ignores a notebook nobody wrote in', () => {
    const empty = {
      pages: [{ kind: 'functional', paper: 'unruled', font: 'sans', blocks: [{ id: 'b', type: 'body', text: '' }] }],
    }
    expect(migrateDocument({ ...docWith(NODE_WITH_CONFIG), notes: empty })?.notes).toBeUndefined()
  })

  it('keeps text written under a block type it does not recognise', () => {
    const odd = {
      pages: [
        {
          kind: 'functional',
          paper: 'unruled',
          font: 'sans',
          blocks: [{ id: 'b', type: 'blockquote', text: 'still mine' }],
        },
      ],
    }
    const doc = migrateDocument({ ...docWith(NODE_WITH_CONFIG), notes: odd })
    const block = doc?.notes?.pages.find((p) => p.kind === 'functional')?.blocks[0]
    expect(block).toMatchObject({ type: 'body', text: 'still mine' })
  })

  it('round-trips through JSON, which is how it is actually stored', () => {
    const raw = JSON.parse(JSON.stringify({ ...docWith(NODE_WITH_CONFIG), notes }))
    const doc = migrateDocument(raw)

    const functional = doc?.notes?.pages.find((p) => p.kind === 'functional')
    expect(functional?.blocks).toHaveLength(2)
    expect(functional?.paper).toBe('ruled')
  })

  it('carries the notebook on a v1 flat document too', () => {
    const doc = migrateDocument({ nodes: [NODE_WITH_CONFIG], edges: [], notes })
    expect(doc?.notes?.pages).toHaveLength(NOTE_KINDS.length)
  })

  /** A document saved before trade-offs existed must gain the page, not be rejected. */
  it('adds a page for a kind the stored document never had', () => {
    const doc = migrateDocument({ ...docWith(NODE_WITH_CONFIG), notes })
    const tradeoff = doc?.notes?.pages.find((p) => p.kind === 'tradeoff')

    expect(tradeoff).toBeDefined()
    expect(tradeoff?.blocks).toHaveLength(1)
    expect(tradeoff?.blocks[0].text).toBe('')
  })

  it('carries rewritten Think-about questions through', () => {
    const notes = {
      pages: [
        {
          kind: 'functional',
          paper: 'unruled',
          font: 'sans',
          blocks: [{ id: 'b', type: 'body', text: 'uploads' }],
          prompts: [{ id: 'prm-1', label: 'Writes', question: 'What does a write persist?' }],
        },
      ],
    }
    const doc = migrateDocument({ ...docWith(NODE_WITH_CONFIG), notes })
    const functional = doc?.notes?.pages.find((p) => p.kind === 'functional')
    expect(functional?.prompts).toEqual([
      { id: 'prm-1', label: 'Writes', question: 'What does a write persist?' },
    ])
  })

  it('carries an imported image through', () => {
    const notes = {
      pages: [
        {
          kind: 'scratch',
          paper: 'unruled',
          font: 'sans',
          blocks: [
            { id: 'img-1', type: 'image', text: 'API', src: '/icons/server.svg' },
          ],
        },
      ],
    }
    const doc = migrateDocument({ ...docWith(NODE_WITH_CONFIG), notes })
    const scratch = doc?.notes?.pages.find((p) => p.kind === 'scratch')
    expect(scratch?.blocks[0]).toMatchObject({
      type: 'image',
      text: 'API',
      src: '/icons/server.svg',
    })
  })

  it('carries a resized image width through', () => {
    const notes = {
      pages: [
        {
          kind: 'scratch',
          paper: 'unruled',
          font: 'sans',
          blocks: [
            { id: 'img-1', type: 'image', text: 'API', src: '/icons/server.svg', widthPct: 55 },
          ],
        },
      ],
    }
    const doc = migrateDocument({ ...docWith(NODE_WITH_CONFIG), notes })
    const scratch = doc?.notes?.pages.find((p) => p.kind === 'scratch')
    expect(scratch?.blocks[0]?.widthPct).toBe(55)
  })
})
