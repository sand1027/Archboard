'use client'

import { useUiStore } from '@/store/uiStore'
import { X } from 'lucide-react'

const SHORTCUTS = [
  { category: 'Mode' },
  { keys: ['HLD', '/', 'LLD'], desc: 'Toggle in top toolbar' },
  { category: 'Selection' },
  { keys: ['⌘', 'A'], desc: 'Select all' },
  { keys: ['Esc'], desc: 'Deselect' },
  { keys: ['Shift', 'Click'], desc: 'Multi-select' },
  { category: 'Edit' },
  { keys: ['⌘', 'Z'], desc: 'Undo' },
  { keys: ['⌘', '⇧', 'Z'], desc: 'Redo' },
  { keys: ['⌘', 'C'], desc: 'Copy' },
  { keys: ['⌘', 'V'], desc: 'Paste' },
  { keys: ['⌘', 'D'], desc: 'Duplicate' },
  { keys: ['Del', '/','⌫'], desc: 'Delete selected' },
  { category: 'Navigation' },
  { keys: ['Space'], desc: 'Pan canvas' },
  { keys: ['⌘', '+'], desc: 'Zoom in' },
  { keys: ['⌘', '-'], desc: 'Zoom out' },
  { keys: ['⌘', '⇧', 'F'], desc: 'Fit view' },
  { category: 'Canvas' },
  { keys: ['⌘', 'G'], desc: 'Toggle grid' },
  { keys: ['⌘', '\\'], desc: 'Toggle snap to grid' },
  { category: 'Drawing' },
  { keys: ['V'], desc: 'Select tool' },
  { keys: ['H'], desc: 'Hand tool' },
  { keys: ['R'], desc: 'Rectangle / Process' },
  { keys: ['D'], desc: 'Diamond / Decision' },
  { keys: ['Double-click'], desc: 'Empty canvas → text; shape → label; arrow → mid label' },
]

export default function KeyboardShortcutsModal() {
  const { shortcutsModalOpen, setShortcutsModalOpen } = useUiStore()
  if (!shortcutsModalOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => setShortcutsModalOpen(false)}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-[400px] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Keyboard Shortcuts</h2>
          <button onClick={() => setShortcutsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-1">
          {SHORTCUTS.map((item, i) =>
            'category' in item ? (
              <p key={i} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pt-3 pb-1 first:pt-0">
                {item.category}
              </p>
            ) : (
              <div key={i} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-600">{item.desc}</span>
                <div className="flex items-center gap-1">
                  {item.keys?.map((k, ki) => (
                    <kbd
                      key={ki}
                      className="px-1.5 py-0.5 text-[11px] font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded shadow-sm"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
