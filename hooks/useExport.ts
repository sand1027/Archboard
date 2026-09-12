'use client'

import { useCallback } from 'react'
import { useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react'
import { useDiagramStore } from '@/store/diagramStore'
import { exportPNG, exportJSON } from '@/lib/export/exportDiagram'
import type { Diagram } from '@/types/diagram'

const PADDING = 40

export function useExport() {
  const { getNodes } = useReactFlow()
  const { diagramId, diagramName, nodes, edges, viewport } = useDiagramStore()

  const getExportOptions = useCallback((diagramNameOverride?: string) => {
    const allNodes = getNodes()
    if (allNodes.length === 0) {
      // No nodes — use a default 1200×800 canvas centred at origin
      return {
        nodesBounds: { x: 0, y: 0, width: 1200, height: 800 },
        viewportTransform: 'translate(0, 0) scale(1)',
        diagramName: diagramNameOverride ?? diagramName,
      }
    }

    const bounds = getNodesBounds(allNodes)
    const imageW = Math.max(1200, bounds.width  + PADDING * 2)
    const imageH = Math.max(800,  bounds.height + PADDING * 2)

    // Get the transform that fits the diagram into our export canvas
    const vp = getViewportForBounds(bounds, imageW, imageH, 0.5, 2, PADDING)

    // Convert to CSS transform string
    const transform = `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`

    return {
      nodesBounds: bounds,
      viewportTransform: transform,
      diagramName: diagramNameOverride ?? diagramName,
    }
  }, [getNodes, diagramName])

  const handleExportPNG = useCallback(async () => {
    const opts = getExportOptions()
    await exportPNG(opts)
  }, [getExportOptions])

  const handleExportJSON = useCallback(() => {
    const diagram: Diagram = {
      id: diagramId,
      name: diagramName,
      version: 1,
      nodes,
      edges,
      viewport,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }
    exportJSON(diagram)
  }, [diagramId, diagramName, nodes, edges, viewport])

  return { handleExportPNG, handleExportJSON }
}
