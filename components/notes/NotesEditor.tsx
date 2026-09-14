'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import NotesImage, { imageWidthPct } from './NotesImage'
import { wrapRangeAfterImage } from '@/lib/notes/imageLayout'
import { useNotesStore } from '@/store/notesStore'
import {
  NOTE_LINE_HEIGHT,
  PLACEHOLDER,
  snapToNoteLine,
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
  heading: 'text-[17px] font-semibold text-slate-900 shadow-[inset_0_-1px_0_0_#e2e8f0]',
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
        if (!previous) return
        removeBlock(page.kind, block.id)
        focusNext.current = { id: previous.id, at: 'end' }
      }
    },
    [insertBlockAfter, page.blocks, page.kind, removeBlock, setBlockText]
  )

  const ruled = page.paper === 'ruled'
  const rows: ReactNode[] = []
  let index = 0
  while (index < page.blocks.length) {
    const block = page.blocks[index]

    if (block.type === 'image') {
      const imageIndex = index
      const { wrap, nextIndex } = wrapRangeAfterImage(page.blocks, imageIndex)

      const figure = (
        <div
          data-image-row
          className="flow-root min-w-0 w-full"
        >
          <div
            className={['relative float-left mr-3', ruled ? 'mb-0' : 'mb-2'].join(' ')}
            style={{ width: `${imageWidthPct(block)}%` }}
          >
            <NotesImage
              block={block}
              kind={page.kind}
              focused={focusedBlockId === block.id}
              ruled={ruled}
              onFocus={() => onFocusBlock(block.id)}
              onKeyDown={(event) => handleKeyDown(event, block, imageIndex)}
              onRemove={() => {
                if (imageIndex === 0 && page.blocks.length <= 1) return
                const previous = page.blocks[Math.max(0, imageIndex - 1)]
                if (!previous || previous.id === block.id) {
                  removeBlock(page.kind, block.id)
                  return
                }
                removeBlock(page.kind, block.id)
                focusNext.current = { id: previous.id, at: 'end' }
              }}
              onCaption={(text) => setBlockText(page.kind, block.id, text)}
            />
          </div>
          {wrap.map((line, offset) => {
            const lineIndex = imageIndex + 1 + offset
            return (
              <TextBlock
                key={line.id}
                block={line}
                focused={focusedBlockId === line.id}
                placeholder=""
                onInput={(text) => setBlockText(page.kind, line.id, text)}
                onFocus={() => onFocusBlock(line.id)}
                onKeyDown={(event) => handleKeyDown(event, line, lineIndex)}
              />
            )
          })}
        </div>
      )

      rows.push(
        ruled ? (
          <LineSnap key={block.id}>{figure}</LineSnap>
        ) : (
          <div key={block.id} className="py-2">
            {figure}
          </div>
        )
      )

      index = nextIndex
      continue
    }

    const blockIndex = index
    rows.push(
      <TextBlock
        key={block.id}
        block={block}
        focused={focusedBlockId === block.id}
        placeholder={index === 0 ? PLACEHOLDER[page.kind] : ''}
        onInput={(text) => setBlockText(page.kind, block.id, text)}
        onFocus={() => onFocusBlock(block.id)}
        onKeyDown={(event) => handleKeyDown(event, block, blockIndex)}
      />
    )
    index += 1
  }

  return <div>{rows}</div>
}

interface TextBlockProps {
  block: NoteBlock
  focused: boolean
  placeholder: string
  onInput: (text: string) => void
  onFocus: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
}

function TextBlock({ block, placeholder, onInput, onFocus, onKeyDown }: TextBlockProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isBullet = block.type === 'bullet'
  const textType = block.type === 'image' ? 'body' : block.type
  const heading = block.type === 'heading' || block.type === 'subheading'

  useEffect(() => {
    const el = ref.current
    if (el && el.textContent !== block.text) el.textContent = block.text
  }, [block.text])

  return (
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
        // Not a flex/BFC box: line boxes must shorten around a floated image, then
        // run the full width of the page once they pass its bottom.
        heading ? 'clear-both' : '',
        isBullet ? "relative pl-4 before:absolute before:left-0 before:content-['•'] before:text-slate-400" : '',
        'min-w-0 outline-none',
        'whitespace-pre-wrap break-all [overflow-wrap:anywhere]',
        BLOCK_CLASS[textType],
        'empty:before:pointer-events-none empty:before:text-slate-300 empty:before:content-[attr(data-placeholder)]',
      ].join(' ')}
      style={{ lineHeight: `${NOTE_LINE_HEIGHT}px`, minHeight: NOTE_LINE_HEIGHT }}
    />
  )
}

function LineSnap({ children }: { children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [minHeight, setMinHeight] = useState<number>()

  useLayoutEffect(() => {
    const inner = innerRef.current
    if (!inner) return

    const apply = () => setMinHeight(snapToNoteLine(inner.getBoundingClientRect().height))
    apply()

    const observer = new ResizeObserver(apply)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-w-0 w-full" style={{ minHeight }}>
      <div ref={innerRef} className="min-w-0 w-full">{children}</div>
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
  if (!el.isContentEditable && el.getAttribute('contenteditable') !== 'true') {
    const editable = el.querySelector<HTMLElement>('[contenteditable="true"]') ?? el
    focusNode(editable, at)
    return
  }
  focusNode(el, at)
}

function focusNode(el: HTMLElement, at: 'start' | 'end'): void {
  el.focus()

  const selection = window.getSelection()
  if (!selection) return

  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(at === 'start')
  selection.removeAllRanges()
  selection.addRange(range)
}
