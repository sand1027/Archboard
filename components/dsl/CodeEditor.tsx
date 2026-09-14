'use client'

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Diagnostic } from '@/types/dsl'
import { decorate, diagnosticsByLine, type SegmentKind } from '@/lib/dsl/highlight'

/**
 * A syntax-highlighted editor for the DSL.
 *
 * A transparent textarea over a styled `<pre>` rather than an editor library. That keeps
 * native editing behaviour — caret, selection, IME, undo, spellcheck-off, accessibility —
 * for free, and it means the colours come from the same `tokenize` the parser uses. A
 * library would need its own grammar, and a second definition of the language is a second
 * definition free to disagree with the first.
 *
 * The one rule that matters: the overlay and the textarea must lay text out identically, so
 * both use the same font, size, line height and padding, and the highlighter emits a
 * segment for every character including whitespace.
 */

/** Shared by the textarea and the overlay. Any divergence shows up as drifting colour. */
const TEXT_STYLE = 'font-mono text-[12.5px] leading-[1.6] tracking-normal'
const PADDING = 'px-3 py-2.5'

const KIND_CLASS: Record<SegmentKind, string> = {
  comment: 'text-slate-400 italic',
  keyword: 'text-purple-600 font-semibold',
  component: 'text-sky-700 font-medium',
  name: 'text-slate-900',
  string: 'text-emerald-700',
  number: 'text-amber-700',
  unit: 'text-amber-600/70',
  arrow: 'text-rose-500 font-semibold',
  punctuation: 'text-slate-400',
  property: 'text-indigo-600',
  value: 'text-teal-700',
  plain: 'text-slate-700',
}

/** Wavy underline, the one convention everyone already reads as "there is a problem here". */
const SEVERITY_CLASS = {
  error: 'underline decoration-wavy decoration-red-500 underline-offset-[3px]',
  warning: 'underline decoration-wavy decoration-amber-500 underline-offset-[3px]',
} as const

export interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  diagnostics: Diagnostic[]
  placeholder?: string
  /** Put the caret in the editor so paste works immediately on an empty pane. */
  autoFocus?: boolean
}

export default function CodeEditor({
  value,
  onChange,
  diagnostics,
  placeholder,
  autoFocus = false,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const [caretLine, setCaretLine] = useState(1)

  const segments = useMemo(() => decorate(value, diagnostics), [value, diagnostics])
  const byLine = useMemo(() => diagnosticsByLine(diagnostics), [diagnostics])
  const lineCount = useMemo(() => value.split('\n').length, [value])

  /**
   * Keep the overlay and gutter aligned with the textarea's scroll.
   *
   * Layout effect rather than a plain one: doing it after paint lets the overlay render at
   * the old offset for a frame, which reads as the colours tearing away from the text.
   */
  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    if (overlayRef.current) {
      overlayRef.current.scrollTop = textarea.scrollTop
      overlayRef.current.scrollLeft = textarea.scrollLeft
    }
    if (gutterRef.current) gutterRef.current.scrollTop = textarea.scrollTop
  }, [])

  useLayoutEffect(syncScroll, [value, syncScroll])

  useLayoutEffect(() => {
    if (autoFocus) textareaRef.current?.focus()
  }, [autoFocus])

  const updateCaretLine = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const upto = textarea.value.slice(0, textarea.selectionStart)
    setCaretLine(upto.split('\n').length)
  }, [])

  /**
   * Tab indents instead of leaving the editor, and Enter carries the current indent.
   *
   * Without these two, writing a nested block means retyping the leading spaces on every
   * line, which is enough friction to make the text form feel worse than dragging.
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = event.currentTarget
      const { selectionStart, selectionEnd } = textarea

      if (event.key === 'Tab') {
        event.preventDefault()
        insert(textarea, '  ', onChange)
        return
      }

      if (event.key === 'Enter') {
        const lineStart = textarea.value.lastIndexOf('\n', selectionStart - 1) + 1
        const line = textarea.value.slice(lineStart, selectionStart)
        const indent = /^[ \t]*/.exec(line)?.[0] ?? ''
        // An open brace means the next line belongs inside it.
        const deeper = /\{\s*$/.test(line) ? '  ' : ''
        if (!indent && !deeper) return

        event.preventDefault()
        insert(textarea, `\n${indent}${deeper}`, onChange)
        return
      }

      // Closing a brace on its own line should sit one level out.
      if (event.key === '}' && selectionStart === selectionEnd) {
        const lineStart = textarea.value.lastIndexOf('\n', selectionStart - 1) + 1
        const line = textarea.value.slice(lineStart, selectionStart)
        if (/^[ \t]+$/.test(line) && line.length >= 2) {
          event.preventDefault()
          const next =
            textarea.value.slice(0, selectionStart - 2) + '}' + textarea.value.slice(selectionEnd)
          onChange(next)
          queueCaret(textarea, selectionStart - 1)
        }
      }
    },
    [onChange]
  )

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-white">
      {/* Gutter: line numbers plus a marker where something is wrong */}
      <div
        ref={gutterRef}
        aria-hidden
        className={`${TEXT_STYLE} w-11 flex-shrink-0 overflow-hidden border-r border-slate-200/70 bg-slate-50/60 py-2.5 text-right select-none`}
      >
        {Array.from({ length: lineCount }, (_, index) => {
          const line = index + 1
          const issues = byLine.get(line)
          const worst = issues?.some((d) => d.severity === 'error')
            ? 'text-red-500'
            : issues
              ? 'text-amber-500'
              : line === caretLine
                ? 'text-slate-600'
                : 'text-slate-300'

          return (
            <div key={line} className={`pr-2 ${worst}`}>
              {issues ? '●' : line}
            </div>
          )
        })}
      </div>

      <div className="relative min-w-0 flex-1">
        {/* Colours. Behind the textarea, never interactive. */}
        <pre
          ref={overlayRef}
          aria-hidden
          className={`${TEXT_STYLE} ${PADDING} pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre-wrap break-words`}
        >
          {segments.map((segment) => (
            <span
              key={`${segment.start}-${segment.end}-${segment.kind}`}
              className={[
                KIND_CLASS[segment.kind],
                segment.severity ? SEVERITY_CLASS[segment.severity] : '',
              ].join(' ')}
            >
              {value.slice(segment.start, segment.end)}
            </span>
          ))}
          {/* A trailing newline has no glyph, so the last line would have no height. */}
          {value.endsWith('\n') ? '\n' : ''}
        </pre>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
          onKeyUp={updateCaretLine}
          onClick={updateCaretLine}
          onSelect={updateCaretLine}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Diagram source code"
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`${TEXT_STYLE} ${PADDING} absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre-wrap break-words border-0 bg-transparent text-transparent caret-slate-900 outline-none placeholder:text-slate-300`}
        />
      </div>
    </div>
  )
}

// ─── editing helpers ──────────────────────────────────────────────────────────

/** Replace the selection with `text` and put the caret after it. */
function insert(
  textarea: HTMLTextAreaElement,
  text: string,
  onChange: (value: string) => void
): void {
  const { selectionStart, selectionEnd, value } = textarea
  onChange(value.slice(0, selectionStart) + text + value.slice(selectionEnd))
  queueCaret(textarea, selectionStart + text.length)
}

/**
 * Move the caret after React has re-rendered the value.
 *
 * Setting it synchronously does nothing: the textarea is controlled, so React writes the new
 * value afterwards and resets the selection to the end.
 */
function queueCaret(textarea: HTMLTextAreaElement, position: number): void {
  requestAnimationFrame(() => {
    textarea.selectionStart = position
    textarea.selectionEnd = position
  })
}
