'use client'

import { useCallback } from 'react'
import { useReactFlow, getNodesBounds } from '@xyflow/react'
import { useDiagramStore } from '@/store/diagramStore'
import { exportCanvasForBounds, exportPNG, exportJSON } from '@/lib/export/exportDiagram'
import type { Diagram } from '@/types/diagram'

export function useExport() {
  const { getNodes } = useReactFlow()
  const { diagramId, diagramName, nodes, edges, viewport } = useDiagramStore()

  const getExportOptions = useCallback((diagramNameOverride?: string) => {
    const visible = getNodes().filter((node) => !node.hidden)
    if (visible.length === 0) {
      const empty = exportCanvasForBounds({ x: 0, y: 0, width: 1, height: 1 })
      return {
        nodesBounds: { x: 0, y: 0, width: 1, height: 1 },
        viewportTransform: empty.transform,
        diagramName: diagramNameOverride ?? diagramName,
      }
    }

    const bounds = getNodesBounds(visible)
    const canvas = exportCanvasForBounds(bounds)

    return {
      nodesBounds: bounds,
      viewportTransform: canvas.transform,
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
