import type { ConnectionType, Protocol } from '@/types/architecture'
import type { LldEdgeStyle } from '@/types/lld'

/**
 * Notation for HLD connections, mirroring lib/canvas/notation.ts.
 *
 * The two boards now share one edge-style vocabulary and one marker registry, so
 * an arrowhead means the same thing on both. Before this, HLD had a colour table
 * with no arrowhead semantics at all and `MarkerType.ArrowClosed` hardcoded on
 * every edge.
 *
 * Typed as a total Record, so adding a ConnectionType without notation is a
 * compile error rather than a silent fallback to a generic arrow.
 */
export const HLD_NOTATION: Record<ConnectionType, LldEdgeStyle> = {
  // Caller blocks for a response — filled head, the "solid" request.
  synchronous: {
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'arrow-filled',
    stroke: '#374151',
    strokeWidth: 1.5,
  },
  // Fire and forget — open head, dashed to show the caller does not wait.
  asynchronous: {
    line: 'dashed',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'arrow-open',
    stroke: '#7C3AED',
    strokeWidth: 1.5,
  },
  // Data copied between stores — heavier line reads as bulk movement.
  replication: {
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'arrow-filled',
    stroke: '#1D4ED8',
    strokeWidth: 2.5,
  },
  // Published event — dotted, open head.
  event: {
    line: 'dotted',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'arrow-open',
    stroke: '#D97706',
    strokeWidth: 1.5,
  },
  read: {
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'arrow-open',
    stroke: '#0284C7',
    strokeWidth: 1.5,
  },
  write: {
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'arrow-filled',
    stroke: '#DC2626',
    strokeWidth: 1.5,
  },
  // Arrowheads at both ends.
  bidirectional: {
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'arrow-filled',
    endMarker: 'arrow-filled',
    stroke: '#374151',
    strokeWidth: 1.5,
  },
}

export const CONNECTION_TYPE_LABEL: Record<ConnectionType, string> = {
  synchronous: 'Synchronous',
  asynchronous: 'Asynchronous',
  replication: 'Replication',
  event: 'Event',
  read: 'Read',
  write: 'Write',
  bidirectional: 'Bidirectional',
}

export const CONNECTION_TYPE_HINT: Record<ConnectionType, string> = {
  synchronous: 'Caller waits for a response',
  asynchronous: 'Fire and forget, caller continues',
  replication: 'Data copied between stores',
  event: 'Published to subscribers',
  read: 'Query only, no mutation',
  write: 'Mutates state at the target',
  bidirectional: 'Both sides initiate',
}

export const CONNECTION_TYPES = Object.keys(HLD_NOTATION) as ConnectionType[]

/** Label chip colour per protocol. */
export const PROTOCOL_COLORS: Record<Protocol, string> = {
  HTTP: '#374151',
  HTTPS: '#059669',
  TCP: '#374151',
  UDP: '#6B7280',
  gRPC: '#7C3AED',
  WebSocket: '#D97706',
  SSE: '#0EA5E9',
  REST: '#059669',
  GraphQL: '#E10098',
  Kafka: '#D97706',
  AMQP: '#F43F5E',
  MQTT: '#0EA5E9',
}

/** Protocols that imply a connection type, used when arming a preset. */
export const PROTOCOL_DEFAULT_TYPE: Partial<Record<Protocol, ConnectionType>> = {
  Kafka: 'event',
  AMQP: 'asynchronous',
  MQTT: 'event',
  SSE: 'asynchronous',
  WebSocket: 'bidirectional',
}
