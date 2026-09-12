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
  // Wall-clock milliseconds this packet should take to cross its edge. A duration
  // rather than a speed: the renderer samples the edge's real curved path, whose
  // length is not the straight-line distance a px/s figure would assume.
  durationMs: number
  status: PacketStatus
  // Which request number this is
  requestIndex: number
  // Time when packet started on this edge (ms)
  startTime: number
  // Node IDs this branch has already visited, ending at targetId. A request fans
  // out rather than following one pre-planned route, so a packet carries its own
  // history instead of an index into a shared path. Doubles as the cycle guard.
  trail: string[]
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
  // Which failure rule fired, when one did.
  cause?: string
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
