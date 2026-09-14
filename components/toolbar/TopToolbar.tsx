'use client'

import Image from 'next/image'
import { useCallback, useRef, useState, useEffect } from 'react'
import PresenceAvatars from '@/components/collab/PresenceAvatars'
import {
  Undo2, Redo2, Download,
  LayoutTemplate, Keyboard, Clock, ChevronLeft,
  CheckCircle2, Loader2, AlertCircle, LogOut, Zap, Calculator, UserPlus, Code2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useDiagramStore } from '@/store/diagramStore'
import LldComponentPicker from '@/components/lld/LldComponentPicker'
import { useHistoryStore } from '@/store/historyStore'
import { useUiStore } from '@/store/uiStore'

interface TopToolbarProps {
  diagramId?: string
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error'
  /** Work exists locally that has not reached the cloud yet. */
  unsaved?: boolean
  onSave?: () => void
  onHistoryOpen?: () => void
  userEmail?: string
}

export default function TopToolbar({ diagramId, saveStatus, unsaved, onSave, onHistoryOpen, userEmail }: TopToolbarProps) {
  const { diagramName, setDiagramName, switchBoard, activeBoard } = useDiagramStore()
  const { canUndo, canRedo, undo, redo } = useHistoryStore()
  const { setTemplateModalOpen, setShortcutsModalOpen, setExportModalOpen, setBoardMode, boardMode, simulationOpen, setSimulationOpen, estimateOpen, setEstimateOpen, setShareModalOpen, codeOpen, setCodeOpen } =
    useUiStore()
  const [lldPickerOpen, setLldPickerOpen] = useState(false)
  const router = useRouter()
  const [editingName, setEditingName] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const isCloudMode = !!diagramId

  const handleSignOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }, [router])

  // Cmd+S to save
  useEffect(() => {
    if (!onSave) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        onSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onSave])

  const mode = activeBoard ?? boardMode

  // One state change drives both the canvas and the sidebar. setBoardMode is
  // kept in step for the components that still read it.
  const handleModeSwitch = useCallback(
    (next: 'hld' | 'lld') => {
      if (next === mode) return
      switchBoard(next)
      setBoardMode(next)
    },
    [mode, switchBoard, setBoardMode]
  )

  const handleUndo = useCallback(() => {
    const { nodes, edges } = useDiagramStore.getState()
    const snapshot = undo({ nodes, edges })
    if (snapshot) {
      useDiagramStore.getState().setNodes(snapshot.nodes)
      useDiagramStore.getState().setEdges(snapshot.edges)
    }
  }, [undo])

  const handleRedo = useCallback(() => {
    const { nodes, edges } = useDiagramStore.getState()
    const snapshot = redo({ nodes, edges })
    if (snapshot) {
      useDiagramStore.getState().setNodes(snapshot.nodes)
      useDiagramStore.getState().setEdges(snapshot.edges)
    }
  }, [redo])

  // `min-w-0` on the header matters: without it the row cannot shrink below its content, so
  // instead of the diagram name truncating, the whole right-hand cluster was pushed past the
  // edge and Export and the account controls became unreachable.
  return (
    <header className="flex items-center gap-2 px-4 h-12 bg-white border-b border-gray-200 shrink-0 z-10 min-w-0">
      {/* Logo */}
      <div className="flex items-center shrink-0 mr-1">
        <Image
          src="/brand/archboard-nav.png"
          alt="ArchBoard"
          width={148}
          height={32}
          className="h-7 w-auto object-contain"
          priority
        />
      </div>

      <div className="w-px h-5 bg-gray-200" />

      {/* HLD / LLD mode */}
      <div
        className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200/80 shrink-0"
        role="group"
        aria-label="Diagram mode"
      >
        <button
          type="button"
          onClick={() => handleModeSwitch('hld')}
          className={[
            'px-2.5 py-1 text-xs font-semibold rounded-md transition-colors',
            mode === 'hld'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          ].join(' ')}
        >
          HLD
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch('lld')}
          className={[
            'px-2.5 py-1 text-xs font-semibold rounded-md transition-colors',
            mode === 'lld'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          ].join(' ')}
        >
          LLD
        </button>
      </div>

      <div className="w-px h-5 bg-gray-200" />

      {/* Diagram name — the one thing that gives up space first, by truncating. */}
      <div className="flex items-center min-w-0">
        {editingName ? (
          <input
            ref={nameRef}
            type="text"
            value={diagramName}
            onChange={(e) => setDiagramName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false)
            }}
            autoFocus
            className="text-sm font-medium text-gray-800 bg-blue-50 border border-blue-300 rounded px-2 py-0.5
              focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px] max-w-[240px]"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-2 py-1 rounded transition-colors max-w-[200px] min-w-0 truncate"
          >
            {diagramName}
          </button>
        )}
      </div>

      <div className="w-px h-5 bg-gray-200" />

      {/*
        Undo / Redo — HLD only.

        This toolbar survives the board swap, but these buttons act on the HLD document
        through historyStore, so in LLD mode they silently reverted work on a canvas the
        user could not see. LLD keeps its own per-diagram history in lldStore and offers
        undo in its own header, so hiding them here also removes two Undo buttons that
        did different things.
      */}
      {activeBoard !== 'lld' && (
        <>
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (⌘Z)"
              icon={<Undo2 className="w-4 h-4" />}
            />
            <ToolbarButton
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (⌘⇧Z)"
              icon={<Redo2 className="w-4 h-4" />}
            />
          </div>

          <div className="w-px h-5 bg-gray-200" />
        </>
      )}

      {/*
        Zoom, fit, grid and snap used to sit here. They are now a floating cluster on the
        canvas itself — see components/canvas/CanvasControls.tsx. They describe how you are
        looking at the canvas rather than anything about the diagram, and five more buttons
        was what pushed this row past the width of a laptop screen.
      */}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side actions. Never shrinks — these are the ones that must stay reachable. */}
      <div className="flex items-center gap-1 shrink-0">
        <ToolbarButton
          onClick={() => setTemplateModalOpen(true)}
          title="Templates"
          icon={<LayoutTemplate className="w-4 h-4" />}
          label="Templates"
        />
        <ToolbarButton
          onClick={() => setShortcutsModalOpen(true)}
          title="Keyboard shortcuts"
          icon={<Keyboard className="w-4 h-4" />}
        />
        {/*
          The three panels, as one segmented control.

          They were three separate bordered buttons with permanent labels, which together ate
          most of the right-hand space and pushed Export and the account controls off the edge
          of the bar. Grouping them also says what is true — these are views onto the same
          diagram — and matches the HLD/LLD switch on the left.
        */}
        <div
          className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200/80 shrink-0"
          role="group"
          aria-label="Panels"
        >
          <PanelToggle
            onClick={() => setCodeOpen(!codeOpen)}
            active={codeOpen}
            title="Write the diagram as code"
            icon={<Code2 className="w-3.5 h-3.5" />}
            label="Code"
            activeClass="bg-white text-slate-900 shadow-sm"
          />
          <PanelToggle
            onClick={() => setSimulationOpen(!simulationOpen)}
            active={simulationOpen}
            title="Simulate request flow"
            icon={<Zap className="w-3.5 h-3.5" />}
            label="Simulate"
            activeClass="bg-white text-blue-700 shadow-sm"
          />
          <PanelToggle
            onClick={() => setEstimateOpen(!estimateOpen)}
            active={estimateOpen}
            title="Back-of-envelope capacity estimate"
            icon={<Calculator className="w-3.5 h-3.5" />}
            label="Capacity"
            activeClass="bg-white text-indigo-700 shadow-sm"
          />
        </div>

        {/* History button — only in cloud mode */}
        {/* Who else is in the diagram. Shown before Share, since it answers "is anyone
            here" — the question Share raises. Cloud mode only; a local diagram has no room. */}
        {isCloudMode && <PresenceAvatars />}

        {isCloudMode && (
          <button
            onClick={() => setShareModalOpen(true)}
            title="Share this diagram"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg
              transition-all border text-gray-700 border-gray-200 bg-white
              hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden lg:inline">Share</span>
          </button>
        )}

        {isCloudMode && onHistoryOpen && (
          <ToolbarButton
            onClick={onHistoryOpen}
            title="Version history"
            icon={<Clock className="w-4 h-4" />}
            label="History"
          />
        )}

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Save button — only in cloud mode */}
        {/*
          Save state, not just a Save button.

          Saving is now automatic, so this mostly reports rather than invites — but it stays
          clickable, because when a save has failed the one thing someone wants is to try
          again. The idle-but-dirty state is the one that was missing: work sitting only in
          this browser used to look identical to work safely in the cloud.
        */}
        {isCloudMode && onSave && (
          <button
            onClick={onSave}
            disabled={saveStatus === 'saving'}
            title={
              saveStatus === 'error'
                ? 'Could not reach the server — click to retry'
                : unsaved
                  ? 'Unsaved changes, saving shortly (⌘S to save now)'
                  : 'Everything is saved (⌘S)'
            }
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all border',
              saveStatus === 'saving'
                ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                : saveStatus === 'saved'
                ? 'bg-green-50 text-green-700 border-green-200'
                : saveStatus === 'error'
                ? 'bg-red-50 text-red-600 border-red-200'
                : unsaved
                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300',
            ].join(' ')}
          >
            {saveStatus === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saveStatus === 'saved'  && <CheckCircle2 className="w-3.5 h-3.5" />}
            {saveStatus === 'error'  && <AlertCircle className="w-3.5 h-3.5" />}
            {(!saveStatus || saveStatus === 'idle') &&
              (unsaved ? (
                // A filled dot is the established "not written yet" mark in an editor.
                <span className="w-3.5 h-3.5 flex items-center justify-center" aria-hidden>
                  <span className="w-2 h-2 rounded-full bg-current" />
                </span>
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ))}
            {/* Kept at more widths than the other labels: the wording is the status. */}
            <span className="hidden lg:inline">
              {saveStatus === 'saving' ? 'Saving…'
               : saveStatus === 'saved' ? 'Saved'
               : saveStatus === 'error' ? 'Retry'
               : unsaved ? 'Unsaved'
               : 'Saved'}
            </span>
          </button>
        )}

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <button
          onClick={() => setExportModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-700
            text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          <span className="hidden lg:inline">Export</span>
        </button>

        {/* User avatar + sign out — only in cloud mode */}
        {isCloudMode && userEmail && (
          <>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => router.push('/dashboard')}
                title="Back to dashboard"
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden md:block">Diagrams</span>
              </button>
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold" title={userEmail}>
                {userEmail[0].toUpperCase()}
              </div>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
      {lldPickerOpen && <LldComponentPicker onClose={() => setLldPickerOpen(false)} />}
    </header>
  )
}

interface ToolbarButtonProps {
  onClick: () => void
  icon: React.ReactNode
  title: string
  disabled?: boolean
  active?: boolean
  label?: string
}

function ToolbarButton({ onClick, icon, title, disabled, active, label }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        'flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm transition-colors shrink-0',
        disabled
          ? 'text-gray-300 cursor-not-allowed'
          : active
          ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      ].join(' ')}
    >
      {icon}
      {/* Below this the icon and its tooltip carry the meaning on their own. */}
      {label && <span className="hidden lg:inline text-xs font-medium">{label}</span>}
    </button>
  )
}

interface PanelToggleProps {
  onClick: () => void
  icon: React.ReactNode
  title: string
  label: string
  active: boolean
  /** Colour for the active state, so each panel keeps the accent it already had. */
  activeClass: string
}

function PanelToggle({ onClick, icon, title, label, active, activeClass }: PanelToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={[
        'flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors',
        active ? activeClass : 'text-slate-500 hover:text-slate-700',
      ].join(' ')}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  )
}
