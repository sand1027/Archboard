'use client'

import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import ComponentLibrary from './library/ComponentLibrary'
import PropertiesPanel from './inspector/PropertiesPanel'
import TopToolbar from './toolbar/TopToolbar'
import CanvasShell from './canvas/CanvasShell'
import TemplatesModal from './templates/TemplatesModal'
import KeyboardShortcutsModal from './ui/KeyboardShortcutsModal'
import ExportModal from './ui/ExportModal'
import SimulationPanel from './simulation/SimulationPanel'
import EstimatePanel from './estimate/EstimatePanel'
import RequirementsPanel from './notes/RequirementsPanel'
import CollaborationLayer from './collab/CollaborationLayer'
import ShareModal from './collab/ShareModal'
import LldWorkspace from './lld/LldWorkspace'
import DslPanel from './dsl/DslPanel'
import LocalModeBanner from './LocalModeBanner'
import { useDiagramPersistence } from '@/hooks/useDiagramPersistence'
import { useDslSync } from '@/hooks/useDslSync'
import { useUiStore } from '@/store/uiStore'
import { useDiagramStore } from '@/store/diagramStore'
import { simulationEngine } from '@/lib/simulation/engine'
import { STANDALONE_LLD_SCOPE } from '@/types/lld'

export interface WhiteboardAppProps {
  diagramId?: string
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error'
  /** Work exists locally that has not reached the cloud yet. */
  unsaved?: boolean
  onSave?: () => void
  onHistoryOpen?: () => void
  userId?: string
  /** Team the diagram is attached to, if any. */
  teamId?: string | null
  userEmail?: string
}

function AppInner({
  diagramId,
  saveStatus,
  unsaved,
  onSave,
  onHistoryOpen,
  userId,
  userEmail,
  teamId,
}: WhiteboardAppProps) {
  // Autosave must survive the HLD↔LLD swap, so it is owned here rather than
  // by CanvasShell, which unmounts in LLD mode.
  useDiagramPersistence()

  // Owned here rather than by the code pane: a diagram authored as text has to render on
  // load whether or not the editor happens to be open.
  useDslSync()

  // The engine is a module singleton driving its own animation frames. Nothing
  // stopped it when the editor went away, so navigating to the dashboard left a
  // loop running and writing packets into the store for a canvas that no longer
  // existed.
  useEffect(() => () => simulationEngine.reset(), [])

  const libraryOpen = useUiStore((s) => s.libraryOpen)
  const codeOpen = useUiStore((s) => s.codeOpen)
  const inspectorOpen = useUiStore((s) => s.inspectorOpen)
  const simulationOpen = useUiStore((s) => s.simulationOpen)
  const estimateOpen = useUiStore((s) => s.estimateOpen)
  const notesOpen = useUiStore((s) => s.notesOpen)
  const shareModalOpen = useUiStore((s) => s.shareModalOpen)

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
        unsaved={unsaved}
        onSave={onSave}
        onHistoryOpen={onHistoryOpen}
        userEmail={userEmail}
      />

      {/* No diagram id means no account behind this, so nothing here reaches a server. */}
      {!diagramId && <LocalModeBanner />}

      {/* Live collaboration. Cloud mode only: a local diagram has no channel to join. */}
      {diagramId && userId && (
        <CollaborationLayer diagramId={diagramId} userId={userId} userEmail={userEmail} />
      )}

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
          {/*
            Left rail: the component library, or the code editor. One at a time, since
            writing the diagram out in text and dragging components into it are not things
            anyone does in the same moment. Code gets more room — it is text.
          */}
          <aside
            className="flex-shrink-0 overflow-hidden border-r border-slate-200/80 bg-white transition-all duration-200"
            style={{ width: codeOpen ? 400 : libraryOpen ? 240 : 0 }}
          >
            {codeOpen ? (
              <div className="h-full w-[400px] overflow-hidden">
                <DslPanel />
              </div>
            ) : libraryOpen ? (
              <div className="h-full w-[240px] overflow-hidden">
                <ComponentLibrary />
              </div>
            ) : null}
          </aside>

          <main className="relative flex-1 overflow-hidden">
            <CanvasShell />
          </main>

          {/* Right: capacity, simulation or inspector — one at a time */}
          <aside
            className="flex-shrink-0 overflow-hidden border-l border-slate-200/80 bg-white transition-all duration-200"
            style={{
              width:
                inspectorOpen || simulationOpen || estimateOpen || notesOpen ? 280 : 0,
            }}
          >
            {notesOpen ? (
              <div className="h-full w-[280px] overflow-hidden">
                <RequirementsPanel />
              </div>
            ) : estimateOpen ? (
              <div className="h-full w-[280px] overflow-hidden">
                <EstimatePanel />
              </div>
            ) : simulationOpen ? (
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

      {/* Sharing needs a persisted diagram to attach access to, so cloud mode only. */}
      {shareModalOpen && diagramId && (
        <ShareModal diagramId={diagramId} ownerEmail={userEmail} teamId={teamId} />
      )}
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
