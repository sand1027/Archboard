'use client'

import { useState } from 'react'
import { captureViewportRegion, MIN_CAPTURE_PX, normalizeClientRect } from '@/lib/notes/captureRegion'
import { useNotesStore } from '@/store/notesStore'
import { useUiStore } from '@/store/uiStore'

/**
 * Drag a rectangle on the canvas; that picture is appended to the open notes page.
 *
 * Lives as an overlay so React Flow does not treat the drag as a selection or a pan.
 */
export default function CaptureMarquee() {
  const active = useUiStore((s) => s.activeTool === 'capture')
  const setActiveTool = useUiStore((s) => s.setActiveTool)
  const [drag, setDrag] = useState<{ ax: number; ay: number; bx: number; by: number } | null>(null)

  if (!active) return null

  const box = drag ? normalizeClientRect(drag.ax, drag.ay, drag.bx, drag.by) : null

  return (
    <div
      data-capture-overlay="true"
      className="absolute inset-x-0 top-0 z-20 cursor-crosshair"
      style={{ bottom: 80 }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()

        const start = { ax: event.clientX, ay: event.clientY, bx: event.clientX, by: event.clientY }
        setDrag(start)

        const onMove = (ev: PointerEvent) => {
          setDrag({ ax: start.ax, ay: start.ay, bx: ev.clientX, by: ev.clientY })
        }

        const onUp = async (ev: PointerEvent) => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onUp)
          setDrag(null)

          const rect = normalizeClientRect(start.ax, start.ay, ev.clientX, ev.clientY)
          if (rect.w >= MIN_CAPTURE_PX && rect.h >= MIN_CAPTURE_PX) {
            const renderer = document.querySelector<HTMLElement>('.react-flow__renderer')
            const src = renderer ? await captureViewportRegion(renderer, rect) : null
            if (src) {
              const { activeKind, appendBlocks } = useNotesStore.getState()
              appendBlocks(activeKind, [{ type: 'image', text: '', src }])
              useUiStore.getState().setNotesOpen(true)
            }
          }

          setActiveTool('select')
        }

        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onUp)
      }}
    >
      <p className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-white">
        Drag to capture into notes
      </p>
      {box && box.w > 2 && box.h > 2 && (
        <div
          className="pointer-events-none fixed rounded-sm border-2 border-teal-500 bg-teal-400/15"
          style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        />
      )}
    </div>
  )
}
