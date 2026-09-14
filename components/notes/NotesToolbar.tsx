'use client'

import { useRef } from 'react'
import { Heading1, Heading2, Image as ImageIcon, List, Redo2, Type, Undo2 } from 'lucide-react'
import { focusBlockById } from './NotesEditor'
import { pageFor, useNotesStore } from '@/store/notesStore'
import {
  FONT_LABEL,
  PAPER_LABEL,
  type BlockType,
  type NoteFont,
  type NotePage,
  type PaperStyle,
} from '@/types/notes'

/**
 * Formatting for the page, and for whichever block has the caret.
 *
 * Paper and font belong to the page, so they apply to everything on it. Block type applies to
 * the focused block alone — which is why the block buttons go dead when nothing is focused
 * rather than silently formatting the first block. Image is an insert, not a restyle.
 */

const PAPERS: PaperStyle[] = ['unruled', 'ruled']
const FONTS: NoteFont[] = ['sans', 'serif', 'mono']

const TEXT_BLOCKS: { type: BlockType; label: string; title: string; icon: typeof Heading1 }[] = [
  { type: 'heading', label: 'Sec', title: 'Section', icon: Heading1 },
  { type: 'subheading', label: 'Sub', title: 'Subsection', icon: Heading2 },
  { type: 'body', label: 'Body', title: 'Body', icon: Type },
  { type: 'bullet', label: 'List', title: 'Bullet list', icon: List },
]

/** Keep pasted photos out of the localStorage quota. */
const MAX_IMAGE_BYTES = 800_000

export interface NotesToolbarProps {
  page: NotePage
  /** The block with the caret, if any. */
  focusedBlockId: string | null
}

export default function NotesToolbar({ page, focusedBlockId }: NotesToolbarProps) {
  const setPaper = useNotesStore((s) => s.setPaper)
  const setFont = useNotesStore((s) => s.setFont)
  const setBlockType = useNotesStore((s) => s.setBlockType)
  const insertBlockAfter = useNotesStore((s) => s.insertBlockAfter)
  const appendBlocks = useNotesStore((s) => s.appendBlocks)
  const canUndo = useNotesStore((s) => s.canUndo)
  const canRedo = useNotesStore((s) => s.canRedo)
  const undo = useNotesStore((s) => s.undo)
  const redo = useNotesStore((s) => s.redo)
  const fileRef = useRef<HTMLInputElement>(null)

  const focused = page.blocks.find((b) => b.id === focusedBlockId) ?? null
  const anchorId = focused?.id ?? page.blocks.at(-1)?.id

  const applyType = (type: BlockType) => {
    if (focused && focused.type !== 'image') {
      setBlockType(page.kind, focused.id, type)
      return
    }
    if (!anchorId) return
    const id = insertBlockAfter(page.kind, anchorId, type, '')
    requestAnimationFrame(() => focusBlockById(id, 'end'))
  }

  const importImage = (file: File) => {
    if (!file.type.startsWith('image/')) return
    if (file.size > MAX_IMAGE_BYTES) {
      window.alert('That image is too large for notes (max about 800KB).')
      return
    }

    const kind = page.kind
    const focusedId = focused?.id
    const caption = file.name.replace(/\.[^.]+$/, '')

    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (!src) return

      const current = pageFor(useNotesStore.getState().pages, kind)
      const last = current.blocks.at(-1)
      const after = focusedId ?? last?.id
      const draft = { type: 'image' as const, text: caption, src }

      // An empty last line is leftover paper, not writing — drop it the same way canvas import does.
      const id =
        !after || (!focusedId && last && last.type !== 'image' && last.text.trim() === '')
          ? appendBlocks(kind, [draft])
          : insertBlockAfter(kind, after, 'image', caption, src)

      if (id) requestAnimationFrame(() => focusBlockById(id, 'end'))
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-200/80 bg-white px-3 py-2">
      <div className="flex items-center gap-0.5" role="group" aria-label="Undo">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={undo}
          disabled={!canUndo}
          title="Undo (⌘Z)"
          className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={redo}
          disabled={!canRedo}
          title="Redo (⌘⇧Z)"
          className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="h-4 w-px bg-slate-200" />

      <div className="flex items-center gap-0.5" role="group" aria-label="Block style">
        {TEXT_BLOCKS.map((item) => (
          <button
            key={item.type}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyType(item.type)}
            title={item.title}
            aria-pressed={focused?.type === item.type}
            className={[
              'flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors',
              focused?.type === item.type
                ? 'bg-slate-900 text-white'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
            ].join(' ')}
          >
            <item.icon className="h-3 w-3" />
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          title="Import image to notes"
          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        >
          <ImageIcon className="h-3 w-3" />
          Img
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) importImage(file)
          }}
        />
      </div>

      <div className="h-4 w-px bg-slate-200" />

      <div className="flex items-center gap-0.5" role="group" aria-label="Paper">
        {PAPERS.map((paper) => (
          <button
            key={paper}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPaper(page.kind, paper)}
            aria-pressed={page.paper === paper}
            className={[
              'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
              page.paper === paper
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
            ].join(' ')}
          >
            {PAPER_LABEL[paper]}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-slate-200" />

      <div className="flex items-center gap-0.5" role="group" aria-label="Font">
        {FONTS.map((font) => (
          <button
            key={font}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setFont(page.kind, font)}
            aria-pressed={page.font === font}
            className={[
              'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
              page.font === font
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
            ].join(' ')}
          >
            {FONT_LABEL[font]}
          </button>
        ))}
      </div>
    </div>
  )
}
