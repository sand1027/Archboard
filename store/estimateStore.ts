'use client'

import { create } from 'zustand'
import { DEFAULT_WORKLOAD, normaliseWorkload, sanitiseOverrides } from '@/lib/estimate/workload'
import type {
  EstimateOverrides,
  EstimateStepId,
  WorkloadDocument,
  WorkloadInputs,
} from '@/types/estimate'

/**
 * The capacity workload for the current diagram.
 *
 * Kept out of diagramStore because it is not canvas state — nothing here participates in
 * undo, and a change to it should not push a snapshot. It is persisted with the document
 * so the estimate travels with the design.
 */
interface EstimateState {
  inputs: WorkloadInputs
  /** Derived values the user has pinned, replacing the computed result. */
  overrides: EstimateOverrides

  setInput: (key: keyof WorkloadInputs, value: number) => void
  setInputs: (inputs: Partial<WorkloadInputs>) => void
  resetInputs: () => void

  setOverride: (id: EstimateStepId, value: number) => void
  clearOverride: (id: EstimateStepId) => void
  clearOverrides: () => void

  /** For the persistence layer. */
  getPersistPayload: () => WorkloadDocument
  hydrate: (doc: WorkloadDocument | undefined) => void
}

export const useEstimateStore = create<EstimateState>()((set, get) => ({
  inputs: { ...DEFAULT_WORKLOAD },
  overrides: {},

  setInput: (key, value) =>
    set((s) => ({
      // Normalising on every keystroke keeps a half-typed field from producing
      // Infinity downstream, and clamps nonsense like a peak factor below 1.
      inputs: normaliseWorkload({ ...s.inputs, [key]: value }),
    })),

  setInputs: (inputs) =>
    set((s) => ({ inputs: normaliseWorkload({ ...s.inputs, ...inputs }) })),

  resetInputs: () => set({ inputs: { ...DEFAULT_WORKLOAD } }),

  setOverride: (id, value) =>
    set((s) => ({ overrides: { ...s.overrides, [id]: value } })),

  clearOverride: (id) =>
    set((s) => {
      const next = { ...s.overrides }
      delete next[id]
      return { overrides: next }
    }),

  clearOverrides: () => set({ overrides: {} }),

  getPersistPayload: () => ({
    inputs: get().inputs,
    overrides: get().overrides,
  }),

  hydrate: (doc) =>
    set({
      inputs: normaliseWorkload(doc?.inputs),
      overrides: sanitiseOverrides(doc?.overrides),
    }),
}))
