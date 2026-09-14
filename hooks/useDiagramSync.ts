'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { useDiagramStore } from '@/store/diagramStore'
import { useDslStore } from '@/store/dslStore'
import { useEstimateStore } from '@/store/estimateStore'
import { useLldStore } from '@/store/lldStore'
import { buildDocument } from '@/lib/persistence/documentPayload'

/**
 * Cloud persistence for one diagram.
 *
 * Saving used to be manual only. Local autosave ran every second or so into localStorage, so
 * the app felt like it was saving while the cloud copy could be an hour stale — and closing
 * the tab on another machine, or clearing site data, lost the lot. Anyone who did not notice
 * the Save button had no way to know.
 *
 * So there are now three layers: a debounced cloud autosave, a `dirty` flag the toolbar can
 * show, and a browser warning if the tab closes with work still unsent.
 */

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Long enough that a drag or a burst of typing is one save rather than thirty, short enough
 * that walking away from the keyboard leaves nothing behind.
 */
const AUTOSAVE_DELAY = 2500

export interface DiagramSync {
  saveStatus: SaveStatus
  /** True when the document has changed since the last successful cloud save. */
  dirty: boolean
  save: () => Promise<void>
  saveVersion: (versionName: string, thumbnailUrl?: string) => Promise<boolean>
}

export function useDiagramSync(diagramId: string): DiagramSync {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [dirty, setDirty] = useState(false)
  const isSavingRef = useRef(false)

  /**
   * Whether a change arrived while a save was in flight.
   *
   * Without this the flag is cleared on a response that only covers the document as it was
   * when the request left, so the last edit of a burst could look saved when it was not.
   */
  const changedDuringSave = useRef(false)

  /** Last seen DSL document state, for the store without selector middleware. */
  const lastDsl = useRef<{ source: string; pins: unknown }>({
    source: useDslStore.getState().source,
    pins: useDslStore.getState().pins,
  })

  const save = useCallback(async () => {
    if (isSavingRef.current) return
    isSavingRef.current = true
    changedDuringSave.current = false
    setSaveStatus('saving')

    try {
      const name = useDiagramStore.getState().diagramName
      const payload = buildDocument()

      const res = await fetch(`/api/diagrams/${diagramId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data: payload }),
      })
      if (!res.ok) throw new Error('Save failed')

      // Anything edited mid-flight is still unsent, so it stays dirty and the next debounce
      // picks it up.
      setDirty(changedDuringSave.current)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      // Left dirty on purpose: the work is still only local, and the indicator should say so.
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } finally {
      isSavingRef.current = false
    }
  }, [diagramId])

  // ── mark dirty, then autosave ───────────────────────────────────────────────
  useEffect(() => {
    const timer = { current: null as ReturnType<typeof setTimeout> | null }

    const onChange = () => {
      setDirty(true)
      if (isSavingRef.current) changedDuringSave.current = true

      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        timer.current = null
        void save()
      }, AUTOSAVE_DELAY)
    }

    /*
     * The same four stores the local autosave watches, for the same reason: everything here
     * ends up in `buildDocument`, so a change to any of them means the cloud copy is behind.
     * Watching only the canvas would quietly drop capacity and code edits.
     */
    const unsubscribe = [
      useDiagramStore.subscribe(
        (state) => ({
          nodes: state.nodes,
          edges: state.edges,
          diagramName: state.diagramName,
          activeBoard: state.activeBoard,
        }),
        onChange
      ),
      useLldStore.subscribe((state) => state.workspaces, onChange),
      useEstimateStore.subscribe(onChange),
      // dslStore has no selector middleware, so compare by hand rather than firing on every
      // update: `diagnostics` changes on each recompile and is derived, not document state.
      useDslStore.subscribe((state) => {
        if (state.source === lastDsl.current.source && state.pins === lastDsl.current.pins) return
        lastDsl.current = { source: state.source, pins: state.pins }
        onChange()
      }),
    ]

    return () => {
      if (timer.current) clearTimeout(timer.current)
      for (const off of unsubscribe) off()
    }
  }, [save])

  /**
   * Last line of defence.
   *
   * The debounce means there is always a window where work exists only in this tab, and a
   * failed save leaves one open indefinitely. The browser's own prompt is the only thing that
   * can interrupt a close.
   */
  useEffect(() => {
    if (!dirty) return

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Set for older browsers, which required a truthy returnValue to show the prompt.
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const saveVersion = useCallback(
    async (versionName: string, thumbnailUrl?: string) => {
      const payload = buildDocument()

      const res = await fetch(`/api/diagrams/${diagramId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: versionName, data: payload, thumbnail_url: thumbnailUrl }),
      })
      return res.ok
    },
    [diagramId]
  )

  return { saveStatus, dirty, save, saveVersion }
}
