'use client'

import { useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useThumbnail(diagramId: string, userId: string) {
  const supabase = createClient()

  const capture = useCallback(async (): Promise<string | null> => {
    try {
      // Find the ReactFlow viewport element
      const flowEl = document.querySelector('.react-flow') as HTMLElement | null
      if (!flowEl) return null

      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(flowEl, {
        backgroundColor: '#ffffff',
        pixelRatio: 1.5,
        width: 800,
        height: 450,
        filter: (node: HTMLElement) => {
          const cls = node.classList
          return (
            !cls?.contains('react-flow__minimap') &&
            !cls?.contains('react-flow__controls') &&
            !cls?.contains('react-flow__panel')
          )
        },
      })

      // Convert dataUrl → Blob
      const res = await fetch(dataUrl)
      const blob = await res.blob()

      const filePath = `${userId}/${diagramId}/thumb.png`

      const { data, error } = await supabase.storage
        .from('thumbnails')
        .upload(filePath, blob, {
          contentType: 'image/png',
          upsert: true,
        })

      if (error) return null

      const { data: urlData } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(filePath)

      // Add cache-busting timestamp
      return `${urlData.publicUrl}?t=${Date.now()}`
    } catch {
      return null
    }
  }, [diagramId, userId, supabase])

  return { capture }
}
