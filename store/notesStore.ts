'use client'

import { create } from 'zustand'
import { generatePrefixedId } from '@/lib/canvas/ids'
import { NFR_CATEGORIES, type NfrCategory, type NotesDocument, type RequirementItem, type RequirementKind } from '@/types/notes'

/**
 * The requirements written for the current diagram.
 *
 * Kept out of diagramStore for the same reason the capacity workload is: none of this is canvas
 * state, nothing here belongs in the undo stack, and typing a sentence should not push a
 * snapshot. It is persisted with the document so the requirements travel with the design —
 * a diagram without the constraints it was drawn against is half the artifact.
 */
interface NotesState {
  items: RequirementItem[]

  add: (kind: RequirementKind, category?: NfrCategory) => void
  update: (id: string, patch: Partial<Pick<RequirementItem, 'title' | 'body' | 'category'>>) => void
  remove: (id: string) => void
  toggleDone: (id: string) => void

  /** For the persistence layer. */
  getPersistPayload: () => NotesDocument | undefined
  hydrate: (doc: NotesDocument | undefined) => void
  reset: () => void
}

export const useNotesStore = create<NotesState>()((set, get) => ({
  items: [],

  add: (kind, category) =>
    set((s) => {
      const now = new Date().toISOString()
      const item: RequirementItem = {
        id: generatePrefixedId('req'),
        kind,
        title: '',
        body: '',
        // Only non-functional items carry an axis; the default is the honest one.
        ...(kind === 'nonFunctional' ? { category: category ?? 'other' } : {}),
        done: false,
        createdAt: now,
        updatedAt: now,
      }
      return { items: [...s.items, item] }
    }),

  update: (id, patch) =>
    set((s) => ({
      items: s.items.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item
      ),
    })),

  remove: (id) => set((s) => ({ items: s.items.filter((item) => item.id !== id) })),

  toggleDone: (id) =>
    set((s) => ({
      items: s.items.map((item) =>
        item.id === id
          ? { ...item, done: !item.done, updatedAt: new Date().toISOString() }
          : item
      ),
    })),

  /**
   * Undefined rather than `{ items: [] }` when there is nothing written.
   *
   * Keeps the stored JSON free of a key for a feature the diagram never used, which is the
   * same rule the DSL document follows.
   */
  getPersistPayload: () => {
    const { items } = get()
    return items.length > 0 ? { items } : undefined
  },

  hydrate: (doc) => set({ items: normaliseItems(doc?.items) }),

  reset: () => set({ items: [] }),
}))

const KINDS: RequirementKind[] = ['functional', 'nonFunctional', 'assumption']

/**
 * Accept only items that are shaped like requirements.
 *
 * These come back from stored JSON, which a hand edit or an older client could have left in any
 * state. Dropping a malformed item beats rendering a card with `undefined` in its title.
 */
export function normaliseItems(raw: unknown): RequirementItem[] {
  if (!Array.isArray(raw)) return []

  const out: RequirementItem[] = []
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue
    const item = value as Record<string, unknown>

    const kind = KINDS.find((k) => k === item.kind)
    if (!kind) continue

    const id = typeof item.id === 'string' && item.id ? item.id : generatePrefixedId('req')
    const now = new Date().toISOString()

    const category = NFR_CATEGORIES.find((c) => c === item.category)

    out.push({
      id,
      kind,
      title: typeof item.title === 'string' ? item.title : '',
      body: typeof item.body === 'string' ? item.body : '',
      // Carried only where it means something, so a functional item cannot arrive with an axis.
      ...(kind === 'nonFunctional' ? { category: category ?? 'other' } : {}),
      done: item.done === true,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : now,
    })
  }
  return out
}

/** Counts per tab, for the panel's badges. */
export function countByKind(items: RequirementItem[]): Record<RequirementKind, number> {
  return {
    functional: items.filter((i) => i.kind === 'functional').length,
    nonFunctional: items.filter((i) => i.kind === 'nonFunctional').length,
    assumption: items.filter((i) => i.kind === 'assumption').length,
  }
}
