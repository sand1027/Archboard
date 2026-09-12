'use client'

import { useMemo } from 'react'
import { Calculator, Pin, RotateCcw, X } from 'lucide-react'
import { useEstimateStore } from '@/store/estimateStore'
import { useUiStore } from '@/store/uiStore'
import { useDiagramStore } from '@/store/diagramStore'
import { estimate, peakQpsFrom } from '@/lib/estimate/workload'
import { formatByUnit, formatRate } from '@/lib/estimate/format'
import { nodeCapacity } from '@/lib/simulation/capacity'
import { instanceProfile, sizing } from '@/lib/simulation/instances'
import { readDataString } from '@/lib/simulation/traversal'
import type { EstimateStep, WorkloadInputs } from '@/types/estimate'

interface FieldDef {
  key: keyof WorkloadInputs
  label: string
  hint: string
  step?: number
}

/**
 * Everything the estimate is built from, grouped the way people reason about it: how much
 * traffic, how big each request is, and how long data is kept.
 */
const FIELD_GROUPS: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Traffic',
    fields: [
      { key: 'dau', label: 'Daily active users', hint: 'People using it in a day' },
      {
        key: 'requestsPerUserPerDay',
        label: 'Requests per user / day',
        hint: 'Actions each user takes',
      },
      {
        key: 'peakFactor',
        label: 'Peak factor',
        hint: 'Peak ÷ average. Traffic is never flat.',
        step: 0.5,
      },
      {
        key: 'readsPerWrite',
        label: 'Reads per write',
        hint: '9 means 90% of traffic is reads',
      },
      {
        key: 'cacheHitRate',
        label: 'Cache hit rate',
        hint: '0–1. Share of reads the cache absorbs.',
        step: 0.05,
      },
    ],
  },
  {
    title: 'Payload',
    fields: [
      { key: 'requestKb', label: 'Request size (KB)', hint: 'Average inbound payload' },
      { key: 'responseKb', label: 'Response size (KB)', hint: 'Average outbound payload' },
      {
        key: 'storedPerWriteKb',
        label: 'Stored per write (KB)',
        hint: 'Durable bytes each write adds',
      },
    ],
  },
  {
    title: 'Retention',
    fields: [
      { key: 'retentionDays', label: 'Retention (days)', hint: 'How long data is kept' },
      { key: 'replicationFactor', label: 'Replication factor', hint: 'Copies kept' },
      {
        key: 'compressionRatio',
        label: 'Compression ratio',
        hint: '1 means none. 4 means 4× smaller.',
        step: 0.5,
      },
      {
        key: 'secondsPerDay',
        label: 'Seconds per day',
        hint: '86400, or 100000 for round mental arithmetic',
      },
    ],
  },
]

/**
 * Capacity estimate for the current design.
 *
 * Shows the working rather than just the totals. Every input is editable and every derived
 * line can be pinned, because in a design review the disputed part is almost always an
 * assumption rather than the multiplication.
 */
export default function EstimatePanel() {
  const setEstimateOpen = useUiStore((s) => s.setEstimateOpen)
  const inputs = useEstimateStore((s) => s.inputs)
  const overrides = useEstimateStore((s) => s.overrides)
  const setInput = useEstimateStore((s) => s.setInput)
  const setOverride = useEstimateStore((s) => s.setOverride)
  const clearOverride = useEstimateStore((s) => s.clearOverride)
  const resetInputs = useEstimateStore((s) => s.resetInputs)
  const clearOverrides = useEstimateStore((s) => s.clearOverrides)

  const nodes = useDiagramStore((s) => s.nodes)

  const result = useMemo(() => estimate(inputs, overrides), [inputs, overrides])
  const pinnedCount = Object.keys(overrides).length
  const peakQps = peakQpsFrom(result)

  /**
   * Every component judged against peak QPS, worst first.
   *
   * Sizing each tier against full peak overstates anything sitting behind a cache or a
   * queue — apportioning traffic properly needs the flow analysis the simulation does. It
   * is still the right default here: it is the conservative reading, and it is the one
   * that surfaces the tier you should look at first.
   */
  const sized = useMemo(() => {
    return nodes
      .filter((node) => node.type === 'architecture')
      // You do not provision your users' phones. An external dependency stays in, though —
      // one you cannot scale is often the real constraint.
      .filter((node) => {
        const category = readDataString(node.data, 'category')
        return category !== 'clients' && category !== 'actors'
      })
      .map((node) => {
        const profile = instanceProfile(node.data)
        const capacity = nodeCapacity(node.data)
        return {
          id: node.id,
          label: readDataString(node.data, 'label') ?? node.id.slice(0, 8),
          sizing: sizing(peakQps, capacity.serviceMs, profile),
        }
      })
      .filter((row) => row.sizing.verdict !== 'idle')
      .sort((a, b) => b.sizing.utilisation - a.sizing.utilisation)
  }, [nodes, peakQps])

  /**
   * The constraint: the most loaded component, but only worth naming once it has actually
   * run out of headroom. Calling the busiest tier a bottleneck at 12% would be noise.
   */
  const worst = sized[0] && sized[0].sizing.verdict !== 'ok' ? sized[0] : null

  return (
    <div className="flex flex-col h-full bg-white text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
            <Calculator className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">Capacity</span>
        </div>
        <button
          type="button"
          onClick={() => setEstimateOpen(false)}
          aria-label="Close capacity panel"
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {/* ── Inputs ── */}
        {FIELD_GROUPS.map((group) => (
          <section key={group.title} className="p-4 space-y-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {group.title}
            </p>
            {group.fields.map((field) => (
              <div key={field.key} className="flex items-center gap-3">
                <label
                  htmlFor={`workload-${field.key}`}
                  className="flex-1 min-w-0"
                  title={field.hint}
                >
                  <span className="block text-xs text-gray-600 truncate">{field.label}</span>
                  <span className="block text-[10px] text-gray-400 truncate">{field.hint}</span>
                </label>
                <input
                  id={`workload-${field.key}`}
                  type="number"
                  min={0}
                  step={field.step ?? 1}
                  value={inputs[field.key]}
                  onChange={(e) => setInput(field.key, Number(e.target.value))}
                  className="w-24 shrink-0 px-2 py-1 text-xs text-right border border-gray-200 rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            ))}
          </section>
        ))}

        {/* ── Derivation ── */}
        <section className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Working
            </p>
            {pinnedCount > 0 && (
              <button
                type="button"
                onClick={clearOverrides}
                className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800"
              >
                Unpin all ({pinnedCount})
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Each line shows its arithmetic. Pin any value to substitute your own — everything
            derived from it recalculates.
          </p>

          <div className="space-y-1.5 pt-1">
            {result.steps.map((step) => (
              <StepRow
                key={step.id}
                step={step}
                onPin={(value) => setOverride(step.id, value)}
                onUnpin={() => clearOverride(step.id)}
              />
            ))}
          </div>
        </section>

        {/* ── Cluster sizing ── */}
        <section className="p-4 space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Sizing at peak
          </p>
          {sized.length === 0 ? (
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Drop components on the canvas to see how many instances each needs at{' '}
              {formatRate(peakQps)}.
            </p>
          ) : (
            <>
              {/*
                The predicted bottleneck, stated rather than left to be read off the list.
                This is arithmetic, not measurement — it needs no simulation run, which is
                the point: you can answer "what caps this design" before drawing traffic.
              */}
              {worst && (
                <div
                  className={[
                    'rounded-lg px-3 py-2 border',
                    worst.sizing.verdict === 'under'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-amber-50 border-amber-200',
                  ].join(' ')}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Predicted bottleneck
                  </p>
                  <p className="text-xs font-semibold text-gray-900 mt-0.5 truncate">
                    {worst.label}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                    {Math.round(worst.sizing.utilisation * 100)}% used at {formatRate(peakQps)}.
                    Needs {worst.sizing.requiredInstances} instance
                    {worst.sizing.requiredInstances === 1 ? '' : 's'}, has{' '}
                    {worst.sizing.configuredInstances}.{' '}
                    {worst.sizing.verdict === 'under'
                      ? 'Raising capacity anywhere else changes nothing.'
                      : 'No headroom for a spike.'}
                  </p>
                </div>
              )}

              {!worst && (
                <div className="rounded-lg px-3 py-2 border bg-emerald-50 border-emerald-200">
                  <p className="text-[10px] text-emerald-800 leading-relaxed">
                    Every component has headroom at {formatRate(peakQps)}.
                  </p>
                </div>
              )}

              <p className="text-[10px] text-gray-400 leading-relaxed">
                Instances each component needs to carry {formatRate(peakQps)}, from its
                service time and hardware. Set those per component in the inspector.
              </p>
              <div className="space-y-1 pt-1">
                {sized.map((row) => (
                  <div key={row.id} className="flex items-center gap-2 text-[11px]">
                    <span className="flex-1 truncate text-gray-700" title={row.label}>
                      {row.label}
                    </span>
                    <span className="text-gray-400 tabular-nums shrink-0">
                      {row.sizing.configuredInstances} → {row.sizing.requiredInstances}
                    </span>
                    <span
                      className={[
                        'w-10 text-right font-semibold tabular-nums shrink-0',
                        row.sizing.verdict === 'under'
                          ? 'text-red-600'
                          : row.sizing.verdict === 'tight'
                            ? 'text-amber-600'
                            : 'text-emerald-600',
                      ].join(' ')}
                    >
                      {Math.round(row.sizing.utilisation * 100)}%
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-gray-400 pt-1">
                Configured → required. Every component is sized against full peak, so a tier
                behind a cache will read high.
              </p>
            </>
          )}
        </section>

        {/* ── Reset ── */}
        <section className="p-4">
          <button
            type="button"
            onClick={() => {
              resetInputs()
              clearOverrides()
            }}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium
              text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to defaults
          </button>
        </section>
      </div>
    </div>
  )
}

/** One line of the derivation, with its formula and a pin control. */
function StepRow({
  step,
  onPin,
  onUnpin,
}: {
  step: EstimateStep
  onPin: (value: number) => void
  onUnpin: () => void
}) {
  return (
    <div
      className={[
        'rounded-lg border px-2.5 py-2',
        step.overridden ? 'border-indigo-200 bg-indigo-50/60' : 'border-gray-100 bg-gray-50/60',
      ].join(' ')}
    >
      <div className="flex items-baseline gap-2">
        <span className="flex-1 text-xs text-gray-700 truncate" title={step.note}>
          {step.label}
        </span>
        <span
          className={[
            'text-xs font-semibold tabular-nums shrink-0',
            step.overridden ? 'text-indigo-700' : 'text-gray-900',
          ].join(' ')}
        >
          {formatByUnit(step.value, step.unit)}
        </span>
        <button
          type="button"
          onClick={() => (step.overridden ? onUnpin() : onPin(step.computed))}
          title={step.overridden ? 'Unpin — go back to the calculated value' : 'Pin this value'}
          aria-label={step.overridden ? `Unpin ${step.label}` : `Pin ${step.label}`}
          className={[
            'shrink-0 rounded p-0.5 transition-colors',
            step.overridden
              ? 'text-indigo-600 hover:text-indigo-800'
              : 'text-gray-300 hover:text-gray-500',
          ].join(' ')}
        >
          <Pin className="w-3 h-3" />
        </button>
      </div>

      <p className="mt-0.5 text-[10px] font-mono text-gray-400 truncate" title={step.formula}>
        {step.formula}
      </p>

      {step.overridden && (
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="number"
            value={step.value}
            onChange={(e) => onPin(Number(e.target.value))}
            aria-label={`${step.label} override`}
            className="w-28 px-2 py-1 text-xs text-right border border-indigo-200 rounded-lg bg-white
              focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {/* What the arithmetic said, so it is clear what was replaced. */}
          <span className="text-[10px] text-gray-400">
            calculated {formatByUnit(step.computed, step.unit)}
          </span>
        </div>
      )}
    </div>
  )
}
