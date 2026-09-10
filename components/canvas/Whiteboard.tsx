'use client'

import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  SelectionMode,
  MarkerType,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Node,
  type Edge,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useDiagramStore } from '@/store/diagramStore'
import { useHistoryStore } from '@/store/historyStore'
import { useUiStore } from '@/store/uiStore'
import { componentRegistry } from '@/data/components'
import type { ArchitectureNode } from '@/types/diagram'
import type { FrameNodeData } from '@/types/architecture'

import ArchitectureNodeComponent from './ArchitectureNode'
import ArchitectureEdgeComponent from './ArchitectureEdge'
import FrameNodeComponent from './FrameNode'
import ContextMenuComponent from '../ui/ContextMenu'

const nodeTypes: NodeTypes = {
  architecture: ArchitectureNodeComponent,
  frame: FrameNodeComponent,
}

const edgeTypes: EdgeTypes = {
  architecture: ArchitectureEdgeComponent,
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function Whiteboard() {
  const reactFlowInstance = useReactFlow()
  const {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect,
    addNode, setSelectedNodeIds, setSelectedEdgeIds,
    snapToGrid, gridSize, showGrid,
    setViewport,
  } = useDiagramStore()

  const { pushSnapshot } = useHistoryStore()
  const { setContextMenu, hideContextMenu, contextMenu } = useUiStore()
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  // Snapshot before destructive changes
  const snapshotBeforeChange = useCallback(() => {
    const { nodes: n, edges: e } = useDiagramStore.getState()
    pushSnapshot({ nodes: n, edges: e })
  }, [pushSnapshot])

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const hasPositionChange = changes.some(
        (c) => c.type === 'position' && (c as any).dragging === false
      )
      const hasDeletion = changes.some((c) => c.type === 'remove')
      if (hasPositionChange || hasDeletion) snapshotBeforeChange()
      onNodesChange(changes)
    },
    [onNodesChange, snapshotBeforeChange]
  )

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const hasDeletion = changes.some((c) => c.type === 'remove')
      if (hasDeletion) snapshotBeforeChange()
      onEdgesChange(changes)
    },
    [onEdgesChange, snapshotBeforeChange]
  )

  const handleConnect: OnConnect = useCallback(
    (connection) => {
      snapshotBeforeChange()
      onConnect(connection)
    },
    [onConnect, snapshotBeforeChange]
  )

  // Drag-and-drop from sidebar
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const componentId = e.dataTransfer.getData('application/archboard-component')
      if (!componentId) return

      const component = componentRegistry.find((c) => c.id === componentId)
      if (!component) return

      const bounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!bounds) return

      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      })

      snapshotBeforeChange()

      const node: ArchitectureNode = {
        id: generateId(),
        type: 'architecture',
        position,
        data: {
          componentId: component.id,
          label: component.name,
          category: component.category,
          provider: component.provider,
          icon: component.icon,
          description: component.description,
        },
      }
      addNode(node)
    },
    [reactFlowInstance, addNode, snapshotBeforeChange]
  )

  // Selection sync
  const handleSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
      setSelectedNodeIds(selNodes.map((n) => n.id))
      setSelectedEdgeIds(selEdges.map((e) => e.id))
    },
    [setSelectedNodeIds, setSelectedEdgeIds]
  )

  // Context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setContextMenu({ visible: true, x: e.clientX, y: e.clientY, type: 'canvas' })
    },
    [setContextMenu]
  )

  const handleNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.preventDefault()
      e.stopPropagation()
      setContextMenu({ visible: true, x: e.clientX, y: e.clientY, type: 'node', targetId: node.id })
    },
    [setContextMenu]
  )

  const handleEdgeContextMenu = useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      e.preventDefault()
      e.stopPropagation()
      setContextMenu({ visible: true, x: e.clientX, y: e.clientY, type: 'edge', targetId: edge.id })
    },
    [setContextMenu]
  )

  const handleMoveEnd = useCallback(
    (_: unknown, viewport: { x: number; y: number; zoom: number }) => {
      setViewport(viewport)
    },
    [setViewport]
  )

  return (
    <div
      ref={reactFlowWrapper}
      className="w-full h-full"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={hideContextMenu}
      onContextMenu={handleContextMenu}
    >
      <ReactFlow
        nodes={nodes as Node[]}
        edges={edges as Edge[]}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onSelectionChange={handleSelectionChange}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onMoveEnd={handleMoveEnd}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: 'architecture',
          data: { connectionType: 'synchronous', protocol: 'HTTPS' },
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
          animated: false,
        }}
        snapToGrid={snapToGrid}
        snapGrid={[gridSize, gridSize]}
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode="Shift"
        deleteKeyCode={['Backspace', 'Delete']}
        fitView={false}
        minZoom={0.1}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
        className="bg-white"
      >
        {showGrid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={gridSize}
            size={1}
            color="#E5E7EB"
          />
        )}

        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'frame') return '#E5E7EB'
            const d = node.data as any
            if (d?.provider === 'aws') return '#FF990040'
            return '#6366F140'
          }}
          className="!bg-white !border !border-gray-200 !rounded-lg !shadow-sm"
          maskColor="rgba(241,245,249,0.7)"
        />
      </ReactFlow>

      {contextMenu.visible && <ContextMenuComponent />}
    </div>
  )
}
