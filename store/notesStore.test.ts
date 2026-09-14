import { describe, it, expect, beforeEach } from 'vitest'
import { normalisePages, pageFor, useNotesStore, wordCount } from './notesStore'
import { NOTE_KINDS, PROMPTS, isPageUntouched, type NotePage } from '@/types/notes'

const store = () => useNotesStore.getState()

/** The functional page, which most tests work on. */
const fr = () => pageFor(store().pages, 'functional')
const blocks = () => fr().blocks

beforeEach(() => {
  store().reset()
})

describe('the starting notebook', () => {
  /** The tabs are static, so a missing page would render a tab that leads nowhere. */
  it('has one page per kind, in order', () => {
    expect(store().pages.map((p) => p.kind)).toEqual(NOTE_KINDS)
  })

  it('gives every page somewhere to type', () => {
    for (const page of store().pages) {
      expect(page.blocks).toHaveLength(1)
      expect(page.blocks[0]).toMatchObject({ type: 'body', text: '' })
    }
  })

  it('defaults to plain paper and a sans font', () => {
    for (const page of store().pages) {
      expect(page.paper).toBe('unruled')
      expect(page.font).toBe('sans')
    }
  })

  it('starts on the functional page', () => {
    expect(store().activeKind).toBe('functional')
  })

  it('gives every block a unique id', () => {
    const ids = store().pages.flatMap((p) => p.blocks.map((b) => b.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('page settings', () => {
  it('switches the active page', () => {
    store().setActiveKind('nonFunctional')
    expect(store().activeKind).toBe('nonFunctional')
  })

  it('sets paper and font per page, leaving the others alone', () => {
    store().setPaper('functional', 'ruled')
    store().setFont('functional', 'serif')

    expect(fr()).toMatchObject({ paper: 'ruled', font: 'serif' })
    expect(pageFor(store().pages, 'assumption')).toMatchObject({
      paper: 'unruled',
      font: 'sans',
    })
  })
})

describe('editing blocks', () => {
  it('sets a block type', () => {
    store().setBlockType('functional', blocks()[0].id, 'heading')
    expect(blocks()[0].type).toBe('heading')
  })

  it('sets a block text', () => {
    store().setBlockText('functional', blocks()[0].id, 'Users can upload')
    expect(blocks()[0].text).toBe('Users can upload')
  })

  it('inserts a block after another and returns its id', () => {
    const first = blocks()[0].id
    const id = store().insertBlockAfter('functional', first, 'bullet', 'up to 10MB')

    expect(blocks()).toHaveLength(2)
    expect(blocks()[1]).toMatchObject({ id, type: 'bullet', text: 'up to 10MB' })
  })

  it('inserts in the middle, not at the end', () => {
    const first = blocks()[0].id
    store().insertBlockAfter('functional', first, 'body', 'third')
    store().insertBlockAfter('functional', first, 'body', 'second')

    expect(blocks().map((b) => b.text)).toEqual(['', 'second', 'third'])
  })

  /** A stale id must not swallow the block, or a keystroke would appear to do nothing. */
  it('appends when the anchor block is gone', () => {
    store().insertBlockAfter('functional', 'not-a-block', 'body', 'orphan')
    expect(blocks().at(-1)?.text).toBe('orphan')
  })

  it('removes a block', () => {
    const id = store().insertBlockAfter('functional', blocks()[0].id, 'body', 'x')
    store().removeBlock('functional', id)
    expect(blocks()).toHaveLength(1)
  })

  /** A page with no blocks has nowhere to put the caret, so the last one stays. */
  it('refuses to remove the only block', () => {
    store().removeBlock('functional', blocks()[0].id)
    expect(blocks()).toHaveLength(1)
  })

  it('edits only the page it was told to', () => {
    store().setBlockText('functional', blocks()[0].id, 'on FR')
    expect(pageFor(store().pages, 'nonFunctional').blocks[0].text).toBe('')
  })

  it('ignores an unknown block id', () => {
    store().setBlockText('functional', 'nope', 'x')
    expect(blocks()[0].text).toBe('')
  })
})

describe('persistence', () => {
  /** A notebook that exists because the panel was opened once is not worth a key. */
  it('reports nothing while every page is untouched', () => {
    expect(store().getPersistPayload()).toBeUndefined()
  })

  it('reports once something is written', () => {
    store().setBlockText('functional', blocks()[0].id, 'something')
    expect(store().getPersistPayload()?.pages).toHaveLength(NOTE_KINDS.length)
  })

  /** Switching the paper is a real preference even with nothing written. */
  it('reports once the paper or font changes', () => {
    store().setPaper('functional', 'ruled')
    expect(store().getPersistPayload()).toBeDefined()

    store().reset()
    store().setFont('assumption', 'mono')
    expect(store().getPersistPayload()).toBeDefined()
  })

  it('treats whitespace as untouched', () => {
    store().setBlockText('functional', blocks()[0].id, '   \n  ')
    expect(store().getPersistPayload()).toBeUndefined()
  })

  it('hydrates from a stored notebook', () => {
    store().hydrate({
      pages: [
        {
          kind: 'nonFunctional',
          paper: 'ruled',
          font: 'mono',
          blocks: [{ id: 'blk-1', type: 'heading', text: 'Latency' }],
        },
      ],
    })

    const page = pageFor(store().pages, 'nonFunctional')
    expect(page).toMatchObject({ paper: 'ruled', font: 'mono' })
    expect(page.blocks[0]).toMatchObject({ type: 'heading', text: 'Latency' })
    // The kinds the document did not mention still get pages.
    expect(store().pages).toHaveLength(NOTE_KINDS.length)
  })

  it('hydrates from nothing without complaint', () => {
    store().setBlockText('functional', blocks()[0].id, 'stale')
    store().hydrate(undefined)
    expect(store().pages.every(isPageUntouched)).toBe(true)
  })

  it('returns to the first page on hydrate', () => {
    store().setActiveKind('assumption')
    store().hydrate(undefined)
    expect(store().activeKind).toBe('functional')
  })

  it('round-trips through JSON, which is how it is stored', () => {
    store().setPaper('functional', 'ruled')
    store().setBlockType('functional', blocks()[0].id, 'heading')
    store().setBlockText('functional', blocks()[0].id, 'Uploads')
    store().insertBlockAfter('functional', blocks()[0].id, 'bullet', 'JPEG or PNG')

    const raw = JSON.parse(JSON.stringify(store().getPersistPayload()))
    store().reset()
    store().hydrate(raw)

    const page = fr()
    expect(page.paper).toBe('ruled')
    expect(page.blocks.map((b) => [b.type, b.text])).toEqual([
      ['heading', 'Uploads'],
      ['bullet', 'JPEG or PNG'],
    ])
  })
})

describe('normalisePages', () => {
  const page = (over: Partial<NotePage> = {}) => ({
    kind: 'functional',
    paper: 'ruled',
    font: 'serif',
    blocks: [{ id: 'blk-1', type: 'body', text: 'hello' }],
    ...over,
  })

  it('always returns one page per kind, in order', () => {
    expect(normalisePages([]).map((p) => p.kind)).toEqual(NOTE_KINDS)
    expect(normalisePages(undefined).map((p) => p.kind)).toEqual(NOTE_KINDS)
    expect(normalisePages('nope').map((p) => p.kind)).toEqual(NOTE_KINDS)
  })

  it('keeps a valid page', () => {
    const [functional] = normalisePages([page()])
    expect(functional).toMatchObject({ paper: 'ruled', font: 'serif' })
    expect(functional.blocks[0].text).toBe('hello')
  })

  it('drops a page for a kind with no tab', () => {
    const pages = normalisePages([page({ kind: 'wishful' } as unknown as Partial<NotePage>)])
    expect(pages.every(isPageUntouched)).toBe(true)
  })

  it('keeps the first of two pages for the same kind', () => {
    const pages = normalisePages([page(), page({ blocks: [{ id: 'b2', type: 'body', text: 'second' }] })])
    expect(pageFor(pages, 'functional').blocks[0].text).toBe('hello')
  })

  it('falls back to defaults for an unknown paper or font', () => {
    const [functional] = normalisePages([page({ paper: 'graph', font: 'comic' } as unknown as Partial<NotePage>)])
    expect(functional).toMatchObject({ paper: 'unruled', font: 'sans' })
  })

  /** The text someone wrote matters more than the style they wrote it in. */
  it('keeps text with an unknown block type, as body', () => {
    const [functional] = normalisePages([
      page({ blocks: [{ id: 'b', type: 'quote', text: 'kept' }] } as unknown as Partial<NotePage>),
    ])
    expect(functional.blocks[0]).toMatchObject({ type: 'body', text: 'kept' })
  })

  it('keeps an image block and its src', () => {
    const [functional] = normalisePages([
      page({
        blocks: [
          {
            id: 'img-1',
            type: 'image',
            text: 'API',
            src: '/icons/server.svg',
          },
        ],
      } as unknown as Partial<NotePage>),
    ])
    expect(functional.blocks[0]).toMatchObject({
      type: 'image',
      text: 'API',
      src: '/icons/server.svg',
    })
  })

  it('drops an image whose src is not a picture', () => {
    const [functional] = normalisePages([
      page({
        blocks: [{ id: 'img-1', type: 'image', text: 'x', src: 'javascript:alert(1)' }],
      } as unknown as Partial<NotePage>),
    ])
    expect(functional.blocks.every((b) => b.type !== 'image')).toBe(true)
  })

  it('drops a block whose text is not a string', () => {
    const [functional] = normalisePages([
      page({ blocks: [{ id: 'b', type: 'body', text: 42 }] } as unknown as Partial<NotePage>),
    ])
    // Nothing survived, so the page still needs a block to type into.
    expect(functional.blocks).toHaveLength(1)
    expect(functional.blocks[0].text).toBe('')
  })

  it('gives a page with no blocks somewhere to type', () => {
    const [functional] = normalisePages([page({ blocks: [] })])
    expect(functional.blocks).toHaveLength(1)
  })

  it('mints a block id when one is missing', () => {
    const [functional] = normalisePages([
      page({ blocks: [{ type: 'body', text: 'x' }] } as unknown as Partial<NotePage>),
    ])
    expect(functional.blocks[0].id).toBeTruthy()
  })

  it('ignores entries that are not objects', () => {
    expect(normalisePages([null, 'x', 42]).every(isPageUntouched)).toBe(true)
  })
})

describe('wordCount', () => {
  it('counts across every page', () => {
    store().setBlockText('functional', blocks()[0].id, 'two words')
    store().setBlockText(
      'nonFunctional',
      pageFor(store().pages, 'nonFunctional').blocks[0].id,
      'three more words'
    )
    expect(wordCount(store().pages)).toBe(5)
  })

  it('counts an empty notebook as zero', () => {
    expect(wordCount(store().pages)).toBe(0)
  })

  it('does not count whitespace as a word', () => {
    store().setBlockText('functional', blocks()[0].id, '   ')
    expect(wordCount(store().pages)).toBe(0)
  })
})

describe('prompts', () => {
  /**
   * These are the guidance, not decoration. An earlier version compressed them to one-word
   * labels and the panel stopped teaching anything, so the question text is what is asserted.
   */
  /** Scratch is deliberately unprompted, so it is excluded rather than made an exception below. */
  const GUIDED_KINDS = NOTE_KINDS.filter((kind) => kind !== 'scratch')

  it('leaves the scratch page unprompted', () => {
    expect(PROMPTS.scratch).toEqual([])
  })

  it('gives every guided page prompts with both a label and a question', () => {
    for (const kind of GUIDED_KINDS) {
      const prompts = PROMPTS[kind]
      expect(prompts.length).toBeGreaterThan(0)

      for (const prompt of prompts) {
        expect(prompt.label).not.toBe('')
        expect(prompt.question).not.toBe('')
        // A question, not a restatement of the label.
        expect(prompt.question.length).toBeGreaterThan(prompt.label.length)
      }
    }
  })

  /** The page people leave emptiest deserves the most guidance. */
  it('covers the axes a design gets judged on', () => {
    const labels = PROMPTS.nonFunctional.map((p) => p.label.toLowerCase())
    for (const axis of ['scale', 'latency', 'availability', 'consistency', 'durability', 'security', 'cost']) {
      expect(labels).toContain(axis)
    }
  })

  it('asks something on every prompt', () => {
    for (const kind of GUIDED_KINDS) {
      for (const prompt of PROMPTS[kind]) {
        expect(prompt.question).toMatch(/\?$/)
      }
    }
  })

  it('uses each label once per page, since they key the list', () => {
    for (const kind of NOTE_KINDS) {
      const labels = PROMPTS[kind].map((p) => p.label)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })

  /**
   * The insert flow the strip performs: reuse a trailing empty block for the question, then add
   * an empty line under it for the answer.
   */
  it('turns a question into a subheading with a line to answer on', () => {
    const first = blocks()[0]
    const prompt = PROMPTS.functional[0]

    store().setBlockType('functional', first.id, 'subheading')
    store().setBlockText('functional', first.id, prompt.question)
    store().insertBlockAfter('functional', first.id, 'body', '')

    expect(blocks().map((b) => [b.type, b.text])).toEqual([
      ['subheading', prompt.question],
      ['body', ''],
    ])
  })

  it('appends rather than overwriting when the page already has content', () => {
    const first = blocks()[0]
    store().setBlockText('functional', first.id, 'already written')

    const prompt = PROMPTS.functional[1]
    const anchor = store().insertBlockAfter('functional', first.id, 'subheading', prompt.question)
    store().insertBlockAfter('functional', anchor, 'body', '')

    expect(blocks()[0].text).toBe('already written')
    expect(blocks()).toHaveLength(3)
  })

  it('starts each guided page with the catalog, copied so it can be rewritten', () => {
    for (const kind of GUIDED_KINDS) {
      const prompts = pageFor(store().pages, kind).prompts
      expect(prompts.map((p) => [p.label, p.question])).toEqual(
        PROMPTS[kind].map((p) => [p.label, p.question])
      )
      expect(prompts.every((p) => p.id)).toBe(true)
    }
  })

  it('lets a prompt be edited, added and removed', () => {
    const first = pageFor(store().pages, 'functional').prompts[0]
    store().updatePrompt('functional', first.id, {
      label: 'Writes',
      question: 'What does a write actually persist?',
    })

    expect(pageFor(store().pages, 'functional').prompts[0]).toMatchObject({
      label: 'Writes',
      question: 'What does a write actually persist?',
    })

    const id = store().addPrompt('tradeoff')
    store().updatePrompt('tradeoff', id, { label: 'Cache', question: 'Why this cache?' })
    expect(pageFor(store().pages, 'tradeoff').prompts.at(-1)).toMatchObject({
      id,
      label: 'Cache',
      question: 'Why this cache?',
    })

    store().removePrompt('tradeoff', id)
    expect(pageFor(store().pages, 'tradeoff').prompts.some((p) => p.id === id)).toBe(false)
  })

  /** Editing the questions is a real change even with a blank page. */
  it('persists once a prompt is rewritten', () => {
    const first = pageFor(store().pages, 'assumption').prompts[0]
    store().updatePrompt('assumption', first.id, { question: 'What did the interviewer actually say?' })
    expect(store().getPersistPayload()).toBeDefined()
  })

  it('round-trips custom prompts through JSON', () => {
    const first = pageFor(store().pages, 'nonFunctional').prompts[0]
    store().updatePrompt('nonFunctional', first.id, { label: 'p99', question: 'What is p99 under peak?' })

    const raw = JSON.parse(JSON.stringify(store().getPersistPayload()))
    store().reset()
    store().hydrate(raw)

    expect(pageFor(store().pages, 'nonFunctional').prompts[0]).toMatchObject({
      label: 'p99',
      question: 'What is p99 under peak?',
    })
  })

  it('fills catalog prompts when a stored page has none', () => {
    store().hydrate({
      pages: [
        {
          kind: 'functional',
          paper: 'unruled',
          font: 'sans',
          blocks: [{ id: 'b', type: 'body', text: 'uploads' }],
        },
      ],
    })

    expect(pageFor(store().pages, 'functional').prompts.map((p) => p.label)).toEqual(
      PROMPTS.functional.map((p) => p.label)
    )
  })

  it('keeps an empty prompt list, which is how deleting them all is stored', () => {
    store().hydrate({
      pages: [
        {
          kind: 'functional',
          paper: 'unruled',
          font: 'sans',
          blocks: [{ id: 'b', type: 'body', text: 'uploads' }],
          prompts: [],
        },
      ],
    })

    expect(pageFor(store().pages, 'functional').prompts).toEqual([])
  })
})

describe('the trade-offs page', () => {
  /**
   * The page the notebook was missing. "Why this and not that" is the question a design is
   * actually judged on, and there was nowhere to answer it.
   */
  /** Last of the guided pages: it is the only one you cannot write until the design exists. */
  it('comes after the pages that describe the design', () => {
    const guided = NOTE_KINDS.filter((kind) => kind !== 'scratch')
    expect(guided.at(-1)).toBe('tradeoff')
    expect(pageFor(store().pages, 'tradeoff').kind).toBe('tradeoff')
  })

  it('prompts for the alternatives and what was given up', () => {
    const questions = PROMPTS.tradeoff.map((p) => p.question.toLowerCase()).join(' ')
    expect(questions).toContain('what else')
    expect(questions).toContain('worse')
  })

  it('is editable and persists like any other page', () => {
    const page = pageFor(store().pages, 'tradeoff')
    store().setBlockText('tradeoff', page.blocks[0].id, 'Redis over Memcached: needed sorted sets')

    const raw = JSON.parse(JSON.stringify(store().getPersistPayload()))
    store().reset()
    store().hydrate(raw)

    expect(pageFor(store().pages, 'tradeoff').blocks[0].text).toContain('Redis over Memcached')
  })

  it('counts toward the notebook word count', () => {
    const page = pageFor(store().pages, 'tradeoff')
    store().setBlockText('tradeoff', page.blocks[0].id, 'three words here')
    expect(wordCount(store().pages)).toBe(3)
  })
})

describe('the scratch page', () => {
  /**
   * The page for notes taken while learning, rather than notes about this design. Structure is
   * the point everywhere else and the obstacle here.
   */
  it('exists and asks nothing until you add a question', () => {
    expect(pageFor(store().pages, 'scratch').kind).toBe('scratch')
    expect(PROMPTS.scratch).toEqual([])
    expect(pageFor(store().pages, 'scratch').prompts).toEqual([])
  })

  it('takes free text like any other page', () => {
    const page = pageFor(store().pages, 'scratch')
    store().setBlockText('scratch', page.blocks[0].id, 'consistent hashing — ring of virtual nodes')
    expect(pageFor(store().pages, 'scratch').blocks[0].text).toContain('consistent hashing')
  })

  it('persists with the rest of the notebook', () => {
    const page = pageFor(store().pages, 'scratch')
    store().setBlockText('scratch', page.blocks[0].id, 'from the tutorial')

    const raw = JSON.parse(JSON.stringify(store().getPersistPayload()))
    store().reset()
    store().hydrate(raw)

    expect(pageFor(store().pages, 'scratch').blocks[0].text).toBe('from the tutorial')
  })
})

describe('appendBlocks', () => {
  it('adds blocks to the end and returns the last id', () => {
    const id = store().appendBlocks('scratch', [
      { type: 'subheading', text: 'From the diagram' },
      { type: 'bullet', text: 'API (server)' },
    ])

    const page = pageFor(store().pages, 'scratch')
    expect(page.blocks.map((b) => b.text)).toEqual(['From the diagram', 'API (server)'])
    expect(page.blocks.at(-1)?.id).toBe(id)
  })

  /** Pasted content should not land after a blank line left over from an untouched page. */
  it('reuses a trailing empty block rather than leaving a gap', () => {
    expect(pageFor(store().pages, 'scratch').blocks).toHaveLength(1)
    store().appendBlocks('scratch', [{ type: 'bullet', text: 'first' }])
    expect(pageFor(store().pages, 'scratch').blocks.map((b) => b.text)).toEqual(['first'])
  })

  it('keeps existing writing above what is appended', () => {
    const page = pageFor(store().pages, 'scratch')
    store().setBlockText('scratch', page.blocks[0].id, 'already here')
    store().appendBlocks('scratch', [{ type: 'bullet', text: 'added' }])

    expect(pageFor(store().pages, 'scratch').blocks.map((b) => b.text)).toEqual([
      'already here',
      'added',
    ])
  })

  it('does nothing and returns null for an empty list', () => {
    const before = pageFor(store().pages, 'scratch').blocks.length
    expect(store().appendBlocks('scratch', [])).toBeNull()
    expect(pageFor(store().pages, 'scratch').blocks).toHaveLength(before)
  })

  it('gives every appended block a fresh id', () => {
    store().appendBlocks('scratch', [
      { type: 'bullet', text: 'a' },
      { type: 'bullet', text: 'b' },
    ])
    const ids = pageFor(store().pages, 'scratch').blocks.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('appends to the page it was told to', () => {
    store().appendBlocks('tradeoff', [{ type: 'bullet', text: 'on trade-offs' }])
    expect(pageFor(store().pages, 'scratch').blocks[0].text).toBe('')
    expect(pageFor(store().pages, 'tradeoff').blocks[0].text).toBe('on trade-offs')
  })

  it('inserts an image with its src', () => {
    const first = blocks()[0].id
    const id = store().insertBlockAfter(
      'functional',
      first,
      'image',
      'API',
      'data:image/png;base64,abc'
    )
    expect(blocks()[1]).toMatchObject({
      id,
      type: 'image',
      text: 'API',
      src: 'data:image/png;base64,abc',
    })
  })

  it('does not drop a trailing image when appending more', () => {
    store().appendBlocks('scratch', [
      { type: 'image', text: '', src: '/icons/redis.svg' },
    ])
    store().appendBlocks('scratch', [{ type: 'body', text: 'cache' }])
    expect(pageFor(store().pages, 'scratch').blocks.map((b) => b.type)).toEqual([
      'image',
      'body',
    ])
  })

  it('round-trips an image through hydrate', () => {
    store().appendBlocks('scratch', [
      { type: 'image', text: 'Cache', src: '/icons/redis.svg', widthPct: 70 },
    ])
    const raw = JSON.parse(JSON.stringify(store().getPersistPayload()))
    store().reset()
    store().hydrate(raw)
    expect(pageFor(store().pages, 'scratch').blocks[0]).toMatchObject({
      type: 'image',
      text: 'Cache',
      src: '/icons/redis.svg',
      widthPct: 70,
    })
  })

  it('keeps a resized image width', () => {
    const id = store().appendBlocks('scratch', [
      { type: 'image', text: 'HLD', src: '/h.svg', widthPct: 60 },
    ])
    expect(id).toBeTruthy()
    expect(pageFor(store().pages, 'scratch').blocks[0].widthPct).toBe(60)

    store().setBlockWidth('scratch', id as string, 40)
    expect(pageFor(store().pages, 'scratch').blocks[0].widthPct).toBe(40)
  })

  it('clamps image width to the page', () => {
    const id = store().appendBlocks('scratch', [{ type: 'image', text: 'HLD', src: '/h.svg' }])
    store().setBlockWidth('scratch', id as string, 4)
    expect(pageFor(store().pages, 'scratch').blocks[0].widthPct).toBe(20)
    store().setBlockWidth('scratch', id as string, 140)
    expect(pageFor(store().pages, 'scratch').blocks[0].widthPct).toBe(100)
  })
})

describe('undo and redo', () => {
  it('undoes an appended image', () => {
    store().appendBlocks('scratch', [{ type: 'image', text: 'Mobile', src: '/m.svg' }])
    expect(store().canUndo).toBe(true)
    store().undo()
    expect(pageFor(store().pages, 'scratch').blocks[0]).toMatchObject({ type: 'body', text: '' })
  })

  it('redoes after undo', () => {
    store().appendBlocks('scratch', [{ type: 'bullet', text: 'kept' }])
    store().undo()
    store().redo()
    expect(pageFor(store().pages, 'scratch').blocks[0].text).toBe('kept')
  })

  it('treats a burst of typing as one undo step', () => {
    const id = blocks()[0].id
    store().setBlockText('functional', id, 'a')
    store().setBlockText('functional', id, 'ab')
    store().setBlockText('functional', id, 'abc')
    store().undo()
    expect(blocks()[0].text).toBe('')
  })

  it('starts with nothing to undo', () => {
    expect(store().canUndo).toBe(false)
    expect(store().canRedo).toBe(false)
  })
})
