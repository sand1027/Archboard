'use client'

import { useCallback, useState, useRef } from 'react'
import { useDiagramStore } from '@/store/diagramStore'
import { buildDocument } from '@/lib/persistence/documentPayload'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function useDiagramSync(diagramId: string) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const isSavingRef = useRef(false)

  // Manual save — called only when user clicks Save
  const save = useCallback(async () => {
    if (isSavingRef.current) return
    isSavingRef.current = true
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

      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } finally {
      isSavingRef.current = false
    }
  }, [diagramId])

  const saveVersion = useCallback(async (versionName: string, thumbnailUrl?: string) => {
    const payload = buildDocument()

    const res = await fetch(`/api/diagrams/${diagramId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: versionName, data: payload, thumbnail_url: thumbnailUrl }),
    })
    return res.ok
  }, [diagramId])

  return { saveStatus, save, saveVersion }
}
