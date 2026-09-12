'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { lldWorkspacePath, useDiagramRouteId } from '@/hooks/useDiagramRouteId'
import { Layers, PencilRuler, Search, X } from 'lucide-react'
import { LLD_DIAGRAM_SPECS } from '@/lib/lld/specs'
import { connectedComponents, suggestedDiagramTypes } from '@/lib/lld/seed'
import { useDiagramStore } from '@/store/diagramStore'
import { useLldStore } from '@/store/lldStore'
import { useUiStore } from '@/store/uiStore'
import type { ArchitectureNode } from '@/types/diagram'

/**
 * Gateway into the LLD module.
 *
 * Low-level design is inherently scoped to one component, so there is no single
 * "LLD canvas" to switch to. This picker turns the toolbar's LLD button into a
 * component chooser, and keeps an explicit escape hatch to the legacy freeform
 * board so anything already drawn there stays reachable.
 */
export default function LldComponentPicker({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const diagramRouteId = useDiagramRouteId()
  const nodes = useDiagramStore((s) => s.nodes)
  const edges = useDiagramStore((s) => s.edges)
  const switchBoard = useDiagramStore((s) => s.switchBoard)
  const setBoardMode = useUiStore((s) => s.setBoardMode)
  const workspaces = useLldStore((s) => s.workspaces)

  // Same function the workspace seeds from, so the preview cannot lie.
  const suggestedTypes = (node: ArchitectureNode): string[] =>
    suggestedDiagramTypes(node, connectedComponents(node, nodes, edges).length).map(
      (t) => LLD_DIAGRAM_SPECS[t].label
    )

  const components = useMemo(() => {
    const architecture = nodes.filter(
      (n): n is ArchitectureNode => n.type === 'architecture'
    )
    const q = query.trim().toLowerCase()
    if (!q) return architecture
    return architecture.filter((n) =>
      String(n.data.label ?? '')
        .toLowerCase()
        .includes(q)
    )
  }, [nodes, query])

  const open = (componentId: string) => {
    const path = lldWorkspacePath(diagramRouteId, componentId)
    if (!path) return
    router.push(path)
    onClose()
  }

  const openFreeformBoard = () => {
    // Both calls are required — board state and UI mode live in separate stores.
    switchBoard('lld')
    setBoardMode('lld')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/20 p-4 pt-[12vh]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Open low-level design"
        className="relative flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Layers className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-900">Open low-level design</h2>
            <p className="text-xs leading-snug text-slate-500">
              Pick the component you want to detail. Each one gets its own diagrams.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {nodes.some((n) => n.type === 'architecture') && (
          <div className="border-b border-slate-100 px-4 py-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                type="text"
                placeholder="Search components…"
                aria-label="Search components"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {components.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-600">
                {query ? `No component matches “${query}”` : 'No components on the HLD canvas yet'}
              </p>
              <p className="mx-auto mt-1 max-w-[280px] text-xs leading-relaxed text-slate-400">
                {query
                  ? 'Try a different name.'
                  : 'Drag a service, database or gateway onto the HLD canvas first, then come back to detail it.'}
              </p>
            </div>
          ) : (
            components.map((node) => {
              const workspace = workspaces[node.id]
              const label = String(node.data.label ?? 'Component')
              const suggestions = suggestedTypes(node)

              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => open(node.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {label}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {workspace
                        ? `${workspace.diagrams.length} diagram${workspace.diagrams.length === 1 ? '' : 's'} · ${workspace.diagrams
                            .map((d) => d.name)
                            .join(', ')}`
                        : suggestions.length > 0
                          ? `Will start with ${suggestions.join(' + ')}`
                          : 'Start from a blank class diagram'}
                    </span>
                  </span>

                  {workspace ? (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                      {workspace.diagrams.length}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      New
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50/60 px-2 py-2">
          <button
            type="button"
            onClick={openFreeformBoard}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white"
          >
            <PencilRuler className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="min-w-0">
              <span className="block text-xs font-medium text-slate-700">
                Freeform LLD board
              </span>
              <span className="block text-[11px] leading-snug text-slate-500">
                The older shared sketch board, not scoped to any component
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}


