'use client'

import { create } from 'zustand'
import type { DiagramSnapshot } from '@/types/diagram'

const MAX_HISTORY = 50

interface HistoryState {
  past: DiagramSnapshot[]
  future: DiagramSnapshot[]
  canUndo: boolean
  canRedo: boolean

  pushSnapshot: (snapshot: DiagramSnapshot) => void
  undo: (currentSnapshot: DiagramSnapshot) => DiagramSnapshot | null
  redo: (currentSnapshot: DiagramSnapshot) => DiagramSnapshot | null
  clearHistory: () => void
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  pushSnapshot: (snapshot) =>
    set((state) => {
      const past = [...state.past, snapshot].slice(-MAX_HISTORY)
      return {
        past,
        future: [],
        canUndo: past.length > 0,
        canRedo: false,
      }
    }),

  undo: (currentSnapshot) => {
    const { past } = get()
    if (past.length === 0) return null

    const newPast = past.slice(0, -1)
    const snapshot = past[past.length - 1]

    set((state) => ({
      past: newPast,
      future: [currentSnapshot, ...state.future].slice(0, MAX_HISTORY),
      canUndo: newPast.length > 0,
      canRedo: true,
    }))

    return snapshot
  },

  redo: (currentSnapshot) => {
    const { future } = get()
    if (future.length === 0) return null

    const [snapshot, ...newFuture] = future

    set((state) => ({
      past: [...state.past, currentSnapshot].slice(-MAX_HISTORY),
      future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
    }))

    return snapshot
  },

  clearHistory: () =>
    set({ past: [], future: [], canUndo: false, canRedo: false }),
}))
