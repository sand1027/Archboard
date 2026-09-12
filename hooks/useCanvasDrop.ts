'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useReactFlow, type XYPosition } from '@xyflow/react'
import { readDragPayload, type DndMime } from '@/lib/canvas/dnd'

export interface CanvasDropHandler {
  mime: DndMime
  /** `position` is already converted to flow coordinates. */
  onDrop: (payloadId: string, position: XYPosition) => void
}

/**
 * Shared canvas drop plumbing: preventDefault + copy cursor + screen→flow
 * conversion + first-matching-MIME dispatch.
 *
 * Handlers are tried in order, so put more specific MIME types first.
 *
 * Callers pass an inline array, which is a new reference every render. Rather
 * than memoising on the MIME list — which would freeze the handler closures at
 * first render and silently drop later state — the latest array is kept in a
 * ref. `onDrop` stays referentially stable while always calling current
 * closures.
 */
export function useCanvasDrop(handlers: CanvasDropHandler[]) {
  const { screenToFlowPosition } = useReactFlow()

  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      for (const handler of handlersRef.current) {
        const id = readDragPayload(e, handler.mime)
        if (!id) continue

        // Only claim the event once a handler actually matches, so an unrelated
        // drop (a file, text from elsewhere) still bubbles normally.
        e.preventDefault()
        handler.onDrop(id, screenToFlowPosition({ x: e.clientX, y: e.clientY }))
        return
      }
    },
    [screenToFlowPosition]
  )

  return { onDragOver, onDrop }
}
