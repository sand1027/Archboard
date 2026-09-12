'use client'

import { useState } from 'react'
import {
  ArrowLeftRight,
  Box,
  Boxes,
  CircleUser,
  Network,
  Package,
  Puzzle,
  Server,
  GitBranch,
  Layers,
  Plus,
  Table,
  Webhook,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react'
import { LLD_DIAGRAM_SPECS } from '@/lib/lld/specs'
import { useLldStore } from '@/store/lldStore'
import type { LldDiagramType, LldWorkspace } from '@/types/lld'

/**
 * Category order. Flow / UML / ER / Seq lead because they are the diagram types
 * people reach for first; the rest follow.
 */
const TYPE_ORDER: readonly LldDiagramType[] = [
  // Behaviour first — it is what people reach for most.
  'usecase',
  'activity',
  'sequence',
  'state',
  'communication',
  // Then structure.
  'class',
  'object',
  'er',
  'component',
  'package',
  'deployment',
  'internal',
  'api',
]

const TYPE_ICON: Record<LldDiagramType, LucideIcon> = {
  usecase: CircleUser,
  object: Boxes,
  package: Package,
  component: Puzzle,
  deployment: Server,
  communication: Network,
  activity: GitBranch,
  class: Box,
  er: Table,
  sequence: ArrowLeftRight,
  api: Webhook,
  state: Workflow,
  internal: Layers,
}

/**
 * Two rows:
 *
 *  1. Category tabs — every diagram type, always present, so the whole LLD
 *     vocabulary is visible rather than only the diagrams that happen to exist.
 *     A type with no diagram yet is created when you click it.
 *  2. Instance tabs — only when a category holds more than one diagram, so a
 *     component can keep e.g. two sequence diagrams without cluttering the
 *     common case.
 */
export default function LldDiagramTabs({ workspace }: { workspace: LldWorkspace }) {
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const selectDiagramType = useLldStore((s) => s.selectDiagramType)
  const setActiveDiagram = useLldStore((s) => s.setActiveDiagram)
  const addDiagram = useLldStore((s) => s.addDiagram)
  const renameDiagram = useLldStore((s) => s.renameDiagram)
  const removeDiagram = useLldStore((s) => s.removeDiagram)

  const active = workspace.diagrams.find((d) => d.id === workspace.activeDiagramId)
  const activeType = active?.type ?? null
  const siblings = activeType ? workspace.diagrams.filter((d) => d.type === activeType) : []

  return (
    <div className="shrink-0 border-b border-slate-200/80 bg-white">
      <div className="flex items-center gap-1 overflow-x-auto px-3 py-1.5">
        {TYPE_ORDER.map((type) => {
          const spec = LLD_DIAGRAM_SPECS[type]
          const count = workspace.diagrams.filter((d) => d.type === type).length
          const isActive = activeType === type
          const Icon = TYPE_ICON[type]

          return (
            <button
              key={type}
              type="button"
              onClick={() => selectDiagramType(workspace.scopeId, type)}
              aria-current={isActive ? 'page' : undefined}
              title={spec.description}
              className={[
                'flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all',
                isActive
                  ? 'border-transparent bg-slate-900 text-white'
                  : count > 0
                    ? 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                    : 'border-slate-200/70 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600',
              ].join(' ')}
            >
              <Icon className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
              {spec.label}
              {count > 1 && (
                <span
                  className={[
                    'rounded px-1 text-[9px] font-semibold tabular-nums',
                    isActive ? 'bg-white/20' : 'bg-slate-200 text-slate-600',
                  ].join(' ')}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}

        {activeType && (
          <button
            type="button"
            onClick={() => addDiagram(workspace.scopeId, activeType)}
            aria-label={`Add another ${LLD_DIAGRAM_SPECS[activeType].label} diagram`}
            title={`Add another ${LLD_DIAGRAM_SPECS[activeType].label} diagram`}
            className="ml-auto flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {siblings.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 bg-slate-50/60 px-3 py-1.5">
          {siblings.map((diagram) => {
            const isActive = diagram.id === workspace.activeDiagramId
            return (
              <div
                key={diagram.id}
                className={[
                  'group flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-all',
                  isActive
                    ? 'border-slate-300 bg-white font-medium text-slate-900'
                    : 'border-transparent text-slate-500 hover:bg-white',
                ].join(' ')}
              >
                <button
                  type="button"
                  onClick={() => setActiveDiagram(workspace.scopeId, diagram.id)}
                  onDoubleClick={() => setRenamingId(diagram.id)}
                >
                  {renamingId === diagram.id ? (
                    <input
                      autoFocus
                      className="w-28 bg-transparent outline-none"
                      value={diagram.name}
                      aria-label="Diagram name"
                      onChange={(e) =>
                        renameDiagram(workspace.scopeId, diagram.id, e.target.value)
                      }
                      onBlur={() => setRenamingId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') setRenamingId(null)
                      }}
                    />
                  ) : (
                    <span className="max-w-[160px] truncate">{diagram.name}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => removeDiagram(workspace.scopeId, diagram.id)}
                  aria-label={`Delete ${diagram.name}`}
                  className="rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-200 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
