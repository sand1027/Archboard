'use client'

import { useCallback, useRef, useState } from 'react'
import { X, FileJson, Image, FileCode, Upload } from 'lucide-react'
import { useUiStore } from '@/store/uiStore'
import { useDiagramStore } from '@/store/diagramStore'
import { exportJSON, exportSVG, exportPNG, importJSON } from '@/lib/export/exportDiagram'
import type { Diagram } from '@/types/diagram'

export default function ExportModal() {
  const { exportModalOpen, setExportModalOpen } = useUiStore()
  const { diagramId, diagramName, nodes, edges, viewport, loadDiagram } = useDiagramStore()
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const getDiagram = (): Diagram => ({
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
  })

  const handleExportJSON = useCallback(() => {
    exportJSON(getDiagram())
    setExportModalOpen(false)
  }, [diagramId, diagramName, nodes, edges, viewport])

  const handleExportSVG = useCallback(async () => {
    await exportSVG(diagramName)
    setExportModalOpen(false)
  }, [diagramName])

  const handleExportPNG = useCallback(async () => {
    await exportPNG(diagramName)
    setExportModalOpen(false)
  }, [diagramName])

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const diagram = importJSON(text)
      if (diagram) {
        loadDiagram({
          id: diagram.id,
          name: diagram.name,
          nodes: diagram.nodes,
          edges: diagram.edges,
          viewport: diagram.viewport,
        })
        setExportModalOpen(false)
      } else {
        alert('Invalid diagram file')
      }
      setImporting(false)
    }
    reader.readAsText(file)
  }, [loadDiagram, setExportModalOpen])

  if (!exportModalOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => setExportModalOpen(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-[480px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Export / Import</h2>
          <button onClick={() => setExportModalOpen(false)} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Export options */}
        <div className="p-6 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Export As</p>

          <ExportOption
            icon={<FileJson className="w-5 h-5" />}
            title="JSON"
            description="Export full diagram data — can be re-imported"
            color="bg-blue-50 text-blue-600"
            onClick={handleExportJSON}
          />
          <ExportOption
            icon={<FileCode className="w-5 h-5" />}
            title="SVG"
            description="Vector graphic — scales to any size"
            color="bg-purple-50 text-purple-600"
            onClick={handleExportSVG}
          />
          <ExportOption
            icon={<Image className="w-5 h-5" />}
            title="PNG"
            description="Raster image at 2x resolution"
            color="bg-green-50 text-green-600"
            onClick={handleExportPNG}
          />

          <div className="border-t border-gray-100 pt-3 mt-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Import</p>
            <ExportOption
              icon={<Upload className="w-5 h-5" />}
              title="Import JSON"
              description="Restore a previously exported diagram"
              color="bg-gray-100 text-gray-600"
              onClick={() => fileRef.current?.click()}
            />
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ExportOption({
  icon, title, description, color, onClick
}: {
  icon: React.ReactNode
  title: string
  description: string
  color: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-gray-300
        hover:shadow-sm transition-all text-left group"
    >
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800 group-hover:text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </button>
  )
}
