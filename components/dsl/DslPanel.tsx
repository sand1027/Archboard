'use client'

import { useCallback, useMemo } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Code2,
  FileDown,
  PinOff,
  Sparkles,
  XCircle,
} from 'lucide-react'
import CodeEditor from './CodeEditor'
import { print } from '@/lib/dsl/print'
import type { Point } from '@/lib/canvas/autoLayout'
import { useDiagramStore } from '@/store/diagramStore'
import { useDslStore } from '@/store/dslStore'
import { useEstimateStore } from '@/store/estimateStore'
import { useUiStore } from '@/store/uiStore'
import type { Diagnostic } from '@/types/dsl'

const STARTER = `# Describe the system. The diagram draws itself.
diagram "My Architecture" {
  workload {
    dau 10M
    perUser 20
    peak 3x
    reads 9:1
  }

  group client "Clients" {
    web-browser web "Web"
    mobile-app mobile "Mobile"
  }

  load-balancer lb "Load Balancer" { instances 2, type m5.large }

  group dc "Data Center" : data-center {
    server api "API" { instances 4, type m5.large, service 25ms }
    redis cache "Cache" { type r5.large }
    postgresql db "Database" { connectionPool 20, multiAz }
  }

  web    -> lb
  mobile -> lb
  lb     -> api
  api    -> cache
  api    -> db

  # Annotations are shapes. Anything you draw on the canvas by hand is kept too.
  shape todo "Add a rate limiter before launch" : note
}
`

/**
 * The code pane.
 *
 * Text is the authority while this is open: the canvas is a rendering of the source, so the
 * only thing a drag changes is a pin. The one exception is the "from canvas" button, which
 * runs the printer to seed the source from a diagram that was drawn — the migration path, so
 * the editor is not a second empty world you have to start over in.
 */
export default function DslPanel() {
  const source = useDslStore((s) => s.source)
  const diagnostics = useDslStore((s) => s.diagnostics)
  const direction = useDslStore((s) => s.direction)
  const pins = useDslStore((s) => s.pins)
  const setSource = useDslStore((s) => s.setSource)
  const setDirection = useDslStore((s) => s.setDirection)
  const clearPins = useDslStore((s) => s.clearPins)
  const setPins = useDslStore((s) => s.setPins)

  const setCodeOpen = useUiStore((s) => s.setCodeOpen)

  const errors = useMemo(() => diagnostics.filter((d) => d.severity === 'error'), [diagnostics])
  const warnings = useMemo(
    () => diagnostics.filter((d) => d.severity === 'warning'),
    [diagnostics]
  )
  const pinCount = Object.keys(pins).length

  /** Seed the source from whatever is on the canvas. */
  const importFromCanvas = useCallback(() => {
    const { nodes, edges, diagramName } = useDiagramStore.getState()
    const { inputs } = useEstimateStore.getState()

    const result = print({ nodes, edges }, { name: diagramName, workload: inputs })

    // Every position the canvas already has becomes a pin, so generating code from a diagram
    // someone spent an hour arranging does not immediately rearrange it. They can drop the
    // pins afterwards to see the derived layout.
    const nextPins: Record<string, Point> = {}
    for (const node of nodes) {
      const name = result.names[node.id]
      if (name) nextPins[name] = { x: node.position.x, y: node.position.y }
    }

    // Hand every printed node over to the text before recompiling.
    //
    // Without this the diagram doubles: the recompile adds its own copy of each node while
    // the merge keeps the original, because an unmarked node is by definition not the text's
    // to replace. Marking them says "these are described by the source now", so the merge
    // drops them and the compiled versions take their place.
    useDiagramStore.getState().setNodes(
      nodes.map((node) => {
        const name = result.names[node.id]
        return name ? ({ ...node, data: { ...node.data, dslName: name } } as typeof node) : node
      })
    )
    useDiagramStore.getState().setEdges(
      edges.map((edge) => {
        const printed =
          result.names[edge.source] !== undefined && result.names[edge.target] !== undefined
        return printed ? { ...edge, data: { ...edge.data, dslOwned: true } } : edge
      })
    )

    // Pins before the source: setting the source is what triggers the recompile, so the pins
    // have to already be in place or the first layout would ignore them and jump the diagram.
    setPins(nextPins)
    setSource(result.text)
  }, [setPins, setSource])

  const insertStarter = useCallback(() => setSource(STARTER), [setSource])

  return (
    <div className="flex h-full flex-col bg-white">
      {/* header */}
      <div className="flex items-center gap-1.5 border-b border-slate-200/80 px-3 py-2">
        <Code2 className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
        <p className="mr-auto text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          Code
        </p>

        <button
          onClick={() => setDirection(direction === 'down' ? 'right' : 'down')}
          title={direction === 'down' ? 'Flowing top to bottom' : 'Flowing left to right'}
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          {direction === 'down' ? (
            <ArrowDown className="h-3.5 w-3.5" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" />
          )}
        </button>

        <button
          onClick={clearPins}
          disabled={pinCount === 0}
          title={
            pinCount === 0
              ? 'No manual positions'
              : `Release ${pinCount} manual position${pinCount === 1 ? '' : 's'}`
          }
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <PinOff className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={importFromCanvas}
          title="Generate code from the current canvas"
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <FileDown className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => setCodeOpen(false)}
          title="Close the code pane"
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <XCircle className="h-3.5 w-3.5" />
        </button>
      </div>

      {source.trim() === '' ? (
        <EmptyState onStart={insertStarter} onImport={importFromCanvas} />
      ) : (
        <CodeEditor
          value={source}
          onChange={setSource}
          diagnostics={diagnostics}
          placeholder="server api &quot;API Server&quot;"
        />
      )}

      {/* diagnostics */}
      {diagnostics.length > 0 && (
        <div className="max-h-44 flex-shrink-0 overflow-y-auto border-t border-slate-200/80 bg-slate-50/60">
          <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            <span>Problems</span>
            {errors.length > 0 && <span className="text-red-500">{errors.length} error{errors.length === 1 ? '' : 's'}</span>}
            {warnings.length > 0 && (
              <span className="text-amber-500">
                {warnings.length} warning{warnings.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <ul className="pb-1.5">
            {diagnostics.map((diagnostic, index) => (
              <DiagnosticRow key={`${diagnostic.span.start.offset}-${index}`} diagnostic={diagnostic} />
            ))}
          </ul>
        </div>
      )}

      {/* status */}
      <div className="flex flex-shrink-0 items-center gap-2 border-t border-slate-200/80 px-3 py-1.5 text-[10px] text-slate-400">
        <span>
          {source ? `${source.split('\n').length} lines` : 'Empty'}
        </span>
        {pinCount > 0 && (
          <span className="text-slate-500">
            {pinCount} pinned
          </span>
        )}
        <span className="ml-auto">
          {errors.length === 0 ? (
            <span className="text-emerald-600">Live</span>
          ) : (
            <span className="text-red-500">Not applied</span>
          )}
        </span>
      </div>
    </div>
  )
}

function DiagnosticRow({ diagnostic }: { diagnostic: Diagnostic }) {
  const isError = diagnostic.severity === 'error'

  return (
    <li className="flex gap-2 px-3 py-1">
      {isError ? (
        <XCircle className="mt-[3px] h-3 w-3 flex-shrink-0 text-red-500" />
      ) : (
        <AlertTriangle className="mt-[3px] h-3 w-3 flex-shrink-0 text-amber-500" />
      )}
      <div className="min-w-0">
        <p className="text-[11px] leading-snug text-slate-700">
          <span className="mr-1.5 font-mono text-slate-400">
            {diagnostic.span.start.line}:{diagnostic.span.start.column}
          </span>
          {diagnostic.message}
        </p>
        {diagnostic.hint && (
          <p className="text-[10px] leading-snug text-slate-400">{diagnostic.hint}</p>
        )}
      </div>
    </li>
  )
}

function EmptyState({
  onStart,
  onImport,
}: {
  onStart: () => void
  onImport: () => void
}) {
  const hasNodes = useDiagramStore((s) => s.nodes.length > 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <Code2 className="h-7 w-7 text-slate-300" />
      <p className="text-[11px] leading-relaxed text-slate-500">
        Describe the system in text and the diagram draws itself — no dragging, no
        coordinates.
      </p>

      <button
        onClick={onStart}
        className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-slate-700"
      >
        <Sparkles className="h-3 w-3" />
        Start from an example
      </button>

      {hasNodes && (
        <button
          onClick={onImport}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          <FileDown className="h-3 w-3" />
          Generate from this canvas
        </button>
      )}
    </div>
  )
}
