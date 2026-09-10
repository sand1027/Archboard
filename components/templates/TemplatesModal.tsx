'use client'

import { useCallback, useMemo } from 'react'
import { X, ArrowRight } from 'lucide-react'
import { useUiStore } from '@/store/uiStore'
import { useDiagramStore } from '@/store/diagramStore'
import { useHistoryStore } from '@/store/historyStore'
import { getTemplatesByMode, type Template } from '@/data/templates'

export default function TemplatesModal() {
  const { templateModalOpen, setTemplateModalOpen, boardMode } = useUiStore()
  const { loadDiagram, nodes, edges } = useDiagramStore()
  const { pushSnapshot } = useHistoryStore()

  const visible = useMemo(() => getTemplatesByMode(boardMode), [boardMode])

  const handleLoadTemplate = useCallback(
    (template: Template) => {
      pushSnapshot({ nodes, edges })
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      loadDiagram({
        id,
        name: template.diagram.name,
        nodes: template.diagram.nodes as any,
        edges: template.diagram.edges as any,
        viewport: template.diagram.viewport,
      })
      setTemplateModalOpen(false)
    },
    [loadDiagram, pushSnapshot, nodes, edges, setTemplateModalOpen]
  )

  if (!templateModalOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => setTemplateModalOpen(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-[640px] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {boardMode === 'lld' ? 'LLD Templates' : 'Architecture Templates'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {boardMode === 'lld'
                ? 'Flowchart, class, sequence, and ER starters'
                : 'Start from a pre-built architecture'}
            </p>
          </div>
          <button onClick={() => setTemplateModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            {visible.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={() => handleLoadTemplate(template)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TemplateCard({ template, onSelect }: { template: Template; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="group text-left rounded-xl border border-gray-200 hover:border-blue-400
        hover:shadow-md transition-all duration-150 overflow-hidden bg-white"
    >
      <div className="px-5 py-6 bg-gray-50 group-hover:bg-blue-50 transition-colors">
        <p className="font-mono text-xs text-gray-500 leading-relaxed whitespace-pre-line">
          {template.preview}
        </p>
      </div>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">{template.name}</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{template.description}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 shrink-0 mt-0.5 transition-colors" />
        </div>
      </div>
    </button>
  )
}
