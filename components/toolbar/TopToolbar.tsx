'use client'

import Image from 'next/image'
import { useCallback, useRef, useState } from 'react'
import {
  Undo2, Redo2, Download, Share2, Settings2,
  LayoutTemplate, Keyboard, Grid3x3, Magnet, ZoomIn,
  ZoomOut, Maximize2, Plus, ChevronDown
} from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { useDiagramStore } from '@/store/diagramStore'
import { useHistoryStore } from '@/store/historyStore'
import { useUiStore } from '@/store/uiStore'

export default function TopToolbar() {
  const { diagramName, setDiagramName, snapToGrid, setSnapToGrid, showGrid, setShowGrid, switchBoard, activeBoard } =
    useDiagramStore()
  const { canUndo, canRedo, undo, redo } = useHistoryStore()
  const { setTemplateModalOpen, setShortcutsModalOpen, setExportModalOpen, setBoardMode, boardMode } =
    useUiStore()
  const reactFlow = useReactFlow()
  const [editingName, setEditingName] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

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
      <div className="flex items-center gap-2 mr-1 shrink-0">
        <Image
          src="/brand/archboard-mark.png"
          alt="ArchBoard"
          width={32}
          height={32}
          className="w-8 h-8 rounded-lg object-cover shadow-sm ring-1 ring-slate-200/80"
          priority
        />
        <span className="text-sm font-semibold tracking-tight hidden sm:inline">
          <span className="text-slate-800">Arch</span>
          <span className="text-blue-600">Board</span>
        </span>
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

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <button
          onClick={() => setExportModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-700
            text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
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
