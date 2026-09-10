'use client'

import { useCallback } from 'react'
import type { LldCatalogItem } from '@/types/lld'

const TAB_GLYPH: Record<string, string> = {
  flowchart: '◇',
  uml: '▣',
  er: '▤',
  sequence: '⇅',
  icons: '✦',
}

interface LldItemProps {
  item: LldCatalogItem
  onAdd: (item: LldCatalogItem) => void
}

export default function LldItem({ item, onAdd }: LldItemProps) {
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'copy'
      e.dataTransfer.setData('application/archboard-lld', item.id)
    },
    [item.id]
  )

  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      onClick={() => onAdd(item)}
      title={`${item.name} — ${item.description}`}
      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl cursor-grab active:cursor-grabbing
        bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-sm hover:shadow-slate-200/60
        transition-all duration-150 select-none text-left w-full"
    >
      <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 text-sm font-semibold">
        {TAB_GLYPH[item.tab] ?? '•'}
      </div>
      <span className="text-[10px] text-slate-700 text-center font-medium leading-tight line-clamp-2 w-full">
        {item.name}
      </span>
    </button>
  )
}
