'use client'

import { useState, useEffect, useTransition } from 'react'
import { X, Clock, RotateCcw, Loader2, Save, FileText } from 'lucide-react'
import { useDiagramStore } from '@/store/diagramStore'
import { useHistoryStore } from '@/store/historyStore'
import type { DiagramVersionRow } from '@/lib/supabase/types'

interface Props {
  diagramId: string
  onClose: () => void
  onSaveVersion: (name: string) => Promise<boolean>
}

type VersionSummary = Pick<DiagramVersionRow, 'id' | 'version' | 'name' | 'thumbnail_url' | 'created_at'>

export default function HistorySidebar({ diagramId, onClose, onSaveVersion }: Props) {
  const [versions, setVersions] = useState<VersionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isPending, startTransition] = useTransition()
  const diagramName = useDiagramStore((s) => s.diagramName)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/diagrams/${diagramId}/versions`)
      .then((r) => r.json())
      .then(({ versions }) => {
        if (!cancelled) {
          setVersions(versions ?? [])
          setLoading(false)
        }
      })
      .catch(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [diagramId])

  const handleSave = async () => {
    setSaving(true)
    // Auto-generate: "Scale User — Version 3"
    const nextNum = versions.length + 1
    const autoName = `${diagramName} — Version ${nextNum}`
    const ok = await onSaveVersion(autoName)
    if (ok) {
      const res = await fetch(`/api/diagrams/${diagramId}/versions`)
      const { versions: updated } = await res.json()
      setVersions(updated ?? [])
    }
    setSaving(false)
  }

  const handleRestore = (version: VersionSummary) => {
    startTransition(async () => {
      const res = await fetch(
        `/api/diagrams/${diagramId}/versions?version_id=${version.id}`,
        { method: 'PUT' }
      )
      const { version: full } = await res.json()
      if (!full?.data) return

      // Push current state to undo history before restoring
      const { nodes: n, edges: e } = useDiagramStore.getState()
      useHistoryStore.getState().pushSnapshot({ nodes: n, edges: e })

      // Restore
      const data = full.data as any
      const activeBoard = data.activeBoard ?? 'hld'
      const boards = data.boards ?? {}
      if (boards.hld || boards.lld) {
        useDiagramStore.getState().hydrateBoards({ activeBoard, boards })
      } else if (data.nodes && data.edges) {
        useDiagramStore.getState().loadDiagram({
          id: diagramId,
          name: version.name,
          nodes: data.nodes,
          edges: data.edges,
          viewport: data.viewport,
        })
      }
    })
  }

  return (
    <div className="flex flex-col h-full w-72 bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800">Version History</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Save new version */}
      <div className="p-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-gray-600">Save checkpoint</p>
          <span className="text-[10px] text-gray-400">
            Next: v{versions.length + 1}
          </span>
        </div>
        <p className="text-[11px] text-gray-400 mb-2 truncate">
          &ldquo;{diagramName} — Version {versions.length + 1}&rdquo;
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save version
        </button>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <FileText className="w-7 h-7 text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No saved versions yet</p>
            <p className="text-xs text-gray-300 mt-1">Save a version above to create a checkpoint</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {versions.map((v) => (
              <li key={v.id} className="p-3 hover:bg-gray-50 group transition-colors">
                <div className="flex items-start gap-2">
                  {/* Thumbnail */}
                  <div className="w-14 h-9 rounded-md bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200">
                    {v.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="w-4 h-4 text-gray-300" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        v{v.version}
                      </span>
                      <span className="text-xs font-medium text-gray-800 truncate">
                        {/* Show just the suffix after "—" if it follows our naming pattern */}
                        {v.name.includes(' — ') ? v.name.split(' — ').slice(1).join(' — ') : v.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400">
                      {formatDate(new Date(v.created_at))}
                    </p>
                  </div>

                  <button
                    onClick={() => handleRestore(v)}
                    disabled={isPending}
                    title="Restore this version"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
