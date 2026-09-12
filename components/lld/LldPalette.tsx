'use client'

import { useMemo, useState } from 'react'
import { Clock, Search } from 'lucide-react'
import { getSpec, paletteShapesFor, searchPalette } from '@/lib/lld/specs'
import { spawnShape } from '@/lib/lld/spawnShape'
import { LIFELINE_TOP } from '@/lib/lld/sequenceLayout'
import { EDGE_KIND_LABEL } from '@/lib/canvas/notation'
import { useLldStore } from '@/store/lldStore'
import { useUiStore } from '@/store/uiStore'
import LldPaletteItem from './LldPaletteItem'
import { LldConnectorPreview } from './LldConnectorPreview'
import {
  isConnectorEntry,
  isShapeEntry,
  type LldConnectorEntry,
  type LldDiagram,
  type LldPaletteEntry,
  type LldShapeEntry,
} from '@/types/lld'

/**
 * Palette for the active diagram type.
 *
 * Reads spec.paletteGroups, so it shows only shapes valid for this diagram —
 * class boxes never leak into the sequence palette. Connector groups render as a
 * notation legend whose entries arm the next connection you draw.
 */
export default function LldPalette({
  scopeId,
  diagram,
}: {
  scopeId: string
  diagram: LldDiagram
}) {
  const spec = getSpec(diagram.type)
  const [query, setQuery] = useState('')

  const addShape = useLldStore((s) => s.addShape)
  const pushHistory = useLldStore((s) => s.pushHistory)
  const armedEdgeKind = useLldStore((s) => s.armedEdgeKind)
  const setArmedEdgeKind = useLldStore((s) => s.setArmedEdgeKind)
  const recentlyUsed = useUiStore((s) => s.recentlyUsed)
  const addRecentlyUsed = useUiStore((s) => s.addRecentlyUsed)

  const searchResults = useMemo(() => searchPalette(diagram.type, query), [diagram.type, query])

  const recentItems = useMemo(() => {
    const all = paletteShapesFor(diagram.type)
    return recentlyUsed
      .map((id) => all.find((i) => i.id === id))
      .filter((i): i is LldShapeEntry => Boolean(i))
      .slice(0, 4)
  }, [recentlyUsed, diagram.type])

  const addToCanvas = (entry: LldShapeEntry) => {
    const offset = diagram.shapes.length * 24
    const position =
      entry.spawn.shape === 'lldLifeline'
        ? { x: 240 + (offset % 600), y: LIFELINE_TOP }
        : { x: 360 + (offset % 220), y: 220 + (offset % 180) }

    // Snapshot on click-add too. The HLD click-add path omits this, which
    // silently makes click-added nodes non-undoable while dragged ones are.
    pushHistory(scopeId, diagram.id)
    addShape(scopeId, diagram.id, spawnShape(entry.spawn, position))
    addRecentlyUsed(entry.id)
  }

  const renderEntry = (entry: LldPaletteEntry) =>
    isShapeEntry(entry) ? (
      <LldPaletteItem key={entry.id} entry={entry} onAdd={addToCanvas} />
    ) : (
      <ConnectorRow
        key={entry.id}
        entry={entry}
        armed={armedEdgeKind === entry.edgeKind}
        onArm={() => setArmedEdgeKind(armedEdgeKind === entry.edgeKind ? null : entry.edgeKind)}
      />
    )

  return (
    <div className="flex h-full flex-col bg-slate-50/80">
      <div className="border-b border-slate-200/80 bg-white px-3 pb-2.5 pt-3">
        <p className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {spec.label} library
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search shapes…"
            value={query}
            aria-label="Search shapes"
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {searchResults ? (
          searchResults.length > 0 ? (
            <Group label={`${searchResults.length} result${searchResults.length === 1 ? '' : 's'}`}>
              {searchResults.filter(isShapeEntry).map(renderEntry)}
              {searchResults.filter(isConnectorEntry).map(renderEntry)}
            </Group>
          ) : (
            <p className="px-1 pt-4 text-center text-xs text-slate-400">
              No shapes match “{query}”
            </p>
          )
        ) : (
          <>
            {recentItems.length > 0 && (
              <Group label="Recently used" icon={<Clock className="h-3 w-3 opacity-60" />}>
                {recentItems.map((entry) => (
                  <LldPaletteItem key={`recent-${entry.id}`} entry={entry} onAdd={addToCanvas} />
                ))}
              </Group>
            )}

            {spec.paletteGroups.map((group) => {
              const connectors = group.entries.every(isConnectorEntry)
              return (
                <div key={group.id}>
                  <p className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {group.label}
                  </p>
                  {connectors ? (
                    <div className="space-y-1">{group.entries.map(renderEntry)}</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">{group.entries.map(renderEntry)}</div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      <div className="border-t border-slate-200/80 bg-white px-3 py-2">
        <p className="text-[10px] leading-relaxed text-slate-400">
          {armedEdgeKind
            ? `Drawing ${EDGE_KIND_LABEL[armedEdgeKind]} — drag between two shapes.`
            : 'Drag a shape onto the canvas, or click to place. Double-click to edit.'}
        </p>
      </div>
    </div>
  )
}

function Group({
  label,
  icon,
  children,
}: {
  label: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {icon}
        {label}
      </p>
      <div className="grid grid-cols-2 gap-1.5">{children}</div>
    </div>
  )
}

/** A connector preset: shows the real line, arms it for the next drag. */
function ConnectorRow({
  entry,
  armed,
  onArm,
}: {
  entry: LldConnectorEntry
  armed: boolean
  onArm: () => void
}) {
  return (
    <button
      type="button"
      onClick={onArm}
      aria-pressed={armed}
      title={`${entry.name} — ${entry.description}`}
      className={[
        'flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-all',
        armed
          ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200'
          : 'border-slate-200/90 bg-white hover:border-slate-300',
      ].join(' ')}
    >
      <span className="flex h-5 w-14 shrink-0 items-center justify-center">
        <LldConnectorPreview edgeKind={entry.edgeKind} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={[
            'block truncate text-[11px] font-medium',
            armed ? 'text-blue-700' : 'text-slate-700',
          ].join(' ')}
        >
          {entry.name}
        </span>
      </span>
    </button>
  )
}
