'use client'

import { create } from 'zustand'
import type {
  SimulationState, SimConfig, SimPacket, SimLogEntry,
  NodeStat, SimStats, SimStatus, NodeSimStatus, FailureConfig,
} from '@/types/simulation'

const DEFAULT_FAILURE: FailureConfig = {
  failNodes: new Set(),
  slowEdges: new Set(),
  errorRate: 0,
  slowFactor: 3,
}

const DEFAULT_CONFIG: SimConfig = {
  mode: 'request-flow',
  startNodeId: '',
  concurrency: 1,
  loop: false,
  speedMultiplier: 1,
  maxRequests: 20,
  failure: DEFAULT_FAILURE,
}

const DEFAULT_STATS: SimStats = {
  totalRequests: 0,
  completedRequests: 0,
  failedRequests: 0,
  avgLatencyMs: 0,
  p95LatencyMs: 0,
  throughputRps: 0,
  startedAt: null,
}

interface SimStore extends SimulationState {
  // Config actions
  setConfig: (partial: Partial<SimConfig>) => void
  setStartNode: (nodeId: string) => void
  toggleFailNode: (nodeId: string) => void
  toggleSlowEdge: (edgeId: string) => void
  setErrorRate: (rate: number) => void

  // Simulation lifecycle
  setStatus: (status: SimStatus) => void
  reset: () => void

  // Runtime mutations (called by engine each animation frame)
  setPackets: (packets: SimPacket[]) => void
  addLogEntry: (entry: SimLogEntry) => void
  updateNodeStat: (nodeId: string, patch: Partial<NodeStat>) => void
  setNodeStatus: (nodeId: string, status: NodeSimStatus) => void
  clearNodeStatus: (nodeId: string) => void
  setActiveEdges: (edgeIds: Set<string>) => void
  setFailedEdge: (edgeId: string) => void
  updateStats: (patch: Partial<SimStats>) => void
  finaliseStats: () => void
}

export const useSimulationStore = create<SimStore>()((set, get) => ({
  status: 'idle',
  config: DEFAULT_CONFIG,
  packets: [],
  log: [],
  nodeStats: {},
  stats: DEFAULT_STATS,
  nodeStatuses: {},
  activeEdgeIds: new Set(),
  failedEdgeIds: new Set(),

  setConfig: (partial) =>
    set((s) => ({ config: { ...s.config, ...partial } })),

  setStartNode: (nodeId) =>
    set((s) => ({ config: { ...s.config, startNodeId: nodeId } })),

  toggleFailNode: (nodeId) =>
    set((s) => {
      const failNodes = new Set(s.config.failure.failNodes)
      failNodes.has(nodeId) ? failNodes.delete(nodeId) : failNodes.add(nodeId)
      return { config: { ...s.config, failure: { ...s.config.failure, failNodes } } }
    }),

  toggleSlowEdge: (edgeId) =>
    set((s) => {
      const slowEdges = new Set(s.config.failure.slowEdges)
      slowEdges.has(edgeId) ? slowEdges.delete(edgeId) : slowEdges.add(edgeId)
      return { config: { ...s.config, failure: { ...s.config.failure, slowEdges } } }
    }),

  setErrorRate: (rate) =>
    set((s) => ({ config: { ...s.config, failure: { ...s.config.failure, errorRate: rate } } })),

  setStatus: (status) => set({ status }),

  reset: () =>
    set({
      status: 'idle',
      packets: [],
      log: [],
      nodeStats: {},
      stats: { ...DEFAULT_STATS },
      nodeStatuses: {},
      activeEdgeIds: new Set(),
      failedEdgeIds: new Set(),
    }),

  setPackets: (packets) => set({ packets }),

  addLogEntry: (entry) =>
    set((s) => ({
      log: [entry, ...s.log].slice(0, 200), // cap log at 200 entries
    })),

  updateNodeStat: (nodeId, patch) =>
    set((s) => ({
      nodeStats: {
        ...s.nodeStats,
        [nodeId]: { ...((s.nodeStats[nodeId] ?? {
          nodeId, requestsIn: 0, requestsOut: 0,
          errors: 0, avgLatencyMs: 0, totalLatencyMs: 0, isBottleneck: false,
        }) as NodeStat), ...patch },
      },
    })),

  setNodeStatus: (nodeId, status) =>
    set((s) => ({ nodeStatuses: { ...s.nodeStatuses, [nodeId]: status } })),

  clearNodeStatus: (nodeId) =>
    set((s) => {
      const next = { ...s.nodeStatuses }
      delete next[nodeId]
      return { nodeStatuses: next }
    }),

  setActiveEdges: (activeEdgeIds) => set({ activeEdgeIds }),

  setFailedEdge: (edgeId) =>
    set((s) => ({ failedEdgeIds: new Set([...s.failedEdgeIds, edgeId]) })),

  updateStats: (patch) =>
    set((s) => ({ stats: { ...s.stats, ...patch } })),

  finaliseStats: () => {
    const { stats, log } = get()
    if (log.length === 0) return
    const latencies = log.filter((e) => e.status !== 'error').map((e) => e.latencyMs).sort((a, b) => a - b)
    const avg = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0
    const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] ?? latencies[latencies.length - 1] : 0
    const elapsed = stats.startedAt ? (Date.now() - stats.startedAt) / 1000 : 1
    const rps = stats.completedRequests / Math.max(elapsed, 0.1)
    set((s) => ({
      stats: { ...s.stats, avgLatencyMs: avg, p95LatencyMs: p95, throughputRps: rps },
    }))
  },
}))
