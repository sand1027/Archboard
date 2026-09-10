'use client'

import { useCallback, useRef, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  SelectionMode,
  MarkerType,
  Panel,
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
import type { FrameNodeData, ShapeNodeData } from '@/types/architecture'

import ArchitectureNodeComponent from './ArchitectureNode'
import ArchitectureEdgeComponent from './ArchitectureEdge'
import FrameNodeComponent from './FrameNode'
import ShapeNodeComponent from './ShapeNode'
import UmlClassNodeComponent from './UmlClassNode'
import UmlEntityNodeComponent from './UmlEntityNode'
import UmlLifelineNodeComponent from './UmlLifelineNode'
import IconNodeComponent from './IconNode'
import ShapesToolbar from './ShapesToolbar'
import ContextMenuComponent from '../ui/ContextMenu'
import { findLldItem } from '@/data/lld'
import { spawnLldNode } from '@/lib/spawnLldNode'

const nodeTypes: NodeTypes = {
  architecture: ArchitectureNodeComponent,
  frame: FrameNodeComponent,
  shape: ShapeNodeComponent,
  umlClass: UmlClassNodeComponent,
  umlEntity: UmlEntityNodeComponent,
  umlLifeline: UmlLifelineNodeComponent,
  icon: IconNodeComponent,
}

const edgeTypes: EdgeTypes = {
  architecture: ArchitectureEdgeComponent,
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Architecture node size (SVG icon + label — no card chrome)
const ARCH_NODE_W = 72
const ARCH_NODE_H = 88

// Default sizes per shape tool (used for click / tiny-drag placement)
const SHAPE_DEFAULTS: Record<string, { w: number; h: number }> = {
  rectangle:     { w: 160, h: 100 },
  ellipse:       { w: 160, h: 100 },
  diamond:       { w: 140, h: 100 },
  triangle:      { w: 140, h: 110 },
  parallelogram: { w: 160, h: 80  },
  cylinder:      { w: 120, h: 130 },
  hexagon:       { w: 140, h: 120 },
  star:          { w: 120, h: 120 },
  arrow:         { w: 160, h: 40  },
  line:          { w: 160, h: 40  },
  text:          { w: 160, h: 60  },
  frame:         { w: 300, h: 220 },
  terminator:    { w: 140, h: 56  },
  document:      { w: 150, h: 110 },
  preparation:   { w: 150, h: 90  },
  connector:     { w: 48,  h: 48  },
  note:          { w: 140, h: 100 },
}

/** Padding so freehand stroke + arrowhead stay inside the node box */
const LINEAR_PAD = 16

const MIN_DRAW_SIZE = 8
const CLICK_THRESHOLD = 6

function isLinearTool(tool: string) {
  return tool === 'line' || tool === 'arrow'
}

function isContainerNode(node: { type?: string; data?: Record<string, unknown> }) {
  if (node.type === 'frame') return true
  if (node.type !== 'shape') return false
  const t = String(node.data?.shapeType ?? '')
  return t !== 'line' && t !== 'arrow' && t !== 'text' && !t.startsWith('arrow')
}

function nodeBounds(node: {
  position: { x: number; y: number }
  width?: number
  height?: number
  measured?: { width?: number; height?: number }
  style?: { width?: number | string; height?: number | string }
}) {
  const w =
    node.width ??
    node.measured?.width ??
    (typeof node.style?.width === 'number' ? node.style.width : undefined) ??
    100
  const h =
    node.height ??
    node.measured?.height ??
    (typeof node.style?.height === 'number' ? node.style.height : undefined) ??
    80
  return { x: node.position.x, y: node.position.y, w, h }
}

function centerInside(
  child: Parameters<typeof nodeBounds>[0],
  parent: { x: number; y: number; w: number; h: number }
) {
  const c = nodeBounds(child)
  const cx = c.x + c.w / 2
  const cy = c.y + c.h / 2
  return cx >= parent.x && cx <= parent.x + parent.w && cy >= parent.y && cy <= parent.y + parent.h
}

type DrawSession = {
  id: string
  tool: string
  startX: number
  startY: number
}

type GroupDragSession = {
  parentId: string
  childIds: string[]
  lastX: number
  lastY: number
}

export default function Whiteboard() {
  const reactFlowInstance = useReactFlow()
  const {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect,
    addNode, setSelectedNodeIds, setSelectedEdgeIds,
    snapToGrid, gridSize, showGrid,
    setViewport,
    activeBoard,
  } = useDiagramStore()

  const { pushSnapshot } = useHistoryStore()
  const {
    setContextMenu, hideContextMenu, contextMenu,
    activeTool, setActiveTool, setTemplateModalOpen,
  } = useUiStore()

  const isLld = activeBoard === 'lld'

  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const drawSession = useRef<DrawSession | null>(null)
  const groupDrag = useRef<GroupDragSession | null>(null)

  // ── keyboard shortcuts for tools ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      const map: Record<string, typeof activeTool> = {
        v: 'select', h: 'hand',
        r: 'rectangle', o: 'ellipse', d: 'diamond',
        t: 'triangle', a: 'arrow', l: 'line', x: 'text',
        p: 'parallelogram',
      }
      if (map[e.key.toLowerCase()]) {
        e.preventDefault()
        setActiveTool(map[e.key.toLowerCase()])
      }
      if (e.key === 'Escape') {
        // Cancel in-progress draw
        if (drawSession.current) {
          useDiagramStore.getState().deleteNode(drawSession.current.id)
          drawSession.current = null
        }
        setActiveTool('select')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setActiveTool])

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

  // Build edge with active style applied
  const handleConnect: OnConnect = useCallback(
    (connection) => {
      snapshotBeforeChange()
      const { activeEdgeStyle: es } = useUiStore.getState()
      const markerStart = es.startArrow !== 'none'
        ? { type: es.startArrow as any }
        : undefined
      const markerEnd = es.endArrow !== 'none'
        ? { type: es.endArrow as any, width: 16, height: 16 }
        : undefined

      const dash = es.strokeStyle === 'dashed'
        ? `${es.strokeWidth * 4},${es.strokeWidth * 3}`
        : es.strokeStyle === 'dotted'
        ? `${es.strokeWidth},${es.strokeWidth * 2}`
        : undefined

      const edge = {
        ...connection,
        id: generateId(),
        type: 'architecture',
        animated: es.animated,
        markerStart,
        markerEnd,
        style: {
          stroke: es.strokeColor,
          strokeWidth: es.strokeWidth,
          strokeDasharray: dash,
        },
        data: {
          connectionType: 'synchronous',
          protocol: 'HTTPS',
          edgeLineStyle: es.lineStyle,
        },
      }
      useDiagramStore.getState().onConnect(connection)
      // Override the just-added edge with full styling
      setTimeout(() => {
        useDiagramStore.getState().setEdges(
          useDiagramStore.getState().edges.map((e) =>
            e.source === connection.source && e.target === connection.target
              ? { ...e, ...edge } as typeof e
              : e
          )
        )
      }, 0)
    },
    [snapshotBeforeChange]
  )

  // ── drag-and-drop from sidebar ─────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()

      const lldId = e.dataTransfer.getData('application/archboard-lld')
      if (lldId) {
        const item = findLldItem(lldId)
        if (!item) return
        const position = reactFlowInstance.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        })
        snapshotBeforeChange()
        addNode(spawnLldNode(item, position))
        return
      }

      const componentId = e.dataTransfer.getData('application/archboard-component')
      if (!componentId) return
      const component = componentRegistry.find((c) => c.id === componentId)
      if (!component) return

      // Cursor maps to icon center (matches setDragImage hotspot)
      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })
      position.x -= ARCH_NODE_W / 2
      position.y -= ARCH_NODE_H / 2

      snapshotBeforeChange()
      const node: ArchitectureNode = {
        id: generateId(),
        type: 'architecture',
        position,
        width: ARCH_NODE_W,
        height: ARCH_NODE_H,
        style: { width: ARCH_NODE_W, height: ARCH_NODE_H },
        connectable: false,
        zIndex: 10,
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

  const buildShapeNode = useCallback(
    (
      tool: string,
      position: { x: number; y: number },
      w: number,
      h: number,
      id?: string,
      endpoints?: { start: { x: number; y: number }; end: { x: number; y: number } }
    ): ArchitectureNode => {
      const ui = useUiStore.getState()
      const nodeId = id ?? generateId()

      if (tool === 'frame') {
        return {
          id: nodeId,
          type: 'frame',
          position,
          data: { label: 'Frame', frameType: 'custom' } as FrameNodeData,
          style: { width: w, height: h },
          width: w,
          height: h,
          zIndex: 0,
        }
      }

      const shapeData: ShapeNodeData = {
        shapeType: tool as ShapeNodeData['shapeType'],
        label: '',
        fill: isLinearTool(tool) ? 'transparent' : ui.defaultFill,
        fillOpacity: ui.defaultFillOpacity,
        stroke: ui.defaultStroke,
        strokeWidth: ui.defaultStrokeWidth,
        strokeStyle: ui.defaultStrokeStyle,
        opacity: ui.defaultOpacity,
        cornerRadius: ui.defaultCornerRadius,
        fontSize: ui.defaultFontSize,
        textColor: ui.defaultTextColor,
        ...(endpoints ? { start: endpoints.start, end: endpoints.end } : {}),
      }

      return {
        id: nodeId,
        type: 'shape',
        position,
        data: shapeData,
        style: { width: w, height: h },
        width: w,
        height: h,
        // Flowchart shapes can connect in LLD; freehand strokes stay non-connectable
        connectable:
          useDiagramStore.getState().activeBoard === 'lld' &&
          !isLinearTool(tool) &&
          tool !== 'text',
        // Keep grouping shapes under architecture icons
        zIndex: isLinearTool(tool) || tool === 'text' ? 5 : 0,
      }
    },
    []
  )

  const updateDrawGeometry = useCallback(
    (
      id: string,
      x: number,
      y: number,
      w: number,
      h: number,
      endpoints?: { start: { x: number; y: number }; end: { x: number; y: number } }
    ) => {
      const { nodes: current, setNodes } = useDiagramStore.getState()
      setNodes(
        current.map((n) => {
          if (n.id !== id) return n
          return {
            ...n,
            position: { x, y },
            width: w,
            height: h,
            style: { ...n.style, width: w, height: h },
            data: endpoints
              ? ({ ...n.data, start: endpoints.start, end: endpoints.end } as typeof n.data)
              : n.data,
          }
        }) as ArchitectureNode[]
      )
    },
    []
  )

  // ── drag-to-draw shapes (live preview while pointer is down) ───────────────
  const handleWrapperPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      const tool = useUiStore.getState().activeTool
      if (tool === 'select' || tool === 'hand') return

      const target = e.target as HTMLElement
      // Only start draws on the empty pane (not nodes, handles, toolbar, etc.)
      if (!target.closest('.react-flow__pane')) return

      e.preventDefault()
      hideContextMenu()

      const start = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })

      // Text: click-to-place only (no rubber-band)
      if (tool === 'text') {
        const size = SHAPE_DEFAULTS.text
        snapshotBeforeChange()
        addNode(
          buildShapeNode(
            tool,
            { x: start.x - size.w / 2, y: start.y - size.h / 2 },
            size.w,
            size.h
          )
        )
        setActiveTool('select')
        return
      }

      snapshotBeforeChange()
      const id = generateId()

      if (isLinearTool(tool)) {
        // Freehand line/arrow: bbox around the stroke; endpoints track drag direction
        const pad = LINEAR_PAD
        const pos = { x: start.x - pad, y: start.y - pad }
        const size = pad * 2
        const local = { x: pad, y: pad }
        addNode(
          buildShapeNode(tool, pos, size, size, id, { start: local, end: { ...local } })
        )
        drawSession.current = { id, tool, startX: start.x, startY: start.y }
      } else {
        addNode(buildShapeNode(tool, start, MIN_DRAW_SIZE, MIN_DRAW_SIZE, id))
        drawSession.current = { id, tool, startX: start.x, startY: start.y }
      }

      const onMove = (ev: PointerEvent) => {
        const session = drawSession.current
        if (!session) return
        let cur = reactFlowInstance.screenToFlowPosition({
          x: ev.clientX,
          y: ev.clientY,
        })

        // Shift: constrain closed shapes to square / linear to axis
        if (ev.shiftKey) {
          if (isLinearTool(session.tool)) {
            const dx = cur.x - session.startX
            const dy = cur.y - session.startY
            if (Math.abs(dx) > Math.abs(dy)) cur = { x: cur.x, y: session.startY }
            else cur = { x: session.startX, y: cur.y }
          } else {
            const size = Math.max(
              Math.abs(cur.x - session.startX),
              Math.abs(cur.y - session.startY)
            )
            cur = {
              x: session.startX + Math.sign(cur.x - session.startX || 1) * size,
              y: session.startY + Math.sign(cur.y - session.startY || 1) * size,
            }
          }
        }

        if (isLinearTool(session.tool)) {
          const pad = LINEAR_PAD
          const minX = Math.min(session.startX, cur.x) - pad
          const minY = Math.min(session.startY, cur.y) - pad
          const maxX = Math.max(session.startX, cur.x) + pad
          const maxY = Math.max(session.startY, cur.y) + pad
          const w = Math.max(pad * 2, maxX - minX)
          const h = Math.max(pad * 2, maxY - minY)
          updateDrawGeometry(session.id, minX, minY, w, h, {
            start: { x: session.startX - minX, y: session.startY - minY },
            end: { x: cur.x - minX, y: cur.y - minY },
          })
          return
        }

        const x = Math.min(session.startX, cur.x)
        const y = Math.min(session.startY, cur.y)
        const w = Math.max(MIN_DRAW_SIZE, Math.abs(cur.x - session.startX))
        const h = Math.max(MIN_DRAW_SIZE, Math.abs(cur.y - session.startY))
        updateDrawGeometry(session.id, x, y, w, h)
      }

      const onUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)

        const session = drawSession.current
        if (!session) return
        drawSession.current = null

        const cur = reactFlowInstance.screenToFlowPosition({
          x: ev.clientX,
          y: ev.clientY,
        })
        const dx = Math.abs(cur.x - session.startX)
        const dy = Math.abs(cur.y - session.startY)

        // Tiny drag / click → default horizontal stroke or default closed size
        if (dx < CLICK_THRESHOLD && dy < CLICK_THRESHOLD) {
          const size = SHAPE_DEFAULTS[session.tool] ?? { w: 160, h: 100 }
          if (isLinearTool(session.tool)) {
            const pad = LINEAR_PAD
            const x = session.startX - size.w / 2
            const y = session.startY - size.h / 2
            updateDrawGeometry(session.id, x, y, size.w, size.h, {
              start: { x: pad, y: size.h / 2 },
              end: { x: size.w - pad, y: size.h / 2 },
            })
          } else {
            updateDrawGeometry(
              session.id,
              session.startX - size.w / 2,
              session.startY - size.h / 2,
              size.w,
              size.h
            )
          }
        }

        setActiveTool('select')
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [
      reactFlowInstance,
      addNode,
      buildShapeNode,
      updateDrawGeometry,
      snapshotBeforeChange,
      hideContextMenu,
      setActiveTool,
    ]
  )

  const handlePaneClick = useCallback(() => {
    hideContextMenu()
  }, [hideContextMenu])

  // ── drag container shapes/frames → move nested components with them ─────────
  const handleNodeDragStart = useCallback((_: unknown, node: Node) => {
    if (!isContainerNode(node)) {
      groupDrag.current = null
      return
    }
    const { nodes: all } = useDiagramStore.getState()
    const bounds = nodeBounds(node as ArchitectureNode)
    const childIds = all
      .filter((n) => n.id !== node.id && centerInside(n, bounds))
      .map((n) => n.id)
    groupDrag.current = {
      parentId: node.id,
      childIds,
      lastX: node.position.x,
      lastY: node.position.y,
    }
  }, [])

  const handleNodeDrag = useCallback((_: unknown, node: Node) => {
    const session = groupDrag.current
    if (!session || session.parentId !== node.id || session.childIds.length === 0) return

    const dx = node.position.x - session.lastX
    const dy = node.position.y - session.lastY
    session.lastX = node.position.x
    session.lastY = node.position.y
    if (dx === 0 && dy === 0) return

    const { nodes: current, setNodes } = useDiagramStore.getState()
    const childSet = new Set(session.childIds)
    setNodes(
      current.map((n) =>
        childSet.has(n.id)
          ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
          : n
      )
    )
  }, [])

  const handleNodeDragStop = useCallback(() => {
    groupDrag.current = null
  }, [])

  // ── selection sync ─────────────────────────────────────────────────────────
  const handleSelectionChange = useCallback(
    ({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
      setSelectedNodeIds(selNodes.map((n) => n.id))
      setSelectedEdgeIds(selEdges.map((e) => e.id))
    },
    [setSelectedNodeIds, setSelectedEdgeIds]
  )

  // ── context menus ──────────────────────────────────────────────────────────
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
    (_: unknown, vp: { x: number; y: number; zoom: number }) => setViewport(vp),
    [setViewport]
  )

  // Cursor style based on active tool
  const cursorStyle =
    activeTool === 'hand'   ? 'grab' :
    activeTool === 'select' ? 'default' : 'crosshair'

  return (
    <div
      ref={reactFlowWrapper}
      className="w-full h-full"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
      onPointerDown={handleWrapperPointerDown}
      style={{ cursor: cursorStyle }}
    >
      <ReactFlow
        nodes={nodes as Node[]}
        edges={edges as Edge[]}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onPaneClick={handlePaneClick}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onSelectionChange={handleSelectionChange}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onMoveEnd={handleMoveEnd}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: 'architecture',
          data: isLld
            ? { relationKind: 'association', label: '' }
            : { connectionType: 'synchronous', protocol: 'HTTPS' },
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
          animated: false,
        }}
        snapToGrid={snapToGrid}
        snapGrid={[gridSize, gridSize]}
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode="Shift"
        deleteKeyCode={['Backspace', 'Delete']}
        // Disable pan/selection/node-drag while a shape tool is active
        panOnDrag={activeTool === 'hand' || activeTool === 'select'}
        selectionOnDrag={activeTool === 'select'}
        nodesDraggable={activeTool === 'select'}
        nodesConnectable={isLld && activeTool === 'select'}
        elementsSelectable={activeTool === 'select' || activeTool === 'hand'}
        elevateNodesOnSelect={false}
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

        {nodes.length === 0 && (
          <Panel position="top-center" className="!mt-16 pointer-events-auto">
            <div className="rounded-2xl border border-slate-200 bg-white/95 px-6 py-5 shadow-lg shadow-slate-200/50 text-center max-w-sm">
              <p className="text-sm font-semibold text-slate-800">
                {isLld ? 'Start your low-level design' : 'Start your architecture'}
              </p>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {isLld
                  ? 'Drag flowchart, UML, ER, sequence, or icon items from the library — or draw with the toolbar.'
                  : 'Drag cloud components from the library, or sketch with shapes.'}
              </p>
              <button
                type="button"
                onClick={() => setTemplateModalOpen(true)}
                className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Browse templates
              </button>
            </div>
          </Panel>
        )}

        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'frame') return '#E5E7EB'
            if (node.type === 'umlClass' || node.type === 'umlEntity') return '#DBEAFE'
            if (node.type === 'umlLifeline') return '#E0E7FF'
            if (node.type === 'icon') return '#F1F5F9'
            if (node.type === 'shape') {
              const d = node.data as ShapeNodeData
              return (d.stroke as string) ?? '#6366F1'
            }
            const d = node.data as any
            if (d?.provider === 'aws') return '#FF990040'
            return '#6366F140'
          }}
          className="!bg-white !border !border-gray-200 !rounded-lg !shadow-sm"
          maskColor="rgba(241,245,249,0.7)"
        />

        {/* Floating shapes toolbar — bottom-centre of canvas */}
        <Panel position="bottom-center" style={{ marginBottom: 16 }}>
          <ShapesToolbar />
        </Panel>
      </ReactFlow>

      {contextMenu.visible && <ContextMenuComponent />}
    </div>
  )
}
