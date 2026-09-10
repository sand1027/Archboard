'use client'

import { useEffect, useRef } from 'react'
import { Copy, Trash2, Layers, PlusCircle, Maximize2, MousePointer2, Square } from 'lucide-react'
import { useUiStore } from '@/store/uiStore'
import { useDiagramStore } from '@/store/diagramStore'
import { useHistoryStore } from '@/store/historyStore'
import type { FrameNodeData } from '@/types/architecture'
import type { ArchitectureNode } from '@/types/diagram'
import { useReactFlow } from '@xyflow/react'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function ContextMenu() {
  const { contextMenu, hideContextMenu } = useUiStore()
  const { nodes, edges, deleteNode, deleteEdge, copySelected, pasteClipboard, duplicateNodes, addNode, selectAll, selectedNodeIds } = useDiagramStore()
  const { pushSnapshot } = useHistoryStore()
  const reactFlow = useReactFlow()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideContextMenu()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [hideContextMenu])

  // Position so menu doesn't go off screen
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: contextMenu.x,
    top: contextMenu.y,
    zIndex: 9999,
  }

  const wrap = (fn: () => void) => () => { fn(); hideContextMenu() }

  if (contextMenu.type === 'node' && contextMenu.targetId) {
    const nodeId = contextMenu.targetId
    return (
      <div ref={menuRef} style={menuStyle} className="bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-[160px]">
        <MenuItem
          icon={<Copy className="w-4 h-4" />}
          label="Duplicate"
          onClick={wrap(() => {
            pushSnapshot({ nodes, edges })
            duplicateNodes([nodeId])
          })}
        />
        <MenuItem
          icon={<MousePointer2 className="w-4 h-4" />}
          label="Copy"
          onClick={wrap(() => {
            useDiagramStore.getState().setSelectedNodeIds([nodeId])
            copySelected()
          })}
        />
        <MenuSeparator />
        <MenuItem
          icon={<Square className="w-4 h-4" />}
          label="Create Frame"
          onClick={wrap(() => {
            const node = nodes.find((n) => n.id === nodeId)
            if (!node) return
            pushSnapshot({ nodes, edges })
            const frame: ArchitectureNode = {
              id: generateId(),
              type: 'frame',
              position: { x: node.position.x - 30, y: node.position.y - 50 },
              data: {
                label: 'New Frame',
                frameType: 'custom',
              } as FrameNodeData,
              style: { width: 200, height: 200 },
            }
            addNode(frame)
          })}
        />
        <MenuSeparator />
        <MenuItem
          icon={<Trash2 className="w-4 h-4 text-red-500" />}
          label="Delete"
          danger
          onClick={wrap(() => {
            pushSnapshot({ nodes, edges })
            deleteNode(nodeId)
          })}
        />
      </div>
    )
  }

  if (contextMenu.type === 'edge' && contextMenu.targetId) {
    const edgeId = contextMenu.targetId
    return (
      <div ref={menuRef} style={menuStyle} className="bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-[160px]">
        <MenuItem
          icon={<Trash2 className="w-4 h-4 text-red-500" />}
          label="Delete Connection"
          danger
          onClick={wrap(() => {
            pushSnapshot({ nodes, edges })
            deleteEdge(edgeId)
          })}
        />
      </div>
    )
  }

  // Canvas context menu
  return (
    <div ref={menuRef} style={menuStyle} className="bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-[160px]">
      <MenuItem
        icon={<Copy className="w-4 h-4" />}
        label="Paste"
        onClick={wrap(() => {
          pushSnapshot({ nodes, edges })
          pasteClipboard()
        })}
      />
      <MenuItem
        icon={<MousePointer2 className="w-4 h-4" />}
        label="Select All"
        onClick={wrap(selectAll)}
        shortcut="⌘A"
      />
      <MenuSeparator />
      <MenuItem
        icon={<Maximize2 className="w-4 h-4" />}
        label="Fit View"
        onClick={wrap(() => reactFlow.fitView({ padding: 0.1, duration: 400 }))}
        shortcut="⌘⇧F"
      />
      <MenuSeparator />
      <MenuItem
        icon={<Square className="w-4 h-4" />}
        label="Add Frame"
        onClick={wrap(() => {
          const pos = reactFlow.screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y })
          pushSnapshot({ nodes, edges })
          const frame: ArchitectureNode = {
            id: generateId(),
            type: 'frame',
            position: { x: pos.x - 100, y: pos.y - 75 },
            data: { label: 'New Frame', frameType: 'custom' } as FrameNodeData,
            style: { width: 300, height: 200 },
          }
          addNode(frame)
        })}
      />
    </div>
  )
}

function MenuItem({
  icon, label, onClick, danger, shortcut
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  shortcut?: string
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left transition-colors',
        danger
          ? 'text-red-600 hover:bg-red-50'
          : 'text-gray-700 hover:bg-gray-50',
      ].join(' ')}
    >
      <span className="text-gray-400">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-xs text-gray-400">{shortcut}</span>}
    </button>
  )
}

function MenuSeparator() {
  return <div className="my-1 border-t border-gray-100" />
}
