'use client'

import { useEffect } from 'react'
import { useLldStore, useLldWorkspaceFor } from '@/store/lldStore'
import LldCanvas from './LldCanvas'
import LldDiagramTabs from './LldDiagramTabs'
import LldInspector from './LldInspector'
import LldPalette from './LldPalette'
import type { ArchitectureEdge, ArchitectureNode } from '@/types/diagram'
import type { LldDiagramType } from '@/types/lld'

export interface LldWorkspaceProps {
  /** STANDALONE_LLD_SCOPE for the navbar board, or an HLD node id. */
  scopeId: string
  /** Parent diagram row id. */
  diagramId: string
  title: string
  /** Set only when attached to an HLD component; drives auto-suggest seeding. */
  component?: ArchitectureNode
  hldNodes?: ArchitectureNode[]
  hldEdges?: ArchitectureEdge[]
  defaultType?: LldDiagramType
  paletteOpen?: boolean
  inspectorOpen?: boolean
}

/**
 * The LLD editor body: diagram tabs, palette, canvas, inspector.
 *
 * Deliberately chrome-free so the same component serves both the in-page LLD
 * mode (which already has the app navbar) and the component-scoped route (which
 * adds a breadcrumb above it).
 */
export default function LldWorkspace({
  scopeId,
  diagramId,
  title,
  component,
  hldNodes,
  hldEdges,
  defaultType,
  paletteOpen = true,
  inspectorOpen = true,
}: LldWorkspaceProps) {
  const ensureWorkspace = useLldStore((s) => s.ensureWorkspace)
  const workspace = useLldWorkspaceFor(scopeId)

  // Seeds only on first open; reopening never duplicates or resets.
  useEffect(() => {
    ensureWorkspace({ scopeId, diagramId, title, component, hldNodes, hldEdges, defaultType })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId, diagramId, title])

  const activeDiagram =
    workspace?.diagrams.find((d) => d.id === workspace.activeDiagramId) ?? workspace?.diagrams[0]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {workspace && <LldDiagramTabs workspace={workspace} />}

      <div className="flex min-h-0 flex-1">
        <aside
          className="shrink-0 overflow-hidden border-r border-slate-200/80 transition-[width] duration-200"
          style={{ width: paletteOpen ? 240 : 0 }}
        >
          {paletteOpen && activeDiagram && (
            <div className="h-full w-[240px]">
              <LldPalette scopeId={scopeId} diagram={activeDiagram} />
            </div>
          )}
        </aside>

        <main className="min-w-0 flex-1 bg-white">
          {activeDiagram ? (
            <LldCanvas key={activeDiagram.id} scopeId={scopeId} diagram={activeDiagram} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-400">Preparing workspace…</p>
            </div>
          )}
        </main>

        <aside
          className="shrink-0 overflow-hidden border-l border-slate-200/80 transition-[width] duration-200"
          style={{ width: inspectorOpen ? 280 : 0 }}
        >
          {inspectorOpen && activeDiagram && (
            <div className="h-full w-[280px]">
              <LldInspector scopeId={scopeId} diagram={activeDiagram} />
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
