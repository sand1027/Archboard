'use client'

import { useState } from 'react'
import { useNotesStore } from '@/store/notesStore'
import {
  MAX_IMAGE_WIDTH_PCT,
  MIN_IMAGE_WIDTH_PCT,
  clampImageWidthPct,
  type NoteBlock,
  type NoteKind,
} from '@/types/notes'

/**
 * A picture on the page, with a corner you can drag.
 *
 * Width is a percent of the paper so it survives the notes rail changing size.
 * Height follows the image — locking aspect is what keeps a diagram from
 * stretching when you resize it. The editor, not this component, owns the
 * empty column to the right so a caret can sit there.
 */

export interface NotesImageProps {
  block: NoteBlock
  kind: NoteKind
  focused: boolean
  ruled?: boolean
  onFocus: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
  onRemove: () => void
  onCaption: (text: string) => void
}

export default function NotesImage({
  block,
  kind,
  focused,
  ruled,
  onFocus,
  onKeyDown,
  onRemove,
  onCaption,
}: NotesImageProps) {
  const setBlockWidth = useNotesStore((s) => s.setBlockWidth)
  const storedPct = clampImageWidthPct(block.widthPct ?? MAX_IMAGE_WIDTH_PCT)
  const [livePct, setLivePct] = useState<number | null>(null)
  const pct = livePct ?? storedPct

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onFocus()

    const row = event.currentTarget.closest('[data-image-row]')
    const paperWidth = row?.getBoundingClientRect().width
    if (!paperWidth) return

    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const originX = event.clientX
    const originPct = pct

    const onMove = (ev: PointerEvent) => {
      const next = clampImageWidthPct(originPct + ((ev.clientX - originX) / paperWidth) * 100)
      setLivePct(next)
    }

    const onUp = (ev: PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)

      const next = clampImageWidthPct(originPct + ((ev.clientX - originX) / paperWidth) * 100)
      setLivePct(null)
      if (next !== storedPct) setBlockWidth(kind, block.id, next)
    }

    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  return (
    <div className="relative w-full" style={{ width: '100%' }} onClick={onFocus}>
      <div
        data-block-id={block.id}
        tabIndex={0}
        role="img"
        aria-label={block.text || 'Image'}
        onFocus={onFocus}
        onDoubleClick={() => setBlockWidth(kind, block.id, MAX_IMAGE_WIDTH_PCT)}
        onKeyDown={(event) => {
          if (event.key === 'Backspace' || event.key === 'Delete') {
            event.preventDefault()
            event.stopPropagation()
            onRemove()
            return
          }
          onKeyDown(event)
        }}
        className={[
          'overflow-hidden rounded-lg border bg-white outline-none',
          focused ? 'border-slate-400 ring-2 ring-slate-300' : 'border-slate-200',
        ].join(' ')}
      >
        {block.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={block.src}
            alt={block.text || ''}
            draggable={false}
            className="block h-auto w-full select-none"
          />
        ) : (
          <div className="flex h-24 items-center justify-center text-[11px] text-slate-400">
            Missing image
          </div>
        )}
      </div>

      {focused && (
        <>
          <div
            role="separator"
            aria-hidden
            title="Drag to resize"
            onPointerDown={startResize}
            className="absolute inset-y-0 -right-1 z-10 w-2 cursor-ew-resize touch-none"
          />
          <div
            role="slider"
            aria-label="Resize image"
            aria-valuemin={MIN_IMAGE_WIDTH_PCT}
            aria-valuemax={MAX_IMAGE_WIDTH_PCT}
            aria-valuenow={pct}
            aria-valuetext={`${pct} percent`}
            title="Drag to resize"
            onPointerDown={startResize}
            className="absolute bottom-1 right-1 z-10 h-3.5 w-3.5 cursor-nwse-resize touch-none rounded-sm border-2 border-white bg-slate-800 shadow-sm"
          />
        </>
      )}

      <input
        value={block.text}
        onChange={(e) => onCaption(e.target.value)}
        onFocus={onFocus}
        placeholder="Caption"
        className={
          ruled
            ? 'h-7 w-full bg-transparent text-[11px] leading-7 text-slate-500 outline-none placeholder:text-slate-300'
            : 'mt-1 w-full bg-transparent text-[11px] text-slate-500 outline-none placeholder:text-slate-300'
        }
      />
    </div>
  )
}

export function imageWidthPct(block: NoteBlock): number {
  return clampImageWidthPct(block.widthPct ?? MAX_IMAGE_WIDTH_PCT)
}
