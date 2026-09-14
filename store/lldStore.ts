'use client'

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  applyNodeChanges,
  applyEdgeChanges,
  type EdgeChange,
  type Edge,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import { generateId } from '@/lib/canvas/ids'
import { compactOrders } from '@/lib/lld/sequenceLayout'
import { LLD_DIAGRAM_SPECS } from '@/lib/lld/specs'
import { seedWorkspace } from '@/lib/lld/seed'
import {
  emptyDiagram,
  type LldEdgeKind,
  type ErNotationStyle,
  type LldDiagram,
  type LldDiagramSnapshot,
  type LldDiagramType,
  type LldEdge,
  type LldShape,
  type LldWorkspace,
} from '@/types/lld'
import type { Viewport } from '@/types/architecture'
import type { ArchitectureEdge, ArchitectureNode } from '@/types/diagram'

const MAX_HISTORY = 50

interface HistoryEntry {
  past: LldDiagramSnapshot[]
  future: LldDiagramSnapshot[]
}

const EMPTY_HISTORY: HistoryEntry = { past: [], future: [] }

export interface EnsureWorkspaceInput {
  /** STANDALONE_LLD_SCOPE for the navbar LLD board, or an HLD node id. */
  scopeId: string
  diagramId: string
  title: string
  /** Set only when attached to an HLD component. */
  component?: ArchitectureNode
  hldNodes?: ArchitectureNode[]
  hldEdges?: ArchitectureEdge[]
  /** Diagram type to start with when nothing is seeded. */
  defaultType?: LldDiagramType
}

interface LldState {
  workspaces: Record<string, LldWorkspace>
  /** Keyed `${scopeId}:${diagramId}` so undo never crosses diagrams. */
  history: Record<string, HistoryEntry>

  ensureWorkspace: (input: EnsureWorkspaceInput) => void
  setActiveDiagram: (scopeId: string, diagramId: string) => void
  addDiagram: (scopeId: string, type: LldDiagramType) => void
  /** Activate this type's diagram, creating it on first visit. */
  selectDiagramType: (scopeId: string, type: LldDiagramType) => void
  renameDiagram: (scopeId: string, diagramId: string, name: string) => void
  removeDiagram: (scopeId: string, diagramId: string) => void
  setErNotation: (scopeId: string, diagramId: string, notation: ErNotationStyle) => void
  setViewport: (scopeId: string, diagramId: string, viewport: Viewport) => void
  replaceWorkspace: (workspace: LldWorkspace) => void

  addShape: (scopeId: string, diagramId: string, shape: LldShape) => void
  updateShape: (
    scopeId: string,
    diagramId: string,
    shapeId: string,
    data: Partial<LldShape['data']>
  ) => void
  applyShapeChanges: (scopeId: string, diagramId: string, changes: NodeChange[]) => void
  removeShape: (scopeId: string, diagramId: string, shapeId: string) => void

  addEdge: (scopeId: string, diagramId: string, edge: LldEdge) => void
  updateEdge: (
    scopeId: string,
    diagramId: string,
    edgeId: string,
    data: Partial<LldEdge['data']>
  ) => void
  applyEdgeChangesFor: (scopeId: string, diagramId: string, changes: EdgeChange[]) => void
  removeEdge: (scopeId: string, diagramId: string, edgeId: string) => void
  setEdges: (scopeId: string, diagramId: string, edges: LldEdge[]) => void
  /** Bulk-load template content into the diagram of `type`, creating it if needed. */
  loadTemplate: (
    scopeId: string,
    type: LldDiagramType,
    name: string,
    snapshot: LldDiagramSnapshot
  ) => void

  /** Connector preset armed from the palette; used by the next drawn edge. */
  armedEdgeKind: LldEdgeKind | null
  setArmedEdgeKind: (kind: LldEdgeKind | null) => void

  pushHistory: (scopeId: string, diagramId: string) => void
  undo: (scopeId: string, diagramId: string) => void
  redo: (scopeId: string, diagramId: string) => void

  hydrate: (workspaces: Record<string, LldWorkspace>) => void
  getPersistPayload: () => Record<string, LldWorkspace>
  reset: () => void
}

function historyKey(scopeId: string, diagramId: string): string {
  return `${scopeId}:${diagramId}`
}

/**
 * Patch one diagram, preserving the object identity of every other diagram and
 * workspace.
 *
 * This is what makes selector-based reads cheap: a component subscribed to
 * diagram B holds the same reference after diagram A changes, so its selector
 * does not fire. The identity preservation and the selectors are a pair — break
 * one and the other stops working.
 */
function patchDiagram(
  workspaces: Record<string, LldWorkspace>,
  scopeId: string,
  diagramId: string,
  fn: (diagram: LldDiagram) => LldDiagram
): Record<string, LldWorkspace> | null {
  const ws = workspaces[scopeId]
  if (!ws) return null

  const index = ws.diagrams.findIndex((d) => d.id === diagramId)
  if (index === -1) return null

  const current = ws.diagrams[index]
  const next = fn(current)
  if (next === current) return null

  const diagrams = [...ws.diagrams]
  diagrams[index] = next

  return {
    ...workspaces,
    [scopeId]: { ...ws, diagrams, updatedAt: new Date().toISOString() },
  }
}

function patchWorkspace(
  workspaces: Record<string, LldWorkspace>,
  scopeId: string,
  fn: (ws: LldWorkspace) => LldWorkspace
): Record<string, LldWorkspace> | null {
  const ws = workspaces[scopeId]
  if (!ws) return null
  const next = fn(ws)
  if (next === ws) return null
  return { ...workspaces, [scopeId]: { ...next, updatedAt: new Date().toISOString() } }
}

export const useLldStore = create<LldState>()(
  subscribeWithSelector((set, get) => ({
    workspaces: {},
    history: {},
    armedEdgeKind: null,

    setArmedEdgeKind: (armedEdgeKind) => set({ armedEdgeKind }),

    ensureWorkspace: ({
      scopeId,
      diagramId,
      title,
      component,
      hldNodes,
      hldEdges,
      defaultType,
    }) => {
      const existing = get().workspaces[scopeId]
      if (existing) {
        // Never re-seed. Keep the label fresh in case the HLD node was renamed.
        if (existing.title !== title || existing.diagramId !== diagramId) {
          set((state) => ({
            workspaces: {
              ...state.workspaces,
              [scopeId]: { ...existing, title, diagramId },
            },
          }))
        }
        return
      }

      const seeded =
        component && hldNodes && hldEdges ? seedWorkspace(component, hldNodes, hldEdges) : []

      const fallbackType = defaultType ?? 'activity'
      const diagrams =
        seeded.length > 0
          ? seeded
          : [
              emptyDiagram(
                generateId(),
                fallbackType,
                LLD_DIAGRAM_SPECS[fallbackType].label
              ),
            ]

      const now = new Date().toISOString()
      set((state) => ({
        workspaces: {
          ...state.workspaces,
          [scopeId]: {
            id: generateId(),
            scopeId,
            // Present only when this workspace details an HLD component.
            componentId: component?.id,
            diagramId,
            title,
            diagrams,
            activeDiagramId: diagrams[0]?.id ?? null,
            createdAt: now,
            updatedAt: now,
          },
        },
      }))
    },

    setActiveDiagram: (scopeId, diagramId) =>
      set((state) => {
        const next = patchWorkspace(state.workspaces, scopeId, (ws) =>
          ws.activeDiagramId === diagramId ? ws : { ...ws, activeDiagramId: diagramId }
        )
        return next ? { workspaces: next } : {}
      }),

    addDiagram: (scopeId, type) =>
      set((state) => {
        const spec = LLD_DIAGRAM_SPECS[type]
        const ws = state.workspaces[scopeId]
        if (!ws) return {}

        const sameType = ws.diagrams.filter((d) => d.type === type).length
        const name = sameType === 0 ? spec.label : `${spec.label} ${sameType + 1}`
        const diagram = emptyDiagram(generateId(), type, name)

        return {
          workspaces: {
            ...state.workspaces,
            [scopeId]: {
              ...ws,
              diagrams: [...ws.diagrams, diagram],
              activeDiagramId: diagram.id,
              updatedAt: new Date().toISOString(),
            },
          },
        }
      }),

    // Category tabs show every diagram type whether or not it has content yet,
    // so the diagram is materialised on first visit rather than up front. That
    // keeps a fresh board from being pre-filled with seven empty diagrams.
    selectDiagramType: (scopeId, type) =>
      set((state) => {
        const ws = state.workspaces[scopeId]
        if (!ws) return {}

        const existing = ws.diagrams.find((d) => d.type === type)
        if (existing) {
          if (existing.id === ws.activeDiagramId) return {}
          return {
            workspaces: {
              ...state.workspaces,
              [scopeId]: { ...ws, activeDiagramId: existing.id },
            },
          }
        }

        const diagram = emptyDiagram(generateId(), type, LLD_DIAGRAM_SPECS[type].label)
        return {
          workspaces: {
            ...state.workspaces,
            [scopeId]: {
              ...ws,
              diagrams: [...ws.diagrams, diagram],
              activeDiagramId: diagram.id,
              updatedAt: new Date().toISOString(),
            },
          },
        }
      }),

    renameDiagram: (scopeId, diagramId, name) =>
      set((state) => {
        const next = patchDiagram(state.workspaces, scopeId, diagramId, (d) =>
          d.name === name ? d : { ...d, name }
        )
        return next ? { workspaces: next } : {}
      }),

    removeDiagram: (scopeId, diagramId) =>
      set((state) => {
        const ws = state.workspaces[scopeId]
        if (!ws) return {}

        const diagrams = ws.diagrams.filter((d) => d.id !== diagramId)
        const activeDiagramId =
          ws.activeDiagramId === diagramId ? (diagrams[0]?.id ?? null) : ws.activeDiagramId

        const history = { ...state.history }
        delete history[historyKey(scopeId, diagramId)]

        return {
          history,
          workspaces: {
            ...state.workspaces,
            [scopeId]: {
              ...ws,
              diagrams,
              activeDiagramId,
              updatedAt: new Date().toISOString(),
            },
          },
        }
      }),

    setErNotation: (scopeId, diagramId, erNotation) =>
      set((state) => {
        const next = patchDiagram(state.workspaces, scopeId, diagramId, (d) =>
          d.erNotation === erNotation ? d : { ...d, erNotation }
        )
        return next ? { workspaces: next } : {}
      }),

    setViewport: (scopeId, diagramId, viewport) =>
      set((state) => {
        const next = patchDiagram(state.workspaces, scopeId, diagramId, (d) => ({
          ...d,
          viewport,
        }))
        return next ? { workspaces: next } : {}
      }),

    replaceWorkspace: (workspace) =>
      set((state) => ({
        workspaces: { ...state.workspaces, [workspace.scopeId]: workspace },
      })),

    // ── shapes ────────────────────────────────────────────────────────────────

    addShape: (scopeId, diagramId, shape) =>
      set((state) => {
        const next = patchDiagram(state.workspaces, scopeId, diagramId, (d) => ({
          ...d,
          shapes: [...d.shapes, shape],
        }))
        return next ? { workspaces: next } : {}
      }),

    updateShape: (scopeId, diagramId, shapeId, data) =>
      set((state) => {
        const next = patchDiagram(state.workspaces, scopeId, diagramId, (d) => ({
          ...d,
          shapes: d.shapes.map((s) =>
            s.id === shapeId ? ({ ...s, data: { ...s.data, ...data } } as LldShape) : s
          ),
        }))
        return next ? { workspaces: next } : {}
      }),

    applyShapeChanges: (scopeId, diagramId, changes) =>
      set((state) => {
        const next = patchDiagram(state.workspaces, scopeId, diagramId, (d) => ({
          ...d,
          // React Flow's helpers do not preserve our node union, so the cast at
          // this boundary is the established pattern (see diagramStore).
          shapes: applyNodeChanges(changes, d.shapes as Node[]) as LldShape[],
        }))
        return next ? { workspaces: next } : {}
      }),

    removeShape: (scopeId, diagramId, shapeId) =>
      set((state) => {
        const next = patchDiagram(state.workspaces, scopeId, diagramId, (d) => {
          const edges = d.edges.filter((e) => e.source !== shapeId && e.target !== shapeId)
          return {
            ...d,
            shapes: d.shapes.filter((s) => s.id !== shapeId),
            edges: d.type === 'sequence' ? (compactOrders(edges) as LldEdge[]) : edges,
          }
        })
        return next ? { workspaces: next } : {}
      }),

    // ── edges ─────────────────────────────────────────────────────────────────

    addEdge: (scopeId, diagramId, edge) =>
      set((state) => {
        const next = patchDiagram(state.workspaces, scopeId, diagramId, (d) => ({
          ...d,
          edges: [...d.edges, edge],
        }))
        return next ? { workspaces: next } : {}
      }),

    updateEdge: (scopeId, diagramId, edgeId, data) =>
      set((state) => {
        const next = patchDiagram(state.workspaces, scopeId, diagramId, (d) => ({
          ...d,
          edges: d.edges.map((e) =>
            e.id === edgeId ? ({ ...e, data: { ...e.data, ...data } } as LldEdge) : e
          ),
        }))
        return next ? { workspaces: next } : {}
      }),

    applyEdgeChangesFor: (scopeId, diagramId, changes) =>
      set((state) => {
        const next = patchDiagram(state.workspaces, scopeId, diagramId, (d) => ({
          ...d,
          edges: applyEdgeChanges(changes, d.edges as Edge[]) as LldEdge[],
        }))
        return next ? { workspaces: next } : {}
      }),

    removeEdge: (scopeId, diagramId, edgeId) =>
      set((state) => {
        const next = patchDiagram(state.workspaces, scopeId, diagramId, (d) => {
          const edges = d.edges.filter((e) => e.id !== edgeId)
          return {
            ...d,
            edges: d.type === 'sequence' ? (compactOrders(edges) as LldEdge[]) : edges,
          }
        })
        return next ? { workspaces: next } : {}
      }),

    setEdges: (scopeId, diagramId, edges) =>
      set((state) => {
        const next = patchDiagram(state.workspaces, scopeId, diagramId, (d) => ({
          ...d,
          edges,
        }))
        return next ? { workspaces: next } : {}
      }),

    /**
     * Replace a diagram of `type` with template content, creating it if absent.
     *
     * Templates need a bulk door: the alternative is a loop of `addShape` followed by
     * `setEdges`, which writes a store update per shape and leaves the diagram briefly
     * holding edges whose endpoints do not exist yet.
     *
     * Selects the diagram it wrote to, since a starter the user cannot see is the bug this
     * replaced.
     */
    loadTemplate: (scopeId, type, name, snapshot) =>
      set((state) => {
        const ws = state.workspaces[scopeId]
        if (!ws) return {}

        const existing = ws.diagrams.find((d) => d.type === type)
        const target: LldDiagram = {
          ...(existing ?? emptyDiagram(generateId(), type, name)),
          name,
          shapes: snapshot.shapes,
          edges: snapshot.edges,
          // Content arrives laid out, so start where it is rather than wherever the user
          // last panned an empty canvas.
          viewport: { x: 0, y: 0, zoom: 1 },
        }

        const diagrams = existing
          ? ws.diagrams.map((d) => (d.id === target.id ? target : d))
          : [...ws.diagrams, target]

        return {
          workspaces: {
            ...state.workspaces,
            [scopeId]: {
              ...ws,
              diagrams,
              activeDiagramId: target.id,
              updatedAt: new Date().toISOString(),
            },
          },
        }
      }),

    // ── history (scoped per diagram) ──────────────────────────────────────────

    pushHistory: (scopeId, diagramId) =>
      set((state) => {
        const ws = state.workspaces[scopeId]
        const diagram = ws?.diagrams.find((d) => d.id === diagramId)
        if (!diagram) return {}

        const key = historyKey(scopeId, diagramId)
        const entry = state.history[key] ?? EMPTY_HISTORY

        return {
          history: {
            ...state.history,
            [key]: {
              past: [...entry.past, { shapes: diagram.shapes, edges: diagram.edges }].slice(
                -MAX_HISTORY
              ),
              future: [],
            },
          },
        }
      }),

    undo: (scopeId, diagramId) =>
      set((state) => {
        const key = historyKey(scopeId, diagramId)
        const entry = state.history[key]
        if (!entry || entry.past.length === 0) return {}

        const ws = state.workspaces[scopeId]
        const diagram = ws?.diagrams.find((d) => d.id === diagramId)
        if (!diagram) return {}

        const snapshot = entry.past[entry.past.length - 1]
        const workspaces = patchDiagram(state.workspaces, scopeId, diagramId, (d) => ({
          ...d,
          shapes: snapshot.shapes,
          edges: snapshot.edges,
        }))

        return {
          workspaces: workspaces ?? state.workspaces,
          history: {
            ...state.history,
            [key]: {
              past: entry.past.slice(0, -1),
              future: [
                { shapes: diagram.shapes, edges: diagram.edges },
                ...entry.future,
              ].slice(0, MAX_HISTORY),
            },
          },
        }
      }),

    redo: (scopeId, diagramId) =>
      set((state) => {
        const key = historyKey(scopeId, diagramId)
        const entry = state.history[key]
        if (!entry || entry.future.length === 0) return {}

        const ws = state.workspaces[scopeId]
        const diagram = ws?.diagrams.find((d) => d.id === diagramId)
        if (!diagram) return {}

        const [snapshot, ...future] = entry.future
        const workspaces = patchDiagram(state.workspaces, scopeId, diagramId, (d) => ({
          ...d,
          shapes: snapshot.shapes,
          edges: snapshot.edges,
        }))

        return {
          workspaces: workspaces ?? state.workspaces,
          history: {
            ...state.history,
            [key]: {
              past: [...entry.past, { shapes: diagram.shapes, edges: diagram.edges }].slice(
                -MAX_HISTORY
              ),
              future,
            },
          },
        }
      }),

    // ── persistence ───────────────────────────────────────────────────────────

    hydrate: (workspaces) => set({ workspaces, history: {} }),

    getPersistPayload: () => get().workspaces,

    reset: () => set({ workspaces: {}, history: {} }),
  }))
)

// ─── selectors ───────────────────────────────────────────────────────────────
// Deliberately selector-based rather than the repo's usual bare-destructure
// habit: requirement R6.3 demands that editing one diagram not re-render
// components bound to another.

export function useLldWorkspaceFor(scopeId: string): LldWorkspace | undefined {
  return useLldStore((s) => s.workspaces[scopeId])
}

export function useLldDiagram(
  scopeId: string,
  diagramId: string | null
): LldDiagram | undefined {
  return useLldStore((s) =>
    diagramId ? s.workspaces[scopeId]?.diagrams.find((d) => d.id === diagramId) : undefined
  )
}

export function useLldHistoryFlags(scopeId: string, diagramId: string | null) {
  const canUndo = useLldStore((s) =>
    diagramId ? (s.history[historyKey(scopeId, diagramId)]?.past.length ?? 0) > 0 : false
  )
  const canRedo = useLldStore((s) =>
    diagramId ? (s.history[historyKey(scopeId, diagramId)]?.future.length ?? 0) > 0 : false
  )
  return { canUndo, canRedo }
}
