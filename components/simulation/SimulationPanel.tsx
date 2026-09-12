'use client'

import { useCallback, useMemo } from 'react'
import {
  Play, Pause, Square, RotateCcw,
  Zap, Activity, AlertTriangle, CheckCircle2,
  ChevronDown, Clock, Layers,
} from 'lucide-react'
import { useSimulationStore } from '@/store/simulationStore'
import { useUiStore } from '@/store/uiStore'
import { useDiagramStore } from '@/store/diagramStore'
import { simulationEngine } from '@/lib/simulation/engine'
import { buildGraph, readDataString, suggestStartNode } from '@/lib/simulation/traversal'
import type { SimMode } from '@/types/simulation'

const MODE_OPTIONS: { id: SimMode; label: string; desc: string }[] = [
  { id: 'request-flow', label: 'Request Flow',  desc: 'Trace a single request through the system' },
  { id: 'load-test',    label: 'Load Test',     desc: 'Simulate concurrent requests at scale' },
  { id: 'failure-mode', label: 'Failure Mode',  desc: 'Inject failures & slow paths' },
]

export default function SimulationPanel() {
  const { setSimulationOpen } = useUiStore()
  const { nodes, edges } = useDiagramStore()
  const {
    status, config, log, stats, nodeStats,
    setConfig, setStartNode, setErrorRate,
    toggleFailNode, toggleSlowEdge, clearFailures,
  } = useSimulationStore()

  const archNodes = useMemo(
    () => nodes.filter((n) => n.type === 'architecture' || n.type === 'icon'),
    [nodes]
  )

  // Id → display name, so the failure lists can name what the user marked instead
  // of showing a truncated id.
  const nodeLabels = useMemo(() => {
    const map = new Map<string, string>()
    for (const node of nodes) {
      const label = readDataString(node.data, 'label') ?? readDataString(node.data, 'name')
      map.set(node.id, label ?? node.id.slice(0, 8))
    }
    return map
  }, [nodes])

  const edgeLabels = useMemo(() => {
    const map = new Map<string, string>()
    for (const edge of edges) {
      const from = nodeLabels.get(edge.source) ?? edge.source.slice(0, 8)
      const to = nodeLabels.get(edge.target) ?? edge.target.slice(0, 8)
      map.set(edge.id, `${from} → ${to}`)
    }
    return map
  }, [edges, nodeLabels])

  const hasFailures =
    config.failure.failNodes.size > 0 || config.failure.slowEdges.size > 0

  const handleStart = useCallback(() => {
    // Default to the diagram's entry point rather than whichever node happens to be
    // first in the array. Starting from the middle leaves everything upstream of it
    // out of the run, which reads as a broken simulation rather than a bad default.
    if (!config.startNodeId && archNodes.length > 0) {
      const suggested = suggestStartNode(
        buildGraph(edges),
        archNodes.map((n) => n.id)
      )
      if (suggested) setStartNode(suggested)
    }
    simulationEngine.start()
  }, [config.startNodeId, archNodes, edges, setStartNode])

  const handlePause = useCallback(() => simulationEngine.pause(), [])
  const handleStop  = useCallback(() => simulationEngine.stop(),  [])
  const handleReset = useCallback(() => simulationEngine.reset(), [])

  const isRunning = status === 'running'
  const isPaused  = status === 'paused'
  const isActive  = isRunning || isPaused

  return (
    <div className="flex flex-col h-full bg-white text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-gray-900 text-sm">Simulate</span>
          {isRunning && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Running
            </span>
          )}
          {isPaused && (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Paused
            </span>
          )}
          {status === 'finished' && (
            <span className="text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
              Done
            </span>
          )}
        </div>
        <button
          onClick={() => setSimulationOpen(false)}
          className="text-gray-400 hover:text-gray-600 text-xs px-1.5 py-0.5 hover:bg-gray-100 rounded transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ── Mode ── */}
        <Section title="Mode">
          <div className="flex flex-col gap-1">
            {MODE_OPTIONS.map((m) => (
              <button
                key={m.id}
                onClick={() => setConfig({ mode: m.id })}
                disabled={isActive}
                className={[
                  'flex items-start gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors',
                  config.mode === m.id
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                  isActive ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              >
                <div className={[
                  'w-3.5 h-3.5 rounded-full border-2 mt-0.5 flex-shrink-0',
                  config.mode === m.id ? 'border-blue-500 bg-blue-500' : 'border-gray-300',
                ].join(' ')} />
                <div>
                  <p className="text-xs font-medium text-gray-800">{m.label}</p>
                  <p className="text-[10px] text-gray-500">{m.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* ── Start node ── */}
        <Section title="Start Node">
          <select
            value={config.startNodeId}
            onChange={(e) => setStartNode(e.target.value)}
            disabled={isActive}
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">— pick a node —</option>
            {nodes.map((n) => {
              const d = n.data as any
              const label = d?.label ?? d?.name ?? n.id.slice(0, 8)
              return <option key={n.id} value={n.id}>{label}</option>
            })}
          </select>
        </Section>

        {/* ── Settings ── */}
        <Section title="Settings">
          <div className="space-y-3">
            {/* Speed */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-500 w-20 shrink-0">Speed</label>
              <input
                type="range" min={0.25} max={8} step={0.25}
                value={config.speedMultiplier}
                onChange={(e) => setConfig({ speedMultiplier: parseFloat(e.target.value) })}
                disabled={isActive}
                className="flex-1 disabled:opacity-50"
              />
              <span className="text-xs text-gray-600 w-10 text-right">
                {config.speedMultiplier}×
              </span>
            </div>

            {/* Concurrency */}
            {config.mode !== 'request-flow' && (
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-500 w-20 shrink-0">Concurrent</label>
                <div className="flex gap-1">
                  {[1, 2, 5, 10].map((v) => (
                    <button
                      key={v}
                      onClick={() => setConfig({ concurrency: v })}
                      disabled={isActive}
                      className={[
                        'w-9 py-1.5 rounded-lg text-xs border transition-colors disabled:opacity-50',
                        config.concurrency === v
                          ? 'bg-blue-50 border-blue-400 text-blue-700 font-semibold'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300',
                      ].join(' ')}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Max requests */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-500 w-20 shrink-0">Requests</label>
              <div className="flex gap-1">
                {[5, 10, 20, 50].map((v) => (
                  <button
                    key={v}
                    onClick={() => setConfig({ maxRequests: v })}
                    disabled={isActive}
                    className={[
                      'w-9 py-1.5 rounded-lg text-xs border transition-colors disabled:opacity-50',
                      config.maxRequests === v
                        ? 'bg-blue-50 border-blue-400 text-blue-700 font-semibold'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300',
                    ].join(' ')}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Loop */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.loop}
                onChange={(e) => setConfig({ loop: e.target.checked })}
                disabled={isActive}
                className="rounded"
              />
              <span className="text-xs text-gray-600">Loop continuously</span>
            </label>
          </div>
        </Section>

        {/* ── Failure injection ── */}
        {config.mode === 'failure-mode' && (
          <Section title="Failure Injection">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-500 w-24 shrink-0">Error rate</label>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={config.failure.errorRate}
                  onChange={(e) => setErrorRate(parseFloat(e.target.value))}
                  disabled={isActive}
                  className="flex-1"
                />
                <span className="text-xs text-gray-600 w-8 text-right">
                  {Math.round(config.failure.errorRate * 100)}%
                </span>
              </div>
              <p className="text-[10px] text-gray-400">
                Click a node on the canvas to mark it down — it gets a dashed red ring
                and fails every request that reaches it. Click an edge to throttle it
                to {config.failure.slowFactor}× slower.
              </p>

              {config.failure.failNodes.size > 0 && (
                <div className="bg-red-50 rounded-lg px-3 py-2 border border-red-200 space-y-1">
                  <p className="text-xs font-medium text-red-700">
                    Down ({config.failure.failNodes.size})
                  </p>
                  {Array.from(config.failure.failNodes).map((id) => (
                    <div key={id} className="flex items-center justify-between text-xs text-red-600">
                      <span className="truncate">{nodeLabels.get(id) ?? id.slice(0, 8)}</span>
                      <button
                        onClick={() => toggleFailNode(id)}
                        disabled={isActive}
                        aria-label={`Restore ${nodeLabels.get(id) ?? 'node'}`}
                        className="hover:text-red-800 ml-2 disabled:opacity-40"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {config.failure.slowEdges.size > 0 && (
                <div className="bg-amber-50 rounded-lg px-3 py-2 border border-amber-200 space-y-1">
                  <p className="text-xs font-medium text-amber-700">
                    Throttled ({config.failure.slowEdges.size})
                  </p>
                  {Array.from(config.failure.slowEdges).map((id) => (
                    <div key={id} className="flex items-center justify-between text-xs text-amber-700">
                      <span className="truncate">{edgeLabels.get(id) ?? id.slice(0, 8)}</span>
                      <button
                        onClick={() => toggleSlowEdge(id)}
                        disabled={isActive}
                        aria-label="Restore connection speed"
                        className="hover:text-amber-900 ml-2 disabled:opacity-40"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {hasFailures && (
                <button
                  onClick={clearFailures}
                  disabled={isActive}
                  className="w-full text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg py-1.5 transition-colors disabled:opacity-40"
                >
                  Clear all failures
                </button>
              )}
            </div>
          </Section>
        )}

        {/* ── Controls ── */}
        <Section title="">
          <div className="flex gap-2">
            {!isActive ? (
              <button
                onClick={handleStart}
                disabled={!config.startNodeId && nodes.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                Run
              </button>
            ) : (
              <button
                onClick={handlePause}
                className={[
                  'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-xl transition-colors',
                  isPaused
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300',
                ].join(' ')}
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
            )}
            <button
              onClick={handleStop}
              disabled={!isActive}
              className="flex items-center justify-center gap-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors disabled:opacity-40"
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="flex items-center justify-center gap-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </Section>

        {/* ── Stats ── */}
        {(status === 'running' || status === 'finished' || stats.totalRequests > 0) && (
          <Section title="Stats">
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Total" value={stats.totalRequests} icon={<Layers className="w-3.5 h-3.5" />} color="blue" />
              <StatCard label="Done" value={stats.completedRequests} icon={<CheckCircle2 className="w-3.5 h-3.5" />} color="green" />
              <StatCard label="Errors" value={stats.failedRequests} icon={<AlertTriangle className="w-3.5 h-3.5" />} color="red" />
              <StatCard label="Avg ms" value={Math.round(stats.avgLatencyMs)} icon={<Clock className="w-3.5 h-3.5" />} color="amber" />
            </div>
            {stats.throughputRps > 0 && (
              <p className="text-[10px] text-gray-400 mt-2 text-center">
                {stats.throughputRps.toFixed(1)} req/s · p95 {Math.round(stats.p95LatencyMs)}ms
              </p>
            )}
          </Section>
        )}

        {/* ── Flow log ── */}
        {log.length > 0 && (
          <Section title="Flow Log">
            <div className="space-y-0.5 max-h-56 overflow-y-auto">
              {log.slice(0, 40).map((entry) => (
                <div
                  key={entry.id}
                  className={[
                    'flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px]',
                    entry.status === 'error' ? 'bg-red-50' : entry.status === 'slow' ? 'bg-amber-50' : 'bg-gray-50',
                  ].join(' ')}
                >
                  <span className={[
                    'w-1.5 h-1.5 rounded-full flex-shrink-0',
                    entry.status === 'error' ? 'bg-red-500' : entry.status === 'slow' ? 'bg-amber-500' : 'bg-green-500',
                  ].join(' ')} />
                  <span className="flex-1 truncate text-gray-700">
                    {entry.sourceLabel} → {entry.targetLabel}
                    {entry.cause && (
                      <span className="text-red-500 font-medium"> · {entry.cause}</span>
                    )}
                  </span>
                  {entry.protocol && (
                    <span className="text-gray-400 font-medium shrink-0">{entry.protocol}</span>
                  )}
                  <span className={[
                    'shrink-0 font-medium',
                    entry.status === 'error' ? 'text-red-600' : entry.status === 'slow' ? 'text-amber-600' : 'text-gray-500',
                  ].join(' ')}>
                    {entry.status === 'error' ? 'err' : `${entry.latencyMs}ms`}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Node bottlenecks ── */}
        {Object.values(nodeStats).some((s) => s.requestsIn > 0) && (
          <Section title="Node Stats">
            <div className="space-y-1">
              {Object.values(nodeStats)
                .sort((a, b) => b.requestsIn - a.requestsIn)
                .slice(0, 8)
                .map((stat) => {
                  const node = nodes.find((n) => n.id === stat.nodeId)
                  const label = (node?.data as any)?.label ?? stat.nodeId.slice(0, 8)
                  const errPct = stat.requestsIn > 0 ? (stat.errors / stat.requestsIn) * 100 : 0
                  return (
                    <div key={stat.nodeId} className="flex items-center gap-2 text-[10px]">
                      <span className="truncate flex-1 text-gray-700">{label}</span>
                      <span className="text-gray-400">{stat.requestsIn} req</span>
                      <span className={stat.isBottleneck ? 'text-red-500 font-bold' : 'text-gray-400'}>
                        {Math.round(stat.avgLatencyMs)}ms
                      </span>
                      {errPct > 0 && (
                        <span className="text-red-500">{Math.round(errPct)}%err</span>
                      )}
                      {stat.isBottleneck && (
                        <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
                      )}
                    </div>
                  )
                })}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-gray-100 last:border-b-0">
      {title && (
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</p>
      )}
      {children}
    </div>
  )
}

function StatCard({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode
  color: 'blue' | 'green' | 'red' | 'amber'
}) {
  const colors = {
    blue:  'bg-blue-50  text-blue-700  border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red:   'bg-red-50   text-red-700   border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colors[color]}`}>
      <span className="opacity-70">{icon}</span>
      <div>
        <p className="text-[9px] font-medium opacity-70 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-bold leading-none">{value}</p>
      </div>
    </div>
  )
}
