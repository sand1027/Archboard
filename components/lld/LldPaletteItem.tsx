'use client'

import { useCallback, useRef } from 'react'
import { DND_MIME, setDragPayload } from '@/lib/canvas/dnd'
import { LldShapePreview } from './LldShapePreview'
import type { LldShapeEntry } from '@/types/lld'

/**
 * Palette tile.
 *
 * Mirrors components/library/ComponentItem exactly so LLD drag-and-drop feels
 * identical to HLD: an offscreen 40×40 preview is used as the drag image with a
 * centred (20,20) hotspot, so the cursor sits at the middle of the ghost and the
 * dropped shape lands centred under the pointer.
 */
export default function LldPaletteItem({
  entry,
  onAdd,
}: {
  entry: LldShapeEntry
  onAdd: (entry: LldShapeEntry) => void
}) {
  const dragImageRef = useRef<HTMLDivElement>(null)

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      setDragPayload(e, DND_MIME.lldShape, entry.id)
      if (dragImageRef.current) {
        e.dataTransfer.setDragImage(dragImageRef.current, 20, 20)
      }
    },
    [entry.id]
  )

  return (
    <>
      {/* Offscreen drag ghost — same technique as the HLD palette. */}
      <div
        ref={dragImageRef}
        aria-hidden
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          background: 'transparent',
        }}
      >
        <LldShapePreview spawn={entry.spawn} className="h-10 w-10" />
      </div>

      <button
        type="button"
        draggable
        onDragStart={handleDragStart}
        onClick={() => onAdd(entry)}
        title={`${entry.name} — ${entry.description}`}
        className="flex w-full cursor-grab select-none flex-col items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white p-2.5 text-left transition-all duration-150 hover:border-slate-300 hover:shadow-sm hover:shadow-slate-200/60 active:cursor-grabbing"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
          <LldShapePreview spawn={entry.spawn} className="h-6 w-6" />
        </span>
        <span className="line-clamp-2 w-full text-center text-[10px] font-medium leading-tight text-slate-700">
          {entry.name}
        </span>
      </button>
    </>
  )
}
