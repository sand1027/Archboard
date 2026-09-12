'use client'

import { ReactFlowProvider } from '@xyflow/react'
import ComponentLibrary from './library/ComponentLibrary'
import PropertiesPanel from './inspector/PropertiesPanel'
import TopToolbar from './toolbar/TopToolbar'
import CanvasShell from './canvas/CanvasShell'
import TemplatesModal from './templates/TemplatesModal'
import KeyboardShortcutsModal from './ui/KeyboardShortcutsModal'
import ExportModal from './ui/ExportModal'
import SimulationPanel from './simulation/SimulationPanel'
import LldWorkspace from './lld/LldWorkspace'
import { useDiagramPersistence } from '@/hooks/useDiagramPersistence'
import { useUiStore } from '@/store/uiStore'
import { useDiagramStore } from '@/store/diagramStore'
import { STANDALONE_LLD_SCOPE } from '@/types/lld'

export interface WhiteboardAppProps {
  diagramId?: string
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error'
  onSave?: () => void
  onHistoryOpen?: () => void
  userId?: string
  userEmail?: string
}

function AppInner({
  diagramId,
  saveStatus,
  onSave,
  onHistoryOpen,
  userEmail,
}: WhiteboardAppProps) {
  // Autosave must survive the HLD↔LLD swap, so it is owned here rather than
  // by CanvasShell, which unmounts in LLD mode.
  useDiagramPersistence()

  const libraryOpen = useUiStore((s) => s.libraryOpen)
  const inspectorOpen = useUiStore((s) => s.inspectorOpen)
  const simulationOpen = useUiStore((s) => s.simulationOpen)

  // Single source of truth for the active mode — diagramStore owns the board,
  // so the sidebar and the canvas can never disagree about which one is up.
  const activeBoard = useDiagramStore((s) => s.activeBoard)
  const diagramName = useDiagramStore((s) => s.diagramName)
  const isLld = activeBoard === 'lld'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100/40">
      <TopToolbar
        diagramId={diagramId}
        saveStatus={saveStatus}
        onSave={onSave}
        onHistoryOpen={onHistoryOpen}
        userEmail={userEmail}
      />

      {/*
        The whole editor body swaps with the mode. LLD brings its own palette,
        canvas and inspector, so the HLD panels are unmounted rather than being
        fed different content.
      */}
      {isLld ? (
        <LldWorkspace
          scopeId={STANDALONE_LLD_SCOPE}
          diagramId={diagramId ?? 'local'}
          title={diagramName}
          paletteOpen={libraryOpen}
          inspectorOpen={inspectorOpen}
        />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: HLD component library */}
          <aside
            className="flex-shrink-0 overflow-hidden border-r border-slate-200/80 bg-white transition-all duration-200"
            style={{ width: libraryOpen ? 240 : 0 }}
          >
            {libraryOpen && (
              <div className="h-full w-[240px] overflow-hidden">
                <ComponentLibrary />
              </div>
            )}
          </aside>

          <main className="relative flex-1 overflow-hidden">
            <CanvasShell />
          </main>

          {/* Right: inspector or simulation */}
          <aside
            className="flex-shrink-0 overflow-hidden border-l border-slate-200/80 bg-white transition-all duration-200"
            style={{ width: inspectorOpen || simulationOpen ? 280 : 0 }}
          >
            {simulationOpen ? (
              <div className="h-full w-[280px] overflow-hidden">
                <SimulationPanel />
              </div>
            ) : inspectorOpen ? (
              <div className="h-full w-[280px] overflow-hidden">
                <PropertiesPanel />
              </div>
            ) : null}
          </aside>
        </div>
      )}

      <TemplatesModal />
      <KeyboardShortcutsModal />
      <ExportModal />
    </div>
  )
}

export default function WhiteboardApp(props: WhiteboardAppProps) {
  return (
    <ReactFlowProvider>
      <AppInner {...props} />
    </ReactFlowProvider>
  )
}
