'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, NotebookPen, X } from 'lucide-react'
import NotesEditor, { focusBlockById } from './NotesEditor'
import NotesPaper from './NotesPaper'
import NotesPrompts from './NotesPrompts'
import NotesToolbar from './NotesToolbar'
import { exportNotesPdf } from '@/lib/notes/exportPdf'
import { useDiagramStore } from '@/store/diagramStore'
import { pageFor, useNotesStore, wordCount } from '@/store/notesStore'
import { useUiStore } from '@/store/uiStore'
import { KIND_LABEL, KIND_TAB, NOTE_KINDS } from '@/types/notes'

/**
 * The notebook: FR, NFR, Assumptions, Trade-offs and Scratch, kept beside the diagram.
 *
 * Separate pages rather than headings on one, because the point is that each gets written. A
 * page with a tab and a word count is harder to leave blank than a section you can scroll past.
 */
export default function NotesNotebook() {
  const pages = useNotesStore((s) => s.pages)
  const activeKind = useNotesStore((s) => s.activeKind)
  const setActiveKind = useNotesStore((s) => s.setActiveKind)
  const insertBlockAfter = useNotesStore((s) => s.insertBlockAfter)
  const undo = useNotesStore((s) => s.undo)
  const redo = useNotesStore((s) => s.redo)
  const setNotesOpen = useUiStore((s) => s.setNotesOpen)

  /** Which block the caret is in, so the toolbar knows what it is formatting. */
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null)
  const [exportingPdf, setExportingPdf] = useState(false)

  const downloadPdf = useCallback(async () => {
    setExportingPdf(true)
    try {
      await exportNotesPdf(useNotesStore.getState().pages, useDiagramStore.getState().diagramName)
    } catch {
      window.alert('Could not export notes as PDF.')
    } finally {
      setExportingPdf(false)
    }
  }, [])

  const page = useMemo(() => pageFor(pages, activeKind), [pages, activeKind])
  const words = useMemo(() => wordCount(pages), [pages])

  /**
   * Put the caret on the page when the bare sheet is pressed.
   *
   * Lands on the last block, adding one if it already has text — so a click below the writing
   * continues it rather than jumping back into the middle of what is already there.
   */
  const startWriting = useCallback(() => {
    const last = page.blocks.at(-1)
    if (!last) return

    if (last.type !== 'image' && last.text.trim() === '') {
      focusBlockById(last.id, 'end')
      return
    }
    const id = insertBlockAfter(activeKind, last.id, last.type === 'bullet' ? 'bullet' : 'body', '')
    requestAnimationFrame(() => focusBlockById(id, 'end'))
  }, [activeKind, insertBlockAfter, page.blocks])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return
      const root = (event.target as HTMLElement | null)?.closest?.('[data-notes-root]')
      if (!root) return
      event.preventDefault()
      event.stopPropagation()
      if (event.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [redo, undo])

  return (
    <div data-notes-root className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-600">
            <NotebookPen className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-900">Notes</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={downloadPdf}
            disabled={exportingPdf}
            aria-label="Download notes as PDF"
            title="Download notes as PDF"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-white hover:text-slate-800 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </button>
          <button
            type="button"
            onClick={() => setNotesOpen(false)}
            aria-label="Close notes"
            className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/*
        Compact pills, one wrapping row.

        A second stretched row of "Assumptions" / "Trade-offs" read as extra sections on
        whatever page you were on — so opening FR looked like it had also opened NFR and
        the rest. These are just switches; only the active page renders below.
      */}
      <div
        className="flex shrink-0 flex-wrap gap-0.5 border-b border-slate-200/80 bg-slate-50 px-2 py-2"
        role="tablist"
        aria-label="Notebook page"
      >
        {NOTE_KINDS.map((kind) => {
          const active = kind === activeKind
          const written = pageFor(pages, kind).blocks.some((b) => b.text.trim() !== '')

          return (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={active}
              title={KIND_LABEL[kind]}
              onClick={() => {
                setActiveKind(kind)
                setFocusedBlockId(null)
              }}
              className={[
                'flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                active
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:bg-white/70 hover:text-slate-800',
              ].join(' ')}
            >
              {KIND_TAB[kind]}
              {written && (
                <span
                  aria-hidden
                  className={['h-1.5 w-1.5 rounded-full', active ? 'bg-slate-900' : 'bg-slate-300'].join(
                    ' '
                  )}
                />
              )}
            </button>
          )
        })}
      </div>

      <p className="shrink-0 border-b border-slate-200/80 px-3 py-1.5 text-xs font-semibold text-slate-800">
        {KIND_LABEL[activeKind]}
      </p>

      <NotesToolbar page={page} focusedBlockId={focusedBlockId} />

      {/*
        One scroller, one page. Keyed as a unit so FR's questions and paper cannot linger
        when you switch to Scratch.
      */}
      <div key={activeKind} className="min-h-0 flex-1 overflow-y-auto">
        <NotesPrompts page={page} />
        <NotesPaper paper={page.paper} font={page.font} onPressEmptyArea={startWriting}>
          <NotesEditor page={page} focusedBlockId={focusedBlockId} onFocusBlock={setFocusedBlockId} />
        </NotesPaper>
      </div>

      {/* Status */}
      <div className="flex shrink-0 items-center gap-2 border-t border-slate-200/80 px-4 py-1.5 text-[10px] text-slate-400">
        <span>{KIND_LABEL[activeKind]}</span>
        <span className="ml-auto">
          {words === 0 ? 'Empty' : `${words} word${words === 1 ? '' : 's'}`}
        </span>
      </div>
    </div>
  )
}
