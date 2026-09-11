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
import { useUiStore } from '@/store/uiStore'

export interface WhiteboardAppProps {
  diagramId?: string
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error'
  onSave?: () => void
  onHistoryOpen?: () => void
  userId?: string
  userEmail?: string
}

function AppInner({ diagramId, saveStatus, onSave, onHistoryOpen, userId, userEmail }: WhiteboardAppProps) {
  const { libraryOpen, inspectorOpen, simulationOpen } = useUiStore()

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100/40">
      <TopToolbar
        diagramId={diagramId}
        saveStatus={saveStatus}
        onSave={onSave}
        onHistoryOpen={onHistoryOpen}
        userEmail={userEmail}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Component Library */}
        <aside
          className="flex-shrink-0 overflow-hidden transition-all duration-200 border-r border-slate-200/80 bg-white"
          style={{ width: libraryOpen ? 240 : 0 }}
        >
          {libraryOpen && (
            <div className="w-[240px] h-full overflow-hidden">
              <ComponentLibrary />
            </div>
          )}
        </aside>

        {/* Center: Canvas */}
        <main className="flex-1 overflow-hidden relative">
          <CanvasShell />
        </main>

        {/* Right: Properties Inspector OR Simulation Panel */}
        <aside
          className="flex-shrink-0 overflow-hidden transition-all duration-200 border-l border-slate-200/80 bg-white"
          style={{ width: (inspectorOpen || simulationOpen) ? 280 : 0 }}
        >
          {simulationOpen ? (
            <div className="w-[280px] h-full overflow-hidden">
              <SimulationPanel />
            </div>
          ) : inspectorOpen ? (
            <div className="w-[280px] h-full overflow-hidden">
              <PropertiesPanel />
            </div>
          ) : null}
        </aside>
      </div>

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
