'use client'

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import NotesImage from './NotesImage'
import { useNotesStore } from '@/store/notesStore'
import {
  NOTE_LINE_HEIGHT,
  PLACEHOLDER,
  type BlockType,
  type NoteBlock,
  type NotePage,
} from '@/types/notes'

/**
 * The writing surface: one `contentEditable` per text block, plus image blocks.
 *
 * Per block rather than one editable document, because a single editable region means parsing
 * and sanitising HTML to work out what the user meant. A block owns a string, and its type is a
 * property of the block — so the stored document is plain text and needs no sanitiser.
 *
 * The hard part is that React and `contentEditable` both want to own the DOM. Text is written in
 * imperatively and only when it differs from what is already there, so a re-render triggered by
 * anything else on the page cannot reset the node and drop the caret mid-word.
 */

/**
 * Sections look like OneNote titles; subsections sit under them.
 *
 * Headings used to be uppercase labels, which read as form chrome rather than as the start of a
 * section you were writing. Images skip the 28px rhythm on purpose — a picture is not a line.
 */
const BLOCK_CLASS: Record<Exclude<BlockType, 'image'>, string> = {
  heading: 'text-[17px] font-semibold text-slate-900 border-b border-slate-200 pb-0.5',
  subheading: 'pl-3 text-[14px] font-semibold text-slate-700',
  body: 'text-[13px] text-slate-800',
  bullet: 'text-[13px] text-slate-800',
}

export interface NotesEditorProps {
  page: NotePage
  /** The block with the caret, so an image can show its resize handle. */
  focusedBlockId?: string | null
  /** Told which block has the caret, so the toolbar can act on it. */
  onFocusBlock: (blockId: string) => void
}

export default function NotesEditor({ page, focusedBlockId, onFocusBlock }: NotesEditorProps) {
  const setBlockText = useNotesStore((s) => s.setBlockText)
  const insertBlockAfter = useNotesStore((s) => s.insertBlockAfter)
  const removeBlock = useNotesStore((s) => s.removeBlock)

  /** Block to put the caret in after the next render, set when we create or delete one. */
  const focusNext = useRef<{ id: string; at: 'start' | 'end' } | null>(null)

  useLayoutEffect(() => {
    const target = focusNext.current
    if (!target) return
    focusNext.current = null

    const el = document.querySelector<HTMLElement>(`[data-block-id="${target.id}"]`)
    if (el) placeCaret(el, target.at)
  }, [page.blocks])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, block: NoteBlock, index: number) => {
      const el = event.currentTarget
      const text = el.textContent ?? ''
      const offset = caretOffset(el)
      event.stopPropagation()

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()

        // A section or subsection is a label for what follows, so the next line is body.
        const nextType: BlockType =
          block.type === 'heading' || block.type === 'subheading' ? 'body' : block.type === 'image' ? 'body' : block.type

        const before = text.slice(0, offset)
        const after = text.slice(offset)

        if (block.type !== 'image' && before !== text) setBlockText(page.kind, block.id, before)
        const newId = insertBlockAfter(page.kind, block.id, nextType, after)
        focusNext.current = { id: newId, at: 'start' }
        return
      }

      if (event.key === 'Backspace' && offset === 0 && (text === '' || block.type === 'image') && index > 0) {
        event.preventDefault()
        const previous = page.blocks[index - 1]
        removeBlock(page.kind, block.id)
        focusNext.current = { id: previous.id, at: 'end' }
      }
    },
    [insertBlockAfter, page.blocks, page.kind, removeBlock, setBlockText]
  )

  return (
    <div>
      {page.blocks.map((block, index) => (
        <Block
          key={block.id}
          block={block}
          kind={page.kind}
          focused={focusedBlockId === block.id}
          placeholder={index === 0 && block.type !== 'image' ? PLACEHOLDER[page.kind] : ''}
          onInput={(text) => setBlockText(page.kind, block.id, text)}
          onFocus={() => onFocusBlock(block.id)}
          onKeyDown={(event) => handleKeyDown(event, block, index)}
          onRemove={() => {
            if (index === 0 && page.blocks.length <= 1) return
            const previous = page.blocks[Math.max(0, index - 1)]
            removeBlock(page.kind, block.id)
            focusNext.current = { id: previous.id, at: 'end' }
          }}
        />
      ))}
    </div>
  )
}

interface BlockProps {
  block: NoteBlock
  kind: NotePage['kind']
  focused: boolean
  placeholder: string
  onInput: (text: string) => void
  onFocus: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
  onRemove: () => void
}

function Block({ block, kind, focused, placeholder, onInput, onFocus, onKeyDown, onRemove }: BlockProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el && el.textContent !== block.text) el.textContent = block.text
  }, [block.text])

  if (block.type === 'image') {
    return (
      <NotesImage
        block={block}
        kind={kind}
        focused={focused}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onRemove={onRemove}
        onCaption={onInput}
      />
    )
  }

  const isBullet = block.type === 'bullet'
  // An image block returned above, so what is left is always a text block and indexes
  // BLOCK_CLASS directly. Guarding for 'image' again here was unreachable.
  const textType = block.type

  return (
    <div
      className="flex"
      style={{ minHeight: block.type === 'heading' ? NOTE_LINE_HEIGHT + 8 : NOTE_LINE_HEIGHT }}
    >
      {isBullet && (
        <span
          aria-hidden
          className="shrink-0 select-none pr-2 text-slate-400"
          style={{ lineHeight: `${NOTE_LINE_HEIGHT}px` }}
        >
          •
        </span>
      )}
      <div
        ref={ref}
        data-block-id={block.id}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={block.type}
        spellCheck
        onInput={(e) => onInput(e.currentTarget.textContent ?? '')}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        data-placeholder={placeholder}
        className={[
          'flex-1 outline-none',
          'whitespace-pre-wrap break-words',
          BLOCK_CLASS[textType],
          'empty:before:pointer-events-none empty:before:text-slate-300 empty:before:content-[attr(data-placeholder)]',
        ].join(' ')}
        style={{ lineHeight: `${NOTE_LINE_HEIGHT}px` }}
      />
    </div>
  )
}

function caretOffset(el: HTMLElement): number {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return 0

  const range = selection.getRangeAt(0)
  const measured = range.cloneRange()
  measured.selectNodeContents(el)
  measured.setEnd(range.endContainer, range.endOffset)
  return measured.toString().length
}

export function focusBlockById(blockId: string, at: 'start' | 'end' = 'end'): void {
  const el = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`)
  if (el) placeCaret(el, at)
}

function placeCaret(el: HTMLElement, at: 'start' | 'end'): void {
  el.focus()

  const selection = window.getSelection()
  if (!selection) return

  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(at === 'start')
  selection.removeAllRanges()
  selection.addRange(range)
}
