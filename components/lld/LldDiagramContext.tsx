'use client'

import { createContext, useContext, useMemo } from 'react'
import { useLldStore } from '@/store/lldStore'
import type { ErNotationStyle, LldDiagramType, LldEdge, LldShape } from '@/types/lld'

/**
 * Scope for the active diagram.
 *
 * Node components receive `id` and `data` from React Flow but need to know
 * which diagram they belong to in order to mutate the store. Passing that
 * through nodeTypes is not possible, so it comes from context — the same reason
 * the legacy nodes reach for useDiagramStore() directly.
 */
interface LldDiagramScope {
  scopeId: string
  diagramId: string
  diagramType: LldDiagramType
  /** Diagram-level notation choice, read by the ER edge renderer. */
  erNotation: ErNotationStyle
}

const LldDiagramContext = createContext<LldDiagramScope | null>(null)

export function LldDiagramProvider({
  scopeId,
  diagramId,
  diagramType,
  erNotation,
  children,
}: LldDiagramScope & { children: React.ReactNode }) {
  const value = useMemo(
    () => ({ scopeId, diagramId, diagramType, erNotation }),
    [scopeId, diagramId, diagramType, erNotation]
  )
  return <LldDiagramContext.Provider value={value}>{children}</LldDiagramContext.Provider>
}

export function useLldScope(): LldDiagramScope {
  const ctx = useContext(LldDiagramContext)
  if (!ctx) throw new Error('useLldScope must be used inside <LldDiagramProvider>')
  return ctx
}

/** Store actions pre-bound to the active diagram. */
export function useLldActions() {
  const { scopeId, diagramId } = useLldScope()

  const updateShape = useLldStore((s) => s.updateShape)
  const removeShape = useLldStore((s) => s.removeShape)
  const addShape = useLldStore((s) => s.addShape)
  const updateEdge = useLldStore((s) => s.updateEdge)
  const removeEdge = useLldStore((s) => s.removeEdge)
  const addEdge = useLldStore((s) => s.addEdge)
  const setEdges = useLldStore((s) => s.setEdges)
  const pushHistory = useLldStore((s) => s.pushHistory)

  return useMemo(
    () => ({
      scopeId,
      diagramId,
      snapshot: () => pushHistory(scopeId, diagramId),
      addShape: (shape: LldShape) => addShape(scopeId, diagramId, shape),
      updateShape: (shapeId: string, data: Partial<LldShape['data']>) =>
        updateShape(scopeId, diagramId, shapeId, data),
      removeShape: (shapeId: string) => removeShape(scopeId, diagramId, shapeId),
      addEdge: (edge: LldEdge) => addEdge(scopeId, diagramId, edge),
      updateEdge: (edgeId: string, data: Partial<LldEdge['data']>) =>
        updateEdge(scopeId, diagramId, edgeId, data),
      removeEdge: (edgeId: string) => removeEdge(scopeId, diagramId, edgeId),
      setEdges: (edges: LldEdge[]) => setEdges(scopeId, diagramId, edges),
    }),
    [
      scopeId,
      diagramId,
      addShape,
      updateShape,
      removeShape,
      addEdge,
      updateEdge,
      removeEdge,
      setEdges,
      pushHistory,
    ]
  )
}
