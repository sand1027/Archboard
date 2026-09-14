'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'

/**
 * The overflow menu for actions that do not earn permanent space.
 *
 * The top bar had been growing by roughly ninety pixels per feature, and had twice overflowed
 * far enough to push Export and the account controls off the right edge. Trimming labels bought
 * a release each time and then the next feature spent it.
 *
 * This is the structural answer: things used once at the start of a session — pick a template,
 * check the shortcuts, open history — live behind one fixed-width button, so adding another
 * costs a row in a list rather than another slice of the bar.
 */

export interface ToolbarMenuItem {
  label: string
  icon: React.ReactNode
  onSelect: () => void
  /** Shown right-aligned, for a keyboard shortcut. */
  hint?: string
}

export default function ToolbarMenu({ items }: { items: ToolbarMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  /*
   * Close on an outside click or Escape.
   *
   * `mousedown` rather than `click`, so the menu is gone before whatever was underneath it
   * receives the press — closing on click lets the first press outside land on the canvas and
   * start a drag.
   */
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (items.length === 0) return null

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="More"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className={[
          'flex items-center rounded-lg p-1.5 transition-colors',
          open ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
        ].join(' ')}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[190px] rounded-xl border border-slate-200/80 bg-white p-1 shadow-xl shadow-slate-200/60"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                // Closed first, so a dialog opened by the action is not sitting behind a menu.
                setOpen(false)
                item.onSelect()
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-100"
            >
              <span className="shrink-0 text-slate-400">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.hint && <span className="shrink-0 text-[10px] text-slate-400">{item.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
