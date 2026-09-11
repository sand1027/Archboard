// ─── Simulation types ─────────────────────────────────────────────────────────

export type SimMode = 'request-flow' | 'load-test' | 'failure-mode'
export type SimStatus = 'idle' | 'running' | 'paused' | 'finished'
export type PacketStatus = 'travelling' | 'arrived' | 'failed' | 'queued'
export type NodeSimStatus = 'idle' | 'active' | 'processing' | 'error' | 'slow'

export interface SimPacket {
  id: string
  // The edge this packet is currently traversing
  edgeId: string
  // Source and target node IDs
  sourceId: string
  targetId: string
  // 0–1 progress along the edge
  progress: number
  // Pixels-per-second (derived from speed setting)
  speed: number
  status: PacketStatus
  // Which request number this is
  requestIndex: number
  // Time when packet started on this edge (ms)
  startTime: number
  // The full path this request will traverse (node IDs)
  path: string[]
  // Current position in path (index into path)
  pathStep: number
  // Color for this request thread
  color: string
}

export interface SimLogEntry {
  id: string
  timestamp: number
  sourceLabel: string
  targetLabel: string
  edgeId: string
  latencyMs: number
  status: 'ok' | 'error' | 'slow'
  protocol?: string
}

export interface NodeStat {
  nodeId: string
  requestsIn: number
  requestsOut: number
  errors: number
  avgLatencyMs: number
  totalLatencyMs: number
  isBottleneck: boolean
}

export interface SimStats {
  totalRequests: number
  completedRequests: number
  failedRequests: number
  avgLatencyMs: number
  p95LatencyMs: number
  throughputRps: number
  startedAt: number | null
}

export interface FailureConfig {
  // Node IDs that should fail
  failNodes: Set<string>
  // Edge IDs that should be slow
  slowEdges: Set<string>
  // Failure probability 0–1
  errorRate: number
  // Slow edge multiplier (1 = normal)
  slowFactor: number
}

export interface SimConfig {
  mode: SimMode
  startNodeId: string
  // Concurrent requests (load test)
  concurrency: number
  // Replay loop
  loop: boolean
  // Speed multiplier (0.25 = slow, 1 = normal, 4 = fast)
  speedMultiplier: number
  // Max requests to send before stopping
  maxRequests: number
  failure: FailureConfig
}

export interface SimulationState {
  status: SimStatus
  config: SimConfig
  packets: SimPacket[]
  log: SimLogEntry[]
  nodeStats: Record<string, NodeStat>
  stats: SimStats
  // Node IDs currently in an active/error/slow state for visual overlay
  nodeStatuses: Record<string, NodeSimStatus>
  // Edge IDs currently traversed (for highlight)
  activeEdgeIds: Set<string>
  // Edge IDs that have failed (for red highlight, persisted until reset)
  failedEdgeIds: Set<string>
}
