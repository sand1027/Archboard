'use client'

import { useEffect, useRef } from 'react'
import { useDiagramStore } from '@/store/diagramStore'
import { useUiStore } from '@/store/uiStore'
import type { BoardMode, BoardSnapshot } from '@/types/diagram'

const LEGACY_KEY = 'archboard-diagram'
const STORAGE_KEY = 'archboard-diagram-v2'
const AUTOSAVE_DELAY = 1500

function emptyBoard(name: string): BoardSnapshot {
  return {
    diagramId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    diagramName: name,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }
}

function migrateLegacy(): {
  activeBoard: BoardMode
  boards: { hld: BoardSnapshot; lld: BoardSnapshot }
} | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data?.nodes || !data?.edges) return null
    return {
      activeBoard: 'hld',
      boards: {
        hld: {
          diagramId: data.id ?? `migrated-${Date.now()}`,
          diagramName: data.name ?? 'Untitled Diagram',
          nodes: data.nodes,
          edges: data.edges,
          viewport: data.viewport ?? { x: 0, y: 0, zoom: 1 },
        },
        lld: emptyBoard('Untitled LLD'),
      },
    }
  } catch {
    return null
  }
}

export function useDiagramPersistence() {
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        if (data?.boards?.hld && data?.boards?.lld) {
          const activeBoard = data.activeBoard === 'lld' ? 'lld' : 'hld'
          useDiagramStore.getState().hydrateBoards({
            activeBoard,
            boards: data.boards,
          })
          useUiStore.getState().setBoardMode(activeBoard)
          return
        }
      }

      const migrated = migrateLegacy()
      if (migrated) {
        useDiagramStore.getState().hydrateBoards(migrated)
        useUiStore.getState().setBoardMode(migrated.activeBoard)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
        localStorage.removeItem(LEGACY_KEY)
      }
    } catch {
      // Silently ignore corrupt storage
    }
  }, [])

  useEffect(() => {
    const unsub = useDiagramStore.subscribe(
      (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        diagramName: state.diagramName,
        diagramId: state.diagramId,
        activeBoard: state.activeBoard,
        viewport: state.viewport,
      }),
      () => {
        if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
        autosaveTimer.current = setTimeout(() => {
          try {
            const payload = useDiagramStore.getState().getPersistPayload()
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
          } catch {
            // Storage full or unavailable
          }
        }, AUTOSAVE_DELAY)
      }
    )
    return () => {
      unsub()
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [])
}
