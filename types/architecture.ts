// Core architecture types

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
  // For future validation support
  typicalConnections?: {
    upstream?: string[]
    downstream?: string[]
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
}

export interface ArchitectureEdgeData extends Record<string, unknown> {
  protocol?: Protocol
  connectionType?: ConnectionType
  label?: string
  animated?: boolean
  metadata?: Record<string, unknown>
}

export interface FrameNodeData extends Record<string, unknown> {
  label: string
  frameType: FrameType
  description?: string
  color?: string
  width?: number
  height?: number
}

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
