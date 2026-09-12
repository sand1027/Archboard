'use client'

import Link from 'next/link'
import { ChevronLeft, Layers, Redo2, Undo2 } from 'lucide-react'
import { useLldHistoryFlags, useLldStore } from '@/store/lldStore'

/**
 * Workspace header and the way back to the HLD canvas.
 *
 * The repo has no breadcrumb pattern yet — navigation elsewhere is imperative
 * router.push. The back-link is a real anchor so it is keyboard-focusable and
 * behaves like a link (middle-click, open in new tab).
 */
export default function LldBreadcrumb({
  diagramId,
  diagramName,
  scopeId,
  title,
  activeDiagramId,
  children,
}: {
  diagramId: string
  diagramName: string
  scopeId: string
  title: string
  activeDiagramId: string | null
  children?: React.ReactNode
}) {
  const undo = useLldStore((s) => s.undo)
  const redo = useLldStore((s) => s.redo)
  const { canUndo, canRedo } = useLldHistoryFlags(scopeId, activeDiagramId)

  return (
    <header className="flex items-center gap-3 border-b border-slate-200/80 bg-white px-3 py-2">
      <Link
        href={`/diagram/${diagramId}`}
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="max-w-[200px] truncate">{diagramName}</span>
      </Link>

      <span className="text-slate-300" aria-hidden>
        /
      </span>

      <div className="flex min-w-0 items-center gap-1.5">
        <Layers className="h-4 w-4 shrink-0 text-slate-400" />
        <h1 className="truncate text-sm font-semibold text-slate-800">{title}</h1>
        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          LLD
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          disabled={!canUndo}
          onClick={() => activeDiagramId && undo(scopeId, activeDiagramId)}
          aria-label="Undo"
          title="Undo"
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={() => activeDiagramId && redo(scopeId, activeDiagramId)}
          aria-label="Redo"
          title="Redo"
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Redo2 className="h-4 w-4" />
        </button>
        {children}
      </div>
    </header>
  )
}
