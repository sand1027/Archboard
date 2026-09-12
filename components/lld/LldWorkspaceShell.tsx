'use client'

import { useState } from 'react'
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { ReactFlowProvider } from '@xyflow/react'
import { useLldWorkspaceFor } from '@/store/lldStore'
import LldBreadcrumb from './LldBreadcrumb'
import LldExportMenu from './LldExportMenu'
import LldWorkspace from './LldWorkspace'
import type { ArchitectureEdge, ArchitectureNode } from '@/types/diagram'

interface Props {
  diagramId: string
  diagramName: string
  componentId: string
  title: string
  component: ArchitectureNode
  hldNodes: ArchitectureNode[]
  hldEdges: ArchitectureEdge[]
}

/**
 * Standalone page for a component-scoped LLD workspace.
 *
 * ReactFlowProvider sits above the header so the breadcrumb and export menu can
 * use React Flow hooks, matching the placement in WhiteboardApp.
 */
export default function LldWorkspaceShell({
  diagramId,
  diagramName,
  componentId,
  title,
  component,
  hldNodes,
  hldEdges,
}: Props) {
  const [paletteOpen, setPaletteOpen] = useState(true)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const workspace = useLldWorkspaceFor(componentId)

  const activeDiagram =
    workspace?.diagrams.find((d) => d.id === workspace.activeDiagramId) ?? workspace?.diagrams[0]

  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
        <LldBreadcrumb
          diagramId={diagramId}
          diagramName={diagramName}
          scopeId={componentId}
          title={title}
          activeDiagramId={workspace?.activeDiagramId ?? null}
        >
          <button
            type="button"
            onClick={() => setPaletteOpen((v) => !v)}
            aria-label={paletteOpen ? 'Hide palette' : 'Show palette'}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
          >
            {paletteOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setInspectorOpen((v) => !v)}
            aria-label={inspectorOpen ? 'Hide inspector' : 'Show inspector'}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
          >
            {inspectorOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </button>
          {workspace && activeDiagram && (
            <LldExportMenu workspace={workspace} diagram={activeDiagram} />
          )}
        </LldBreadcrumb>

        <LldWorkspace
          scopeId={componentId}
          diagramId={diagramId}
          title={title}
          component={component}
          hldNodes={hldNodes}
          hldEdges={hldEdges}
          paletteOpen={paletteOpen}
          inspectorOpen={inspectorOpen}
        />
      </div>
    </ReactFlowProvider>
  )
}
