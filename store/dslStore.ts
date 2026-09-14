'use client'

import { create } from 'zustand'
import type { Point } from '@/lib/canvas/autoLayout'
import type { DslDocument } from '@/types/dslDocument'
import { emptyDslDocument } from '@/types/dslDocument'
import type { Diagnostic } from '@/types/dsl'
import type { LayoutDirection } from '@/lib/canvas/autoLayout'

/**
 * The DSL source for the current diagram, and the pins that keep coordinates out of it.
 *
 * Separate from diagramStore because this is not canvas state: typing a character should not
 * push an undo snapshot for the canvas, and the compiled nodes are derived rather than
 * edited. Persisted with the document so the code travels with the design.
 */
interface DslState {
  source: string
  /** Manual positions by DSL name. */
  pins: Record<string, Point>
  /** True once the diagram is being authored as text. */
  enabled: boolean
  direction: LayoutDirection
  /** Latest compile diagnostics, for the editor gutter. */
  diagnostics: Diagnostic[]

  setSource: (source: string) => void
  setDiagnostics: (diagnostics: Diagnostic[]) => void
  setEnabled: (enabled: boolean) => void
  setDirection: (direction: LayoutDirection) => void

  /** Record where the user dragged a node to, by DSL name. */
  pin: (name: string, point: Point) => void
  unpin: (name: string) => void
  /** Replace every pin at once — used when seeding from an existing canvas. */
  setPins: (pins: Record<string, Point>) => void
  clearPins: () => void
  /** Drop pins whose name is no longer in the source, so they cannot resurrect. */
  prunePins: (liveNames: string[]) => void

  getPersistPayload: () => DslDocument
  hydrate: (doc: DslDocument | undefined) => void
  reset: () => void
}

export const useDslStore = create<DslState>()((set, get) => ({
  ...emptyDslDocument(),
  direction: 'down',
  diagnostics: [],

  // The moment there is code, the code is the truth — so writing any becomes the trigger for
  // text being authoritative. Nothing else has to remember to flip the flag.
  setSource: (source) => set({ source, enabled: source.trim().length > 0 }),

  setDiagnostics: (diagnostics) => set({ diagnostics }),

  setEnabled: (enabled) => set({ enabled }),

  setDirection: (direction) => set({ direction }),

  pin: (name, point) =>
    set((s) => ({ pins: { ...s.pins, [name]: { x: point.x, y: point.y } } })),

  unpin: (name) =>
    set((s) => {
      const next = { ...s.pins }
      delete next[name]
      return { pins: next }
    }),

  setPins: (pins) => set({ pins: normalisePins(pins) }),

  clearPins: () => set({ pins: {} }),

  prunePins: (liveNames) =>
    set((s) => {
      const live = new Set(liveNames)
      const next: Record<string, Point> = {}
      for (const [name, point] of Object.entries(s.pins)) {
        if (live.has(name)) next[name] = point
      }
      // Only replace when something actually went, so subscribers do not rerender for nothing.
      return Object.keys(next).length === Object.keys(s.pins).length ? {} : { pins: next }
    }),

  getPersistPayload: () => ({
    source: get().source,
    pins: get().pins,
    enabled: get().enabled,
  }),

  hydrate: (doc) =>
    set({
      source: doc?.source ?? '',
      pins: normalisePins(doc?.pins),
      enabled: doc?.enabled ?? false,
      diagnostics: [],
    }),

  reset: () => set({ ...emptyDslDocument(), diagnostics: [] }),
}))

/**
 * Keep only finite coordinate pairs.
 *
 * Pins come back from stored JSON, so a hand-edited or older document could carry a string
 * or a null where a number belongs — and a NaN position puts a node somewhere React Flow
 * cannot render it back from.
 */
export function normalisePins(raw: unknown): Record<string, Point> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  const out: Record<string, Point> = {}
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const { x, y } = value as Record<string, unknown>
    if (typeof x !== 'number' || !Number.isFinite(x)) continue
    if (typeof y !== 'number' || !Number.isFinite(y)) continue
    out[name] = { x, y }
  }
  return out
}
