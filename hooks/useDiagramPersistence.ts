'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDiagramStore } from '@/store/diagramStore'
import { useLldStore } from '@/store/lldStore'
import { useNotesStore } from '@/store/notesStore'
import { useEstimateStore } from '@/store/estimateStore'
import {
  applyRawDocument,
  buildDocument,
  migrateDocument,
} from '@/lib/persistence/documentPayload'

const LEGACY_KEYS = ['archboard-diagram', 'archboard-diagram-v2']
const STORAGE_KEY = 'archboard-diagram-v3'

export type LocalSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Browser-only persistence for guest mode.
 *
 * Hydrates from localStorage on load, then writes only when `save` is called. Cloud diagrams
 * do not use this path — they load from the server and save through `useDiagramSync`.
 */
export function useDiagramPersistence(enabled: boolean): {
  dirty: boolean
  saveStatus: LocalSaveStatus
  save: () => void
} {
  const [dirty, setDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<LocalSaveStatus>('idle')

  useEffect(() => {
    if (!enabled) return

    try {
      const current = localStorage.getItem(STORAGE_KEY)
      if (current && applyRawDocument(JSON.parse(current))) {
        // Loaded. Fall through to the dirty subscription below.
      } else {
        for (const key of LEGACY_KEYS) {
          const raw = localStorage.getItem(key)
          if (!raw) continue

          const migrated = migrateDocument(JSON.parse(raw))
          if (!migrated) continue

          applyRawDocument(migrated)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
          localStorage.removeItem(key)
          break
        }
      }
    } catch {
      // Corrupt storage — fall through to store defaults.
    }

    const onChange = () => setDirty(true)

    const unsubDiagram = useDiagramStore.subscribe(
      (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        diagramName: state.diagramName,
        diagramId: state.diagramId,
        activeBoard: state.activeBoard,
        viewport: state.viewport,
      }),
      onChange
    )
    const unsubLld = useLldStore.subscribe((state) => state.workspaces, onChange)
    const unsubEstimate = useEstimateStore.subscribe(onChange)
    const unsubNotes = useNotesStore.subscribe(onChange)

    return () => {
      unsubDiagram()
      unsubLld()
      unsubEstimate()
      unsubNotes()
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !dirty) return

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, enabled])

  const save = useCallback(() => {
    if (!enabled) return

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildDocument()))
      setDirty(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('[archboard] local save failed', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }, [enabled])

  return { dirty, saveStatus, save }
}
