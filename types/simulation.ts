// ─── Simulation types ─────────────────────────────────────────────────────────

/**
 * How loaded a node was over a run.
 *
 * Declared here rather than in lib/simulation/capacity.ts, which computes it, so that
 * types stays a leaf module and nothing under types/ has to import from lib/.
 */
export type BottleneckSeverity = 'none' | 'busy' | 'saturated'

export type SimMode = 'request-flow' | 'load-test' | 'failure-mode'
export type SimStatus = 'idle' | 'running' | 'paused' | 'finished'
/**
 * Where a packet is in its life.
 *
 * `travelling` is on an edge; `queued` and `serving` are both at a node, waiting for
 * a free server and occupying one respectively. Previously this also declared
 * `arrived` and `failed`, which were never assigned to anything — a packet that
 * arrives is replaced by its successors and a failed one is dropped.
 */
export type PacketStatus = 'travelling' | 'queued' | 'serving'
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
  /** Requests this node forwarded downstream after serving them. */
  requestsOut: number
  errors: number
  /** Mean time a request spent at this node: queue wait plus service. */
  avgLatencyMs: number
  totalLatencyMs: number
  isBottleneck: boolean

  // ── Contention ──
  /** Requests waiting for a free server right now. */
  queueDepth: number
  /** Deepest the queue got over the run. */
  maxQueueDepth: number
  /** Mean time a request spent waiting before service started. */
  avgWaitMs: number
  /** Fraction of serving capacity used, 0..1. */
  utilisation: number
  /** Capacity in force for this node, after category defaults and overrides. */
  serviceMs: number
  concurrency: number
  /** How loaded it was: 'none' | 'busy' | 'saturated'. */
  severity: BottleneckSeverity
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
