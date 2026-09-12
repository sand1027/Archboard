'use client'

import { useRef, useState } from 'react'
import { Check, Copy, Download, Share, Upload } from 'lucide-react'
import { downloadBlob, safeName } from '@/lib/export/exportDiagram'
import { workspaceFromJson, workspaceToJson } from '@/lib/export/lld/workspaceJson'
import { getSpec } from '@/lib/lld/specs'
import { useLldStore } from '@/store/lldStore'
import type { LldDiagram, LldWorkspace } from '@/types/lld'

const MIME: Record<string, string> = {
  mmd: 'text/plain',
  puml: 'text/plain',
  sql: 'application/sql',
  json: 'application/json',
}

/**
 * Export menu scoped to the active diagram type — only that type's serializers
 * appear, plus the workspace-level JSON round-trip.
 */
export default function LldExportMenu({
  workspace,
  diagram,
}: {
  workspace: LldWorkspace
  diagram: LldDiagram
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const replaceWorkspace = useLldStore((s) => s.replaceWorkspace)
  const spec = getSpec(diagram.type)

  const ctx = { diagramName: diagram.name, title: workspace.title }

  const download = (text: string, extension: string) => {
    const blob = new Blob([text], { type: MIME[extension] ?? 'text/plain' })
    downloadBlob(blob, `${safeName(workspace.title)}-${safeName(diagram.name)}.${extension}`)
    setOpen(false)
  }

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      setError('Clipboard unavailable — use Download instead.')
      setTimeout(() => setError(null), 3000)
    }
  }

  const handleImport = async (file: File) => {
    const parsed = workspaceFromJson(await file.text())
    if (!parsed) {
      // Validation happens before anything is applied, so existing work is safe.
      setError('That file is not a valid Archboard LLD workspace.')
      setTimeout(() => setError(null), 4000)
      return
    }
    replaceWorkspace({ ...parsed, componentId: workspace.componentId, diagramId: workspace.diagramId })
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
      >
        <Share className="h-3.5 w-3.5" />
        Export
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-20 mt-1 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {spec.label} diagram
            </p>

            {spec.exporters.length === 0 && (
              <p className="px-3 pb-2 text-[11px] text-slate-400">
                No text format for this diagram type yet — use the workspace JSON below.
              </p>
            )}

            {spec.exporters.map((exporter) => {
              const serialize = () => exporter.serialize(diagram, ctx)
              return (
                <div key={exporter.id} className="flex items-start gap-1 px-1">
                  <button
                    type="button"
                    onClick={() => download(serialize(), exporter.extension)}
                    className="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-50"
                  >
                    <Download className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800">
                        {exporter.label}
                      </span>
                      <span className="block text-[11px] leading-snug text-slate-500">
                        {exporter.description}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(serialize(), exporter.id)}
                    aria-label={`Copy ${exporter.label}`}
                    title="Copy to clipboard"
                    className="mt-1.5 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    {copied === exporter.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              )
            })}

            <div className="my-1 border-t border-slate-100" />
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Whole workspace
            </p>

            <button
              type="button"
              onClick={() => {
                const blob = new Blob([workspaceToJson(workspace)], { type: 'application/json' })
                downloadBlob(blob, `${safeName(workspace.title)}-lld.json`)
                setOpen(false)
              }}
              className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50"
            >
              <Download className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>
                <span className="block text-sm font-medium text-slate-800">JSON backup</span>
                <span className="block text-[11px] leading-snug text-slate-500">
                  All {workspace.diagrams.length} diagram
                  {workspace.diagrams.length === 1 ? '' : 's'}, re-importable
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50"
            >
              <Upload className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>
                <span className="block text-sm font-medium text-slate-800">Import JSON</span>
                <span className="block text-[11px] leading-snug text-slate-500">
                  Replaces every diagram in this workspace
                </span>
              </span>
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleImport(file)
                e.target.value = ''
              }}
            />

            {error && (
              <p role="alert" className="px-3 py-2 text-[11px] leading-snug text-red-600">
                {error}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
