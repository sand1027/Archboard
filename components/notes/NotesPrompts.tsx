'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { focusBlockById } from './NotesEditor'
import { useNotesStore } from '@/store/notesStore'
import type { NotePage, NotePrompt } from '@/types/notes'

/**
 * The prompts for a page: what to think about, and a way to start.
 *
 * These used to be a frozen catalog in code, which meant FR / NFR / Given / Trade-offs could
 * not be rewritten. They now live on the page — same store as the paper — so each diagram can
 * keep the questions that actually apply to it.
 *
 * Expanded shows the full list for editing. Collapsed shows labels only, so the strip gets out
 * of the way once you are writing. Picking + still writes the question onto the page as a
 * subheading with an empty line under it.
 */
export interface NotesPromptsProps {
  page: NotePage
}

export default function NotesPrompts({ page }: NotesPromptsProps) {
  const setBlockText = useNotesStore((s) => s.setBlockText)
  const setBlockType = useNotesStore((s) => s.setBlockType)
  const insertBlockAfter = useNotesStore((s) => s.insertBlockAfter)
  const addPrompt = useNotesStore((s) => s.addPrompt)
  const updatePrompt = useNotesStore((s) => s.updatePrompt)
  const removePrompt = useNotesStore((s) => s.removePrompt)

  const written = page.blocks.some((b) => b.text.trim() !== '')
  const [override, setOverride] = useState<boolean | null>(null)
  const prompts = page.prompts ?? []

  /*
   * Open is derived from whether the page has anything on it, until the user says otherwise —
   * except an empty question list stays open so "Add question" is still on screen.
   *
   * Derived rather than stored-and-synced: an effect that folded the strip when text appeared
   * would be state chasing state, and it would also undo a deliberate expand the moment the next
   * character was typed. Null means "no opinion, follow the page"; a click takes over from there.
   * Remounted per page by the caller's key, so the opinion does not follow you to another tab.
   */
  const open = override ?? (prompts.length === 0 || !written)

  /** Write a question onto the page and put the caret on the line below it. */
  const use = (prompt: NotePrompt) => {
    const question = prompt.question.trim() || prompt.label.trim()
    if (!question) return

    const last = page.blocks.at(-1)
    if (!last) return

    let anchorId: string
    // Reuse a trailing empty block rather than leaving a gap above the question.
    if (last.text.trim() === '') {
      setBlockType(page.kind, last.id, 'subheading')
      setBlockText(page.kind, last.id, question)
      anchorId = last.id
    } else {
      anchorId = insertBlockAfter(page.kind, last.id, 'subheading', question)
    }

    const answerId = insertBlockAfter(page.kind, anchorId, 'body', '')
    // After the render that adds it, or there is no node to focus yet.
    requestAnimationFrame(() => focusBlockById(answerId, 'end'))
  }

  const add = () => {
    const id = addPrompt(page.kind)
    setOverride(true)
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLInputElement>(`[data-prompt-label="${id}"]`)
      el?.focus()
    })
  }

  return (
    <div className="border-b border-slate-200/80 bg-slate-50/70">
      <button
        type="button"
        onClick={() => setOverride(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-1 px-3 py-1.5 text-left transition-colors hover:bg-slate-100/70"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
        )}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Think about
        </span>
        {!open && (
          <span className="ml-1 truncate text-[10px] text-slate-400">
            {prompts.map((p) => p.label || p.question).filter(Boolean).join(' · ') || 'Add questions'}
          </span>
        )}
      </button>

      {open && (
        <div className="px-3 pb-2">
          {prompts.length === 0 ? (
            <p className="mb-1.5 text-[11px] text-slate-400">No questions on this page yet.</p>
          ) : (
            <ul className="space-y-1">
              {prompts.map((prompt) => (
                <li key={prompt.id} className="flex items-start gap-1">
                  <button
                    type="button"
                    onClick={() => use(prompt)}
                    title="Add this question to the page"
                    className="mt-1 shrink-0 rounded p-0.5 text-slate-300 transition-colors hover:bg-white hover:text-teal-600"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <input
                      data-prompt-label={prompt.id}
                      value={prompt.label}
                      onChange={(e) => updatePrompt(page.kind, prompt.id, { label: e.target.value })}
                      placeholder="Label"
                      aria-label="Prompt label"
                      className="w-full bg-transparent text-[11px] font-medium text-slate-700 outline-none placeholder:text-slate-300"
                    />
                    <textarea
                      value={prompt.question}
                      onChange={(e) =>
                        updatePrompt(page.kind, prompt.id, { question: e.target.value })
                      }
                      placeholder="What should you think about?"
                      aria-label="Prompt question"
                      rows={2}
                      className="w-full resize-none bg-transparent text-[11px] leading-snug text-slate-500 outline-none placeholder:text-slate-300"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removePrompt(page.kind, prompt.id)}
                    title="Remove this question"
                    aria-label="Remove this question"
                    className="mt-1 shrink-0 rounded p-0.5 text-slate-300 transition-colors hover:bg-white hover:text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={add}
            className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 bg-white py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800"
          >
            <Plus className="h-3 w-3" />
            Add question
          </button>
        </div>
      )}
    </div>
  )
}
