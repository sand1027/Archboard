'use client'

import { useEffect, useRef } from 'react'
import { useDiagramStore } from '@/store/diagramStore'

const STORAGE_KEY = 'archboard-diagram'
const AUTOSAVE_DELAY = 1500

export function useDiagramPersistence() {
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        if (data?.nodes && data?.edges) {
          useDiagramStore.getState().loadDiagram({
            id: data.id,
            name: data.name ?? 'Untitled Diagram',
            nodes: data.nodes,
            edges: data.edges,
            viewport: data.viewport,
          })
        }
      }
    } catch {
      // Silently ignore corrupt storage
    }
  }, [])

  // Subscribe and autosave
  useEffect(() => {
    const unsub = useDiagramStore.subscribe(
      (state) => ({ nodes: state.nodes, edges: state.edges, diagramName: state.diagramName, diagramId: state.diagramId }),
      (state) => {
        if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
        autosaveTimer.current = setTimeout(() => {
          try {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({
                id: state.diagramId,
                name: state.diagramName,
                nodes: state.nodes,
                edges: state.edges,
                viewport: useDiagramStore.getState().viewport,
              })
            )
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
