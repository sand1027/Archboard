'use client'

import Image from 'next/image'
import { useCallback, useRef, useState, useEffect } from 'react'
import {
  Undo2, Redo2, Download,
  LayoutTemplate, Keyboard, Grid3x3, Magnet, ZoomIn,
  ZoomOut, Maximize2, Clock, ChevronLeft,
  CheckCircle2, Loader2, AlertCircle, LogOut, Zap,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useReactFlow } from '@xyflow/react'
import { createClient } from '@/lib/supabase/client'
import { useDiagramStore } from '@/store/diagramStore'
import { useHistoryStore } from '@/store/historyStore'
import { useUiStore } from '@/store/uiStore'

interface TopToolbarProps {
  diagramId?: string
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error'
  onSave?: () => void
  onHistoryOpen?: () => void
  userEmail?: string
}

export default function TopToolbar({ diagramId, saveStatus, onSave, onHistoryOpen, userEmail }: TopToolbarProps) {
  const { diagramName, setDiagramName, snapToGrid, setSnapToGrid, showGrid, setShowGrid, switchBoard, activeBoard } =
    useDiagramStore()
  const { canUndo, canRedo, undo, redo } = useHistoryStore()
  const { setTemplateModalOpen, setShortcutsModalOpen, setExportModalOpen, setBoardMode, boardMode, simulationOpen, setSimulationOpen } =
    useUiStore()
  const reactFlow = useReactFlow()
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

  const handleFitView = useCallback(() => {
    reactFlow.fitView({ padding: 0.1, duration: 400 })
  }, [reactFlow])

  const handleZoomIn = useCallback(() => {
    reactFlow.zoomIn({ duration: 200 })
  }, [reactFlow])

  const handleZoomOut = useCallback(() => {
    reactFlow.zoomOut({ duration: 200 })
  }, [reactFlow])

  return (
    <header className="flex items-center gap-2 px-4 h-12 bg-white border-b border-gray-200 shrink-0 z-10">
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

      {/* Diagram name */}
      <div className="flex items-center">
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
            className="text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-2 py-1 rounded transition-colors max-w-[200px] truncate"
          >
            {diagramName}
          </button>
        )}
      </div>

      <div className="w-px h-5 bg-gray-200" />

      {/* Undo / Redo */}
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

      {/* Canvas controls */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={handleZoomOut}
          title="Zoom out"
          icon={<ZoomOut className="w-4 h-4" />}
        />
        <ToolbarButton
          onClick={handleZoomIn}
          title="Zoom in"
          icon={<ZoomIn className="w-4 h-4" />}
        />
        <ToolbarButton
          onClick={handleFitView}
          title="Fit to screen"
          icon={<Maximize2 className="w-4 h-4" />}
        />
      </div>

      <div className="w-px h-5 bg-gray-200" />

      {/* Grid & snap */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => setShowGrid(!showGrid)}
          title={showGrid ? 'Hide grid' : 'Show grid'}
          active={showGrid}
          icon={<Grid3x3 className="w-4 h-4" />}
        />
        <ToolbarButton
          onClick={() => setSnapToGrid(!snapToGrid)}
          title={snapToGrid ? 'Disable snap' : 'Enable snap to grid'}
          active={snapToGrid}
          icon={<Magnet className="w-4 h-4" />}
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side actions */}
      <div className="flex items-center gap-1">
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
        {/* Simulate button */}
        <button
          onClick={() => setSimulationOpen(!simulationOpen)}
          title="Simulate request flow"
          className={[
            'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all border',
            simulationOpen
              ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
              : 'text-gray-700 border-gray-200 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300',
          ].join(' ')}
        >
          <Zap className="w-4 h-4" />
          <span>Simulate</span>
        </button>

        {/* History button — only in cloud mode */}
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
        {isCloudMode && onSave && (
          <button
            onClick={onSave}
            disabled={saveStatus === 'saving'}
            title="Save to cloud (⌘S)"
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all border',
              saveStatus === 'saving'
                ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                : saveStatus === 'saved'
                ? 'bg-green-50 text-green-700 border-green-200'
                : saveStatus === 'error'
                ? 'bg-red-50 text-red-600 border-red-200'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300',
            ].join(' ')}
          >
            {saveStatus === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saveStatus === 'saved'  && <CheckCircle2 className="w-3.5 h-3.5" />}
            {saveStatus === 'error'  && <AlertCircle className="w-3.5 h-3.5" />}
            {(!saveStatus || saveStatus === 'idle') && (
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                <path d="M13 1H3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V4l-2-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M5 1v4h6V1M5 9h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )}
            <span>
              {saveStatus === 'saving' ? 'Saving…'
               : saveStatus === 'saved' ? 'Saved'
               : saveStatus === 'error' ? 'Failed'
               : 'Save'}
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
          <span>Export</span>
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
        'flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm transition-colors',
        disabled
          ? 'text-gray-300 cursor-not-allowed'
          : active
          ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      ].join(' ')}
    >
      {icon}
      {label && <span className="text-xs font-medium">{label}</span>}
    </button>
  )
}
