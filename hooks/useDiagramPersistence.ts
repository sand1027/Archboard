'use client'

import { useEffect, useRef } from 'react'
import { useDiagramStore } from '@/store/diagramStore'
import { useLldStore } from '@/store/lldStore'
import {
  applyRawDocument,
  buildDocument,
  migrateDocument,
} from '@/lib/persistence/documentPayload'

const LEGACY_KEYS = ['archboard-diagram', 'archboard-diagram-v2']
const STORAGE_KEY = 'archboard-diagram-v3'
const AUTOSAVE_DELAY = 1500

export function useDiagramPersistence() {
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── hydrate once, migrating forward from any older key ────────────────────
  useEffect(() => {
    try {
      const current = localStorage.getItem(STORAGE_KEY)
      if (current && applyRawDocument(JSON.parse(current))) return

      for (const key of LEGACY_KEYS) {
        const raw = localStorage.getItem(key)
        if (!raw) continue

        const migrated = migrateDocument(JSON.parse(raw))
        if (!migrated) continue

        applyRawDocument(migrated)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
        localStorage.removeItem(key)
        return
      }
    } catch {
      // Corrupt storage — fall through to store defaults.
    }
  }, [])

  // ── debounced autosave, covering both the HLD boards and LLD workspaces ───
  useEffect(() => {
    const scheduleSave = () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
      autosaveTimer.current = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(buildDocument()))
        } catch (err) {
          // Quota exceeded is the realistic failure here, and the document now
          // grows with LLD content. Surface it instead of failing silently.
          console.error('[archboard] local autosave failed', err)
        }
      }, AUTOSAVE_DELAY)
    }

    const unsubDiagram = useDiagramStore.subscribe(
      (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        diagramName: state.diagramName,
        diagramId: state.diagramId,
        activeBoard: state.activeBoard,
        viewport: state.viewport,
      }),
      scheduleSave
    )

    const unsubLld = useLldStore.subscribe((state) => state.workspaces, scheduleSave)

    return () => {
      unsubDiagram()
      unsubLld()
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [])
}
