'use client'

import { useMemo, useState } from 'react'
import { Check, NotebookPen, Plus, Trash2, X } from 'lucide-react'
import { countByKind, useNotesStore } from '@/store/notesStore'
import { useUiStore } from '@/store/uiStore'
import {
  BODY_PLACEHOLDER,
  KIND_LABEL,
  NFR_CATEGORIES,
  NFR_CATEGORY_LABEL,
  PROMPTS,
  TITLE_PLACEHOLDER,
  type NfrCategory,
  type RequirementItem,
  type RequirementKind,
} from '@/types/notes'

/**
 * Requirements for the diagram: what it must do, how well, and what was assumed.
 *
 * A checklist rather than a notepad. The point is to be asked the question you would have
 * skipped — so each tab leads with three prompts, and an item is a card with a tick you only
 * earn once the design actually addresses it.
 */

const TABS: RequirementKind[] = ['functional', 'nonFunctional', 'assumption']

const TAB_SHORT: Record<RequirementKind, string> = {
  functional: 'FR',
  nonFunctional: 'NFR',
  assumption: 'Given',
}

export default function RequirementsPanel() {
  const items = useNotesStore((s) => s.items)
  const add = useNotesStore((s) => s.add)
  const setNotesOpen = useUiStore((s) => s.setNotesOpen)

  const [tab, setTab] = useState<RequirementKind>('functional')

  const counts = useMemo(() => countByKind(items), [items])
  const visible = useMemo(() => items.filter((i) => i.kind === tab), [items, tab])
  const doneCount = visible.filter((i) => i.done).length

  return (
    <div className="flex h-full flex-col bg-white text-sm">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-600">
            <NotebookPen className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-900">Requirements</span>
        </div>
        <button
          type="button"
          onClick={() => setNotesOpen(false)}
          aria-label="Close requirements panel"
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div
        className="flex shrink-0 gap-0.5 border-b border-gray-100 bg-white px-2 py-2"
        role="tablist"
        aria-label="Requirement kind"
      >
        {TABS.map((kind) => {
          const active = tab === kind
          return (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(kind)}
              className={[
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors',
                active
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
              ].join(' ')}
            >
              <span>{TAB_SHORT[kind]}</span>
              {counts[kind] > 0 && (
                <span
                  className={[
                    'rounded px-1 text-[10px] font-medium',
                    active ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-600',
                  ].join(' ')}
                >
                  {counts[kind]}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Prompts. The reason this panel exists rather than a text file. */}
        <div className="border-b border-gray-100 bg-slate-50/70 px-4 py-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Think about
          </p>
          <ul className="space-y-1">
            {PROMPTS[tab].map((prompt) => (
              <li key={prompt} className="flex gap-1.5 text-[11px] leading-snug text-gray-500">
                <span className="text-gray-300">—</span>
                <span>{prompt}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 p-3">
          {visible.map((item) => (
            <RequirementCard key={item.id} item={item} />
          ))}

          {visible.length === 0 ? (
            <button
              type="button"
              onClick={() => add(tab)}
              className="flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center transition-colors hover:border-teal-400 hover:bg-teal-50/40"
            >
              <Plus className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-600">
                Add your first {KIND_LABEL[tab].toLowerCase()} requirement
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => add(tab)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:border-teal-300 hover:bg-teal-50/50 hover:text-teal-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add another
            </button>
          )}
        </div>
      </div>

      {/* Progress. Honest about what it counts: ticked, not verified. */}
      <div className="flex shrink-0 items-center gap-2 border-t border-gray-100 px-4 py-2 text-[10px] text-gray-400">
        <span>
          {visible.length === 0
            ? 'Nothing written yet'
            : `${doneCount} of ${visible.length} addressed`}
        </span>
        <span className="ml-auto">{items.length} total</span>
      </div>
    </div>
  )
}

function RequirementCard({ item }: { item: RequirementItem }) {
  const update = useNotesStore((s) => s.update)
  const remove = useNotesStore((s) => s.remove)
  const toggleDone = useNotesStore((s) => s.toggleDone)

  return (
    <div
      className={[
        'rounded-xl border p-2.5 transition-colors',
        item.done ? 'border-teal-200 bg-teal-50/40' : 'border-gray-200 bg-white',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => toggleDone(item.id)}
          aria-pressed={item.done}
          aria-label={item.done ? 'Mark as not addressed' : 'Mark as addressed'}
          className={[
            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
            item.done
              ? 'border-teal-600 bg-teal-600 text-white'
              : 'border-gray-300 bg-white hover:border-teal-400',
          ].join(' ')}
        >
          {item.done && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>

        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={item.title}
            onChange={(e) => update(item.id, { title: e.target.value })}
            placeholder={TITLE_PLACEHOLDER[item.kind]}
            aria-label="Requirement"
            className={[
              'w-full border-0 bg-transparent p-0 text-xs font-medium outline-none placeholder:text-gray-300',
              item.done ? 'text-gray-500 line-through' : 'text-gray-900',
            ].join(' ')}
          />

          {/* Only non-functional items have an axis to sit on. */}
          {item.kind === 'nonFunctional' && (
            <select
              value={item.category ?? 'other'}
              onChange={(e) => update(item.id, { category: e.target.value as NfrCategory })}
              aria-label="Category"
              className="mt-1.5 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-gray-600 outline-none focus:border-teal-400"
            >
              {NFR_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {NFR_CATEGORY_LABEL[category]}
                </option>
              ))}
            </select>
          )}

          <textarea
            value={item.body}
            onChange={(e) => update(item.id, { body: e.target.value })}
            placeholder={BODY_PLACEHOLDER[item.kind]}
            rows={2}
            aria-label="Detail"
            className="mt-1.5 w-full resize-y border-0 bg-transparent p-0 text-[11px] leading-relaxed text-gray-600 outline-none placeholder:text-gray-300"
          />
        </div>

        <button
          type="button"
          onClick={() => remove(item.id)}
          aria-label="Delete requirement"
          className="mt-0.5 shrink-0 rounded p-0.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
