'use client'

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react'
import type { ArchitectureNode, ArchitectureEdge, BoardMode, BoardSnapshot } from '@/types/diagram'
import type { Viewport } from '@/types/architecture'
import { normaliseNodesConnectable } from '@/lib/canvas/nodeConnectivity'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function emptyBoard(name: string): BoardSnapshot {
  return {
    diagramId: generateId(),
    diagramName: name,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }
}

function snapshotFromState(state: {
  diagramId: string
  diagramName: string
  nodes: ArchitectureNode[]
  edges: ArchitectureEdge[]
  viewport: Viewport
}): BoardSnapshot {
  return {
    diagramId: state.diagramId,
    diagramName: state.diagramName,
    nodes: state.nodes,
    edges: state.edges,
    viewport: state.viewport,
  }
}

interface DiagramState {
  activeBoard: BoardMode
  boards: { hld: BoardSnapshot; lld: BoardSnapshot }

  /**
   * The active board's own id, minted locally by `emptyBoard()`.
   *
   * NOT the `diagrams.id` row id. For links and API calls use the route param
   * (see hooks/useDiagramRouteId) — building a URL from this field produces a
   * path that 404s.
   */
  diagramId: string
  diagramName: string
  nodes: ArchitectureNode[]
  edges: ArchitectureEdge[]
  viewport: Viewport

  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  clipboard: { nodes: ArchitectureNode[]; edges: ArchitectureEdge[] } | null

  snapToGrid: boolean
  gridSize: number
  showGrid: boolean

  setDiagramName: (name: string) => void
  setNodes: (nodes: ArchitectureNode[]) => void
  setEdges: (edges: ArchitectureEdge[]) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  addNode: (node: ArchitectureNode) => void
  updateNode: (id: string, data: Partial<ArchitectureNode['data']>) => void
  deleteNode: (id: string) => void
  deleteEdge: (id: string) => void
  updateEdge: (id: string, data: Partial<ArchitectureEdge['data']>) => void
  setSelectedNodeIds: (ids: string[]) => void
  setSelectedEdgeIds: (ids: string[]) => void
  setViewport: (viewport: Viewport) => void
  setSnapToGrid: (snap: boolean) => void
  setShowGrid: (show: boolean) => void
  copySelected: () => void
  pasteClipboard: () => void
  duplicateNodes: (ids: string[]) => void
  loadDiagram: (data: {
    id?: string
    name: string
    nodes: ArchitectureNode[]
    edges: ArchitectureEdge[]
    viewport?: Viewport
  }) => void
  clearDiagram: () => void
  selectAll: () => void
  deleteSelected: () => void
  switchBoard: (mode: BoardMode) => void
  hydrateBoards: (payload: {
    activeBoard: BoardMode
    boards: { hld: BoardSnapshot; lld: BoardSnapshot }
  }) => void
  getPersistPayload: () => {
    activeBoard: BoardMode
    boards: { hld: BoardSnapshot; lld: BoardSnapshot }
  }
}

const initialHld = emptyBoard('Untitled Diagram')
const initialLld = emptyBoard('Untitled LLD')

export const useDiagramStore = create<DiagramState>()(
  subscribeWithSelector((set, get) => ({
    activeBoard: 'hld',
    boards: { hld: initialHld, lld: initialLld },

    diagramId: initialHld.diagramId,
    diagramName: initialHld.diagramName,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedNodeIds: [],
    selectedEdgeIds: [],
    clipboard: null,
    snapToGrid: true,
    gridSize: 16,
    showGrid: true,

    setDiagramName: (name) => set({ diagramName: name }),

    setNodes: (nodes) => set({ nodes }),

    setEdges: (edges) => set({ edges }),

    onNodesChange: (changes) =>
      set((state) => ({
        nodes: applyNodeChanges(changes, state.nodes as Node[]) as ArchitectureNode[],
      })),

    onEdgesChange: (changes) =>
      set((state) => ({
        edges: applyEdgeChanges(changes, state.edges as Edge[]) as ArchitectureEdge[],
      })),

    onConnect: (connection) =>
      set((state) => {
        const isLld = state.activeBoard === 'lld'
        return {
          edges: addEdge(
            {
              ...connection,
              id: generateId(),
              type: 'architecture',
              data: isLld
                ? { relationKind: 'association', label: '' }
                : { connectionType: 'synchronous', protocol: 'HTTPS' },
            },
            state.edges as Edge[]
          ) as ArchitectureEdge[],
        }
      }),

    addNode: (node) =>
      set((state) => ({ nodes: [...state.nodes, node] })),

    updateNode: (id, data) =>
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, ...data } }
            : n
        ) as ArchitectureNode[],
      })),

    deleteNode: (id) =>
      set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== id),
        edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      })),

    deleteEdge: (id) =>
      set((state) => ({
        edges: state.edges.filter((e) => e.id !== id),
      })),

    updateEdge: (id, data) =>
      set((state) => ({
        edges: state.edges.map((e) =>
          e.id === id ? { ...e, data: { ...e.data, ...data } } : e
        ) as ArchitectureEdge[],
      })),

    setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),

    setSelectedEdgeIds: (ids) => set({ selectedEdgeIds: ids }),

    setViewport: (viewport) => set({ viewport }),

    setSnapToGrid: (snapToGrid) => set({ snapToGrid }),

    setShowGrid: (showGrid) => set({ showGrid }),

    copySelected: () => {
      const { nodes, edges, selectedNodeIds } = get()
      const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id))
      const selectedEdges = edges.filter(
        (e) =>
          selectedNodeIds.includes(e.source) &&
          selectedNodeIds.includes(e.target)
      )
      set({ clipboard: { nodes: selectedNodes, edges: selectedEdges } })
    },

    pasteClipboard: () => {
      const { clipboard } = get()
      if (!clipboard || clipboard.nodes.length === 0) return

      const idMap = new Map<string, string>()
      const offset = 40

      const newNodes: ArchitectureNode[] = clipboard.nodes.map((n) => {
        const newId = generateId()
        idMap.set(n.id, newId)
        return {
          ...n,
          id: newId,
          position: { x: n.position.x + offset, y: n.position.y + offset },
          selected: true,
        }
      })

      const newEdges: ArchitectureEdge[] = clipboard.edges.map((e) => ({
        ...e,
        id: generateId(),
        source: idMap.get(e.source) ?? e.source,
        target: idMap.get(e.target) ?? e.target,
      }))

      set((state) => ({
        nodes: [
          ...state.nodes.map((n) => ({ ...n, selected: false })),
          ...newNodes,
        ] as ArchitectureNode[],
        edges: [...state.edges, ...newEdges] as ArchitectureEdge[],
        selectedNodeIds: newNodes.map((n) => n.id),
      }))
    },

    duplicateNodes: (ids) => {
      const { nodes, edges } = get()
      const targetNodes = nodes.filter((n) => ids.includes(n.id))
      const idMap = new Map<string, string>()
      const offset = 40

      const newNodes: ArchitectureNode[] = targetNodes.map((n) => {
        const newId = generateId()
        idMap.set(n.id, newId)
        return {
          ...n,
          id: newId,
          position: { x: n.position.x + offset, y: n.position.y + offset },
          selected: true,
        }
      })

      const relevantEdges = edges.filter(
        (e) => ids.includes(e.source) && ids.includes(e.target)
      )
      const newEdges: ArchitectureEdge[] = relevantEdges.map((e) => ({
        ...e,
        id: generateId(),
        source: idMap.get(e.source) ?? e.source,
        target: idMap.get(e.target) ?? e.target,
      }))

      set((state) => ({
        nodes: [
          ...state.nodes.map((n) => ({ ...n, selected: false })),
          ...newNodes,
        ] as ArchitectureNode[],
        edges: [...state.edges, ...newEdges] as ArchitectureEdge[],
        selectedNodeIds: newNodes.map((n) => n.id),
      }))
    },

    loadDiagram: ({ id, name, nodes, edges, viewport }) =>
      set({
        diagramId: id ?? generateId(),
        diagramName: name,
        // Templates and imported JSON arrive here without passing through
        // migrateDocument, so normalise connectivity at this door too.
        nodes: normaliseNodesConnectable(nodes),
        edges,
        viewport: viewport ?? { x: 0, y: 0, zoom: 1 },
        selectedNodeIds: [],
        selectedEdgeIds: [],
      }),

    clearDiagram: () =>
      set({
        diagramId: generateId(),
        diagramName: get().activeBoard === 'lld' ? 'Untitled LLD' : 'Untitled Diagram',
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        selectedNodeIds: [],
        selectedEdgeIds: [],
      }),

    selectAll: () => {
      const { nodes, edges } = get()
      set({
        selectedNodeIds: nodes.map((n) => n.id),
        selectedEdgeIds: edges.map((e) => e.id),
        nodes: nodes.map((n) => ({ ...n, selected: true })) as ArchitectureNode[],
      })
    },

    deleteSelected: () => {
      const { selectedNodeIds, selectedEdgeIds } = get()
      set((state) => ({
        nodes: state.nodes.filter((n) => !selectedNodeIds.includes(n.id)),
        edges: state.edges.filter(
          (e) =>
            !selectedEdgeIds.includes(e.id) &&
            !selectedNodeIds.includes(e.source) &&
            !selectedNodeIds.includes(e.target)
        ),
        selectedNodeIds: [],
        selectedEdgeIds: [],
      }))
    },

    switchBoard: (mode) => {
      const state = get()
      if (mode === state.activeBoard) return

      const saved = snapshotFromState(state)
      const next = state.boards[mode]

      set({
        boards: { ...state.boards, [state.activeBoard]: saved },
        activeBoard: mode,
        diagramId: next.diagramId,
        diagramName: next.diagramName,
        nodes: normaliseNodesConnectable(next.nodes),
        edges: next.edges,
        viewport: next.viewport,
        selectedNodeIds: [],
        selectedEdgeIds: [],
      })
    },

    hydrateBoards: ({ activeBoard, boards }) => {
      const current = boards[activeBoard]
      set({
        activeBoard,
        boards,
        diagramId: current.diagramId,
        diagramName: current.diagramName,
        nodes: normaliseNodesConnectable(current.nodes),
        edges: current.edges,
        viewport: current.viewport,
        selectedNodeIds: [],
        selectedEdgeIds: [],
      })
    },

    getPersistPayload: () => {
      const state = get()
      const boards = {
        ...state.boards,
        [state.activeBoard]: snapshotFromState(state),
      }
      return { activeBoard: state.activeBoard, boards }
    },
  }))
)
