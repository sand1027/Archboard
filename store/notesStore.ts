'use client'

import { create } from 'zustand'
import { generatePrefixedId } from '@/lib/canvas/ids'
import {
  DEFAULT_FONT,
  DEFAULT_PAPER,
  NOTE_KINDS,
  PROMPTS,
  clampImageWidthPct,
  isPageUntouched,
  type BlockType,
  type NoteBlock,
  type NoteFont,
  type NoteKind,
  type NotePage,
  type NotePrompt,
  type NotesDocument,
  type PaperStyle,
} from '@/types/notes'

/**
 * The notebook for the current diagram.
 *
 * Block editing lives here rather than in the component for one reason: the editor is a set of
 * `contentEditable` divs, and putting split-and-merge logic next to caret handling is how that
 * kind of editor becomes untestable. The store owns the document; the component owns the caret.
 *
 * Canvas undo is a different stack on purpose: typing a sentence in notes should not
 * rewind a node you just dropped. Notes keep their own past/future here.
 */
interface NotesState {
  pages: NotePage[]
  activeKind: NoteKind
  past: NotePage[][]
  future: NotePage[][]
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void

  setActiveKind: (kind: NoteKind) => void
  setPaper: (kind: NoteKind, paper: PaperStyle) => void
  setFont: (kind: NoteKind, font: NoteFont) => void

  setBlockType: (kind: NoteKind, blockId: string, type: BlockType) => void
  setBlockText: (kind: NoteKind, blockId: string, text: string) => void
  /** Display width of an image, as a percent of the page. */
  setBlockWidth: (kind: NoteKind, blockId: string, widthPct: number) => void
  /** Returns the new block's id, so the caller can move the caret into it. */
  insertBlockAfter: (kind: NoteKind, blockId: string, type: BlockType, text?: string, src?: string) => string
  removeBlock: (kind: NoteKind, blockId: string) => void
  /**
   * Append blocks to the end of a page.
   *
   * For content that arrives from somewhere other than the keyboard — a canvas selection, for
   * one. Returns the id of the last block added so the caller can put the caret after it.
   */
  appendBlocks: (
    kind: NoteKind,
    blocks: Array<Pick<NoteBlock, 'type' | 'text' | 'src'> & { widthPct?: number }>
  ) => string | null

  addPrompt: (kind: NoteKind) => string
  updatePrompt: (kind: NoteKind, promptId: string, patch: Partial<Pick<NotePrompt, 'label' | 'question'>>) => void
  removePrompt: (kind: NoteKind, promptId: string) => void

  /** For the persistence layer. */
  getPersistPayload: () => NotesDocument | undefined
  /** Stored JSON, which may predate `prompts` on each page. */
  hydrate: (doc?: { pages?: unknown } | null) => void
  reset: () => void
}

export function emptyBlock(type: BlockType = 'body', text = '', src?: string, widthPct?: number): NoteBlock {
  const block: NoteBlock = src
    ? { id: generatePrefixedId('blk'), type, text, src }
    : { id: generatePrefixedId('blk'), type, text }
  if (type === 'image' && widthPct != null) block.widthPct = clampImageWidthPct(widthPct)
  return block
}

export function emptyPage(kind: NoteKind): NotePage {
  return {
    kind,
    paper: DEFAULT_PAPER,
    font: DEFAULT_FONT,
    blocks: [emptyBlock()],
    prompts: cloneCatalogPrompts(kind),
  }
}

/** Copy the built-in questions onto a page, each with its own id so they can be edited. */
export function cloneCatalogPrompts(kind: NoteKind): NotePrompt[] {
  return PROMPTS[kind].map((seed) => ({
    id: generatePrefixedId('prm'),
    label: seed.label,
    question: seed.question,
  }))
}

export function emptyPages(): NotePage[] {
  return NOTE_KINDS.map(emptyPage)
}

const MAX_NOTES_HISTORY = 50

/** Consecutive keystrokes in one field are one undo step, not one per letter. */
let coalescingText = false

function clonePages(pages: NotePage[]): NotePage[] {
  return JSON.parse(JSON.stringify(pages)) as NotePage[]
}

function historyFrom(s: Pick<NotesState, 'pages' | 'past'>, coalesce: boolean) {
  if (coalesce && coalescingText) return {}
  coalescingText = coalesce
  return {
    past: [...s.past, clonePages(s.pages)].slice(-MAX_NOTES_HISTORY),
    future: [] as NotePage[][],
    canUndo: true,
    canRedo: false,
  }
}

export const useNotesStore = create<NotesState>()((set, get) => ({
  pages: emptyPages(),
  activeKind: 'functional',
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  setActiveKind: (activeKind) => set({ activeKind }),

  setPaper: (kind, paper) =>
    set((s) => ({ ...historyFrom(s, false), pages: patchPage(s.pages, kind, (p) => ({ ...p, paper })) })),

  setFont: (kind, font) =>
    set((s) => ({ ...historyFrom(s, false), pages: patchPage(s.pages, kind, (p) => ({ ...p, font })) })),

  setBlockType: (kind, blockId, type) =>
    set((s) => ({
      ...historyFrom(s, false),
      pages: patchPage(s.pages, kind, (page) => ({
        ...page,
        blocks: page.blocks.map((b) => (b.id === blockId ? { ...b, type } : b)),
      })),
    })),

  setBlockText: (kind, blockId, text) =>
    set((s) => ({
      ...historyFrom(s, true),
      pages: patchPage(s.pages, kind, (page) => ({
        ...page,
        blocks: page.blocks.map((b) => (b.id === blockId ? { ...b, text } : b)),
      })),
    })),

  setBlockWidth: (kind, blockId, widthPct) =>
    set((s) => ({
      ...historyFrom(s, false),
      pages: patchPage(s.pages, kind, (page) => ({
        ...page,
        blocks: page.blocks.map((b) =>
          b.id === blockId && b.type === 'image'
            ? { ...b, widthPct: clampImageWidthPct(widthPct) }
            : b
        ),
      })),
    })),

  insertBlockAfter: (kind, blockId, type, text = '', src) => {
    const block = emptyBlock(type, text, src)

    set((s) => ({
      ...historyFrom(s, false),
      pages: patchPage(s.pages, kind, (page) => {
        const index = page.blocks.findIndex((b) => b.id === blockId)
        const at = index === -1 ? page.blocks.length : index + 1
        const blocks = [...page.blocks]
        blocks.splice(at, 0, block)
        return { ...page, blocks }
      }),
    }))

    return block.id
  },

  removeBlock: (kind, blockId) =>
    set((s) => {
      const page = s.pages.find((p) => p.kind === kind)
      if (!page || page.blocks.length <= 1) return s
      return {
        ...historyFrom(s, false),
        pages: patchPage(s.pages, kind, (current) => ({
          ...current,
          blocks: current.blocks.filter((b) => b.id !== blockId),
        })),
      }
    }),

  appendBlocks: (kind, incoming) => {
    if (incoming.length === 0) return null

    const built = incoming.map((b) => emptyBlock(b.type, b.text, b.src, b.widthPct))

    set((s) => ({
      ...historyFrom(s, false),
      pages: patchPage(s.pages, kind, (page) => {
        const last = page.blocks[page.blocks.length - 1]
        const existing =
          last && last.type !== 'image' && last.text.trim() === ''
            ? page.blocks.slice(0, -1)
            : page.blocks

        return { ...page, blocks: [...existing, ...built] }
      }),
    }))

    return built[built.length - 1].id
  },

  addPrompt: (kind) => {
    const prompt: NotePrompt = {
      id: generatePrefixedId('prm'),
      label: '',
      question: '',
    }
    set((s) => ({
      ...historyFrom(s, false),
      pages: patchPage(s.pages, kind, (page) => ({
        ...page,
        prompts: [...(page.prompts ?? []), prompt],
      })),
    }))
    return prompt.id
  },

  updatePrompt: (kind, promptId, patch) =>
    set((s) => ({
      ...historyFrom(s, false),
      pages: patchPage(s.pages, kind, (page) => ({
        ...page,
        prompts: (page.prompts ?? []).map((p) => (p.id === promptId ? { ...p, ...patch } : p)),
      })),
    })),

  removePrompt: (kind, promptId) =>
    set((s) => ({
      ...historyFrom(s, false),
      pages: patchPage(s.pages, kind, (page) => ({
        ...page,
        prompts: (page.prompts ?? []).filter((p) => p.id !== promptId),
      })),
    })),

  undo: () => {
    coalescingText = false
    const { past, pages, future } = get()
    if (past.length === 0) return
    const previous = past[past.length - 1]
    set({
      pages: previous,
      past: past.slice(0, -1),
      future: [clonePages(pages), ...future].slice(0, MAX_NOTES_HISTORY),
      canUndo: past.length > 1,
      canRedo: true,
    })
  },

  redo: () => {
    coalescingText = false
    const { future, pages, past } = get()
    if (future.length === 0) return
    const [next, ...rest] = future
    set({
      pages: next,
      past: [...past, clonePages(pages)].slice(-MAX_NOTES_HISTORY),
      future: rest,
      canUndo: true,
      canRedo: rest.length > 0,
    })
  },

  getPersistPayload: () => {
    const { pages } = get()
    return pages.every(isPageUntouched) ? undefined : { pages }
  },

  hydrate: (doc) => {
    coalescingText = false
    set({
      pages: normalisePages(doc?.pages),
      activeKind: 'functional',
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    })
  },

  reset: () => {
    coalescingText = false
    set({
      pages: emptyPages(),
      activeKind: 'functional',
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    })
  },
}))

// ─── helpers ──────────────────────────────────────────────────────────────────

function patchPage(
  pages: NotePage[],
  kind: NoteKind,
  patch: (page: NotePage) => NotePage
): NotePage[] {
  return pages.map((page) => (page.kind === kind ? patch(page) : page))
}

const BLOCK_TYPES: BlockType[] = ['heading', 'subheading', 'body', 'bullet', 'image']
const PAPERS: PaperStyle[] = ['ruled', 'unruled']
const FONTS: NoteFont[] = ['sans', 'serif', 'mono']

/**
 * Normalise a stored notebook into exactly three pages.
 *
 * Always three, in a fixed order, whatever the input: the tabs are static, so a document
 * missing a page would otherwise render a tab that leads nowhere. Unknown block types fall back
 * to body rather than being dropped, because the text someone wrote matters more than the style
 * they wrote it in.
 */
export function normalisePages(raw: unknown): NotePage[] {
  const byKind = new Map<NoteKind, NotePage>()

  if (Array.isArray(raw)) {
    for (const value of raw) {
      if (!value || typeof value !== 'object') continue
      const page = value as Record<string, unknown>

      const kind = NOTE_KINDS.find((k) => k === page.kind)
      // A page for a kind we do not have a tab for has nowhere to be shown.
      if (!kind || byKind.has(kind)) continue

      const blocks = normaliseBlocks(page.blocks)
      byKind.set(kind, {
        kind,
        paper: PAPERS.find((p) => p === page.paper) ?? DEFAULT_PAPER,
        font: FONTS.find((f) => f === page.font) ?? DEFAULT_FONT,
        // Never empty: a page with no blocks has nowhere to put the caret.
        blocks: blocks.length > 0 ? blocks : [emptyBlock()],
        prompts: normalisePrompts(kind, page.prompts),
      })
    }
  }

  return NOTE_KINDS.map((kind) => byKind.get(kind) ?? emptyPage(kind))
}

function normaliseBlocks(raw: unknown): NoteBlock[] {
  if (!Array.isArray(raw)) return []

  const out: NoteBlock[] = []
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue
    const block = value as Record<string, unknown>
    const type = BLOCK_TYPES.find((t) => t === block.type) ?? 'body'
    const src = typeof block.src === 'string' && isAllowedImageSrc(block.src) ? block.src : undefined

    if (type === 'image') {
      if (!src) continue
      out.push({
        id: typeof block.id === 'string' && block.id ? block.id : generatePrefixedId('blk'),
        type: 'image',
        text: typeof block.text === 'string' ? block.text : '',
        src,
        ...(typeof block.widthPct === 'number' ? { widthPct: clampImageWidthPct(block.widthPct) } : {}),
      })
      continue
    }

    // Anything but a string is not text someone typed.
    if (typeof block.text !== 'string') continue

    out.push({
      id: typeof block.id === 'string' && block.id ? block.id : generatePrefixedId('blk'),
      type,
      text: block.text,
    })
  }
  return out
}

function isAllowedImageSrc(src: string): boolean {
  return (
    src.startsWith('data:image/') ||
    src.startsWith('/') ||
    src.startsWith('https://') ||
    src.startsWith('http://')
  )
}

/**
 * Accept a stored prompt list, or fall back to the catalog.
 *
 * `undefined` means an older document that never stored questions — those still get the
 * built-in FR / NFR / Given / Trade-offs list. An empty array is a real choice (every question
 * was deleted) and is kept.
 */
function normalisePrompts(kind: NoteKind, raw: unknown): NotePrompt[] {
  if (raw === undefined) return cloneCatalogPrompts(kind)
  if (!Array.isArray(raw)) return cloneCatalogPrompts(kind)

  const out: NotePrompt[] = []
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue
    const prompt = value as Record<string, unknown>

    const label = typeof prompt.label === 'string' ? prompt.label : ''
    const question = typeof prompt.question === 'string' ? prompt.question : ''
    // A row with neither label nor question is leftover empty UI, not a prompt.
    if (!label.trim() && !question.trim()) continue

    out.push({
      id: typeof prompt.id === 'string' && prompt.id ? prompt.id : generatePrefixedId('prm'),
      label,
      question,
    })
  }
  return out
}

/** The page for a kind. Present for all three kinds once hydrated. */
export function pageFor(pages: NotePage[], kind: NoteKind): NotePage {
  return pages.find((page) => page.kind === kind) ?? emptyPage(kind)
}

/** Words written across the whole notebook, for the footer. */
export function wordCount(pages: NotePage[]): number {
  return pages.reduce(
    (total, page) =>
      total +
      page.blocks.reduce((n, block) => {
        const words = block.text.trim().split(/\s+/).filter(Boolean)
        return n + words.length
      }, 0),
    0
  )
}
