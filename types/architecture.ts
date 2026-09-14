// Core architecture types

import type { RelationKind } from './lld'

export type Provider = 'aws' | 'gcp' | 'azure' | 'kubernetes' | 'generic'

export type ComponentCategory =
  | 'clients'
  | 'networking'
  | 'compute'
  | 'services'
  | 'databases'
  | 'storage'
  | 'caching'
  | 'messaging'
  | 'observability'
  | 'security'
  | 'frames'
  // New deep-dive categories
  | 'sharding'
  | 'rate-limiting'
  | 'caching-patterns'
  | 'replication'
  | 'load-balancing'
  | 'streaming'
  | 'consistency'
  | 'resilience'
  | 'db-internals'
  | 'infra-devops'
  | 'external'
  | 'actors'
  | 'patterns'

export type Protocol =
  | 'HTTP'
  | 'HTTPS'
  | 'TCP'
  | 'UDP'
  | 'gRPC'
  | 'WebSocket'
  | 'SSE'
  | 'REST'
  | 'GraphQL'
  | 'Kafka'
  | 'AMQP'
  | 'MQTT'

export type ConnectionType =
  | 'synchronous'
  | 'asynchronous'
  | 'replication'
  | 'event'
  | 'read'
  | 'write'
  | 'bidirectional'

export type FrameType =
  | 'region'
  | 'availability-zone'
  | 'vpc'
  | 'cluster'
  | 'service'
  | 'database-cluster'
  | 'data-center'
  | 'custom'

export interface ArchitectureComponent {
  id: string
  name: string
  category: ComponentCategory
  provider?: Provider
  icon: string
  description: string
  tags: string[]
  metadata?: Record<string, unknown>
  behavior?: ComponentBehavior
  // For future validation support
  typicalConnections?: {
    upstream?: string[]
    downstream?: string[]
  }
}

// ─── Component Behavior ───────────────────────────────────────────────────────
// Describes what flows in and out of a component — used to auto-infer
// edge labels, protocols and connection types when arrows are drawn.

export type FlowRole =
  | 'request' | 'response' | 'query' | 'result'
  | 'publish' | 'subscribe' | 'consume' | 'produce'
  | 'read' | 'write' | 'replicate' | 'stream'
  | 'forward' | 'route' | 'balance' | 'proxy'
  | 'cache-read' | 'cache-write' | 'cache-miss'
  | 'authenticate' | 'authorize' | 'token'
  | 'emit' | 'receive' | 'notify' | 'trigger'
  | 'store' | 'retrieve' | 'upload' | 'download'
  | 'log' | 'metric' | 'trace' | 'alert'
  | 'deploy' | 'pull' | 'push' | 'build'
  | 'resolve' | 'lookup'
  | 'connect' | 'disconnect'
  | 'sync' | 'async'
  | 'data'

export interface ComponentPort {
  /** Human-readable label for this port e.g. "HTTP request" */
  flowLabel: string
  protocol: Protocol | string
  connectionType: ConnectionType
  role: FlowRole
  /** Optional hint for what data/payload flows e.g. "domain query", "JWT token" */
  dataHint?: string
}

export interface ComponentBehavior {
  /** What this component sends when it initiates a connection (outgoing arrow FROM this) */
  outbound: ComponentPort
  /** What this component expects to receive (incoming arrow TO this) */
  inbound: ComponentPort
  /** Architecture pattern this component belongs to */
  pattern?: string
  /** Simulation hints */
  sim?: {
    latencyMs?: number       // typical one-hop latency
    fanout?: boolean         // does it fan out to multiple targets?
    async?: boolean          // does it queue/buffer?
    ordered?: boolean        // does it preserve order?
    stateful?: boolean       // does it hold state?
  }
}

export interface ArchitectureNodeData extends Record<string, unknown> {
  componentId: string
  label: string
  provider?: Provider
  category: ComponentCategory
  icon: string
  description?: string
  subtitle?: string
  // Replication support
  isPrimary?: boolean
  isReplica?: boolean
  replicaOf?: string
  // Custom style overrides
  color?: string
  width?: number
  height?: number
  /**
   * Simulation capacity overrides. Absent means "use the profile for this
   * category" — see lib/simulation/capacity.ts — so a diagram needs no configuration
   * before a load test can find its bottleneck.
   */
  serviceMs?: number
  /**
   * Direct concurrency override. Normally left unset and derived from the instance
   * sizing below; kept as an escape hatch for a tier whose parallelism has nothing to do
   * with cores, such as a connection-pool limit.
   */
  concurrency?: number

  // ── Instance sizing ──
  // Hardware is what buys concurrency, so these derive it rather than sitting alongside
  // it. See lib/simulation/instances.ts.
  /** Horizontal count — pods, VMs, shards. */
  instances?: number
  /** vCPU per instance. */
  vcpu?: number
  /** RAM per instance, in GB. */
  memoryGb?: number
  /** Requests one vCPU handles at once. 1 for CPU-bound work. */
  concurrencyPerVcpu?: number

  /**
   * Component-specific configuration — engine and connection pool for a database, AMI and
   * EBS volume for an EC2 instance, algorithm and health checks for a balancer.
   *
   * A free-form bag rather than typed fields because the shape depends on which component
   * this is; the schema lives in lib/config/fields.ts. Kept separate from the typed
   * capacity fields above so config keys cannot collide with them.
   */
  config?: Record<string, ConfigValue>

  /**
   * The DSL name this node was compiled from, when the diagram is authored as text.
   *
   * Present only on generated nodes, which is what lets the sync layer replace what the text
   * owns and leave everything drawn by hand alone. Without a marker it would have to replace
   * the whole canvas and would silently delete every hand-drawn shape on each keystroke. Also
   * the stable key a position pin is stored under, since node ids are regenerated per compile.
   */
  dslName?: string
}

/** A configuration value. Narrow on purpose: these round-trip through stored JSON. */
export type ConfigValue = string | number | boolean

export type { RelationKind } from './lld'

export interface ArchitectureEdgeData extends Record<string, unknown> {
  protocol?: Protocol
  connectionType?: ConnectionType
  /** UML / ER / sequence relationship semantics (LLD) */
  relationKind?: RelationKind
  label?: string
  animated?: boolean
  edgeLineStyle?: EdgeLineStyle
  /**
   * Manual nudge from the edge's natural midpoint, in canvas units.
   *
   * Stored relative to the midpoint so it survives the nodes being moved. Used to
   * pull apart edges that share a node pair and would otherwise overlap.
   */
  offset?: ShapePoint
  metadata?: Record<string, unknown>
  /**
   * True when this edge was generated from the DSL.
   *
   * The edge counterpart of `dslName`. Edges have no name to carry, so a flag is enough —
   * all it has to answer is "may the sync layer replace this".
   */
  dslOwned?: boolean
}

export interface FrameNodeData extends Record<string, unknown> {
  label: string
  frameType: FrameType
  description?: string
  color?: string
  width?: number
  height?: number
  /** Label position within the frame — defaults to top-left (8, 8) */
  labelX?: number
  labelY?: number
  /** See ArchitectureNodeData.dslName. */
  dslName?: string
}

// ─── Shape system ─────────────────────────────────────────────────────────────

export type ShapeType =
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'parallelogram'
  | 'cylinder'
  | 'hexagon'
  | 'star'
  | 'arrow'   // freehand stroke with arrowhead (start → end)
  | 'line'    // freehand stroke (start → end)
  | 'text'
  // Flowchart primitives (LLD)
  | 'terminator'
  | 'document'
  | 'preparation'
  | 'connector'
  | 'note'

export type StrokeStyle = 'solid' | 'dashed' | 'dotted'
export type ArrowHeadType = 'none' | 'arrow' | 'arrowclosed' | 'diamond' | 'circle'
export type FontWeight = 'normal' | 'semibold' | 'bold'
export type TextAlign = 'left' | 'center' | 'right'

export interface ShapePoint {
  x: number
  y: number
}

export interface ShapeNodeData extends Record<string, unknown> {
  shapeType: ShapeType
  label?: string
  fill?: string
  fillOpacity?: number      // 0–1
  stroke?: string
  strokeWidth?: number
  strokeStyle?: StrokeStyle
  opacity?: number          // 0–100
  cornerRadius?: number
  fontSize?: number
  fontWeight?: FontWeight
  textAlign?: TextAlign
  textColor?: string
  /** Enter edit mode once after spawn (Excalidraw-style) */
  autoEdit?: boolean
  /** Node-local position of the shape label (draggable) */
  textX?: number
  textY?: number
  /** Node-local endpoints for freehand line / arrow */
  start?: ShapePoint
  end?: ShapePoint
  /** See ArchitectureNodeData.dslName. */
  dslName?: string
  /** Explicit box, when the DSL sets one. Layout uses the shape's default otherwise. */
  width?: number
  height?: number
}

// ─── Edge style ───────────────────────────────────────────────────────────────

export type EdgeLineStyle = 'bezier' | 'straight' | 'step' | 'smoothstep'

export interface EdgeStylePreset {
  strokeColor: string
  strokeWidth: number
  strokeStyle: StrokeStyle
  lineStyle: EdgeLineStyle
  startArrow: ArrowHeadType
  endArrow: ArrowHeadType
  animated: boolean
}

// ─────────────────────────────────────────────────────────────────────────────

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export interface DiagramMetadata {
  createdAt: string
  updatedAt: string
  author?: string
  description?: string
  tags?: string[]
}
