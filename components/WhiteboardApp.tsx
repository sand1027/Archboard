'use client'

import { ReactFlowProvider } from '@xyflow/react'
import ComponentLibrary from './library/ComponentLibrary'
import PropertiesPanel from './inspector/PropertiesPanel'
import TopToolbar from './toolbar/TopToolbar'
import CanvasShell from './canvas/CanvasShell'
import TemplatesModal from './templates/TemplatesModal'
import KeyboardShortcutsModal from './ui/KeyboardShortcutsModal'
import ExportModal from './ui/ExportModal'
import { useUiStore } from '@/store/uiStore'

// Everything inside ReactFlowProvider so toolbar zoom/fit and canvas share context
function AppInner() {
  const { libraryOpen, inspectorOpen } = useUiStore()

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100/40">
      {/* Top toolbar — needs ReactFlow context for zoom/fit */}
      <TopToolbar />

      {/* Three-panel layout */}
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

        {/* Right: Properties Inspector */}
        <aside
          className="flex-shrink-0 overflow-hidden transition-all duration-200 border-l border-slate-200/80 bg-white"
          style={{ width: inspectorOpen ? 260 : 0 }}
        >
          {inspectorOpen && (
            <div className="w-[260px] h-full overflow-hidden">
              <PropertiesPanel />
            </div>
          )}
        </aside>
      </div>

      {/* Modals — rendered at app level, outside canvas */}
      <TemplatesModal />
      <KeyboardShortcutsModal />
      <ExportModal />
    </div>
  )
}

export default function WhiteboardApp() {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  )
}
