'use client'

import { useCallback, useMemo } from 'react'
import { X, ArrowRight } from 'lucide-react'
import { useUiStore } from '@/store/uiStore'
import { useDiagramStore } from '@/store/diagramStore'
import { useLldStore } from '@/store/lldStore'
import { useHistoryStore } from '@/store/historyStore'
import { getTemplatesByMode, type Template } from '@/data/templates'
import { buildLldTemplate, lldTemplates, type LldTemplate } from '@/data/templates/lld'
import { generateId } from '@/lib/canvas/ids'
import { STANDALONE_LLD_SCOPE } from '@/types/lld'

export default function TemplatesModal() {
  const { templateModalOpen, setTemplateModalOpen } = useUiStore()
  const { loadDiagram, nodes, edges } = useDiagramStore()
  const { pushSnapshot } = useHistoryStore()
  const ensureWorkspace = useLldStore((s) => s.ensureWorkspace)
  const loadLldTemplate = useLldStore((s) => s.loadTemplate)

  /*
   * Which board is up decides which starters make sense.
   *
   * Read from diagramStore rather than uiStore.boardMode, because diagramStore.activeBoard is
   * what actually swaps the canvas — the two could disagree, and then the modal would offer
   * starters for a board that is not on screen.
   */
  const activeBoard = useDiagramStore((s) => s.activeBoard)
  const isLld = activeBoard === 'lld'

  const visibleHld = useMemo(() => (isLld ? [] : getTemplatesByMode('hld')), [isLld])

  const handleLoadHld = useCallback(
    (template: Template) => {
      pushSnapshot({ nodes, edges })
      loadDiagram({
        id: generateId(),
        name: template.diagram.name,
        nodes: template.diagram.nodes,
        edges: template.diagram.edges,
        viewport: template.diagram.viewport,
      })
      setTemplateModalOpen(false)
    },
    [loadDiagram, pushSnapshot, nodes, edges, setTemplateModalOpen]
  )

  /**
   * LLD starters go to lldStore, which is what the LLD canvas renders.
   *
   * They used to go through `loadDiagram` like the HLD ones, so they landed in diagramStore's
   * never-rendered `lld` board slot: the modal closed, the workspace title changed to the
   * template name, and the canvas stayed empty.
   */
  const handleLoadLld = useCallback(
    (template: LldTemplate) => {
      // The standalone board's workspace is created on first visit, so a template loaded
      // before the user has opened any diagram type has somewhere to go.
      ensureWorkspace({ scopeId: STANDALONE_LLD_SCOPE, diagramId: 'local', title: template.name })
      loadLldTemplate(
        STANDALONE_LLD_SCOPE,
        template.type,
        template.name,
        buildLldTemplate(template)
      )
      setTemplateModalOpen(false)
    },
    [ensureWorkspace, loadLldTemplate, setTemplateModalOpen]
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
              {isLld ? 'LLD Templates' : 'Architecture Templates'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isLld
                ? 'Class, ER, sequence and state starters'
                : 'Start from a pre-built architecture'}
            </p>
          </div>
          <button onClick={() => setTemplateModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            {isLld
              ? lldTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    name={template.name}
                    description={template.description}
                    preview={template.preview}
                    onSelect={() => handleLoadLld(template)}
                  />
                ))
              : visibleHld.map((template) => (
                  <TemplateCard
                    key={template.id}
                    name={template.name}
                    description={template.description}
                    preview={template.preview}
                    onSelect={() => handleLoadHld(template)}
                  />
                ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Takes the fields it renders rather than a Template, since HLD and LLD starters differ. */
function TemplateCard({
  name,
  description,
  preview,
  onSelect,
}: {
  name: string
  description: string
  preview: string
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className="group text-left rounded-xl border border-gray-200 hover:border-blue-400
        hover:shadow-md transition-all duration-150 overflow-hidden bg-white"
    >
      <div className="px-5 py-6 bg-gray-50 group-hover:bg-blue-50 transition-colors">
        <p className="font-mono text-xs text-gray-500 leading-relaxed whitespace-pre-line">
          {preview}
        </p>
      </div>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">{name}</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 shrink-0 mt-0.5 transition-colors" />
        </div>
      </div>
    </button>
  )
}
