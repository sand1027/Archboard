'use client'

import { useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import { useDiagramStore } from '@/store/diagramStore'
import { useHistoryStore } from '@/store/historyStore'
import type { ArchitectureEdge } from '@/types/diagram'
import type { Protocol, ConnectionType, RelationKind } from '@/types/architecture'
import { useUiStore } from '@/store/uiStore'

const PROTOCOLS: Protocol[] = [
  'HTTP', 'HTTPS', 'TCP', 'UDP', 'gRPC',
  'WebSocket', 'SSE', 'REST', 'GraphQL', 'Kafka', 'AMQP', 'MQTT',
]

const CONNECTION_TYPES: { value: ConnectionType; label: string }[] = [
  { value: 'synchronous', label: 'Synchronous' },
  { value: 'asynchronous', label: 'Asynchronous' },
  { value: 'replication', label: 'Replication' },
  { value: 'event', label: 'Event' },
  { value: 'read', label: 'Read' },
  { value: 'write', label: 'Write' },
  { value: 'bidirectional', label: 'Bidirectional' },
]

const RELATION_KINDS: { value: RelationKind; label: string }[] = [
  { value: 'association', label: 'Association' },
  { value: 'inheritance', label: 'Inheritance' },
  { value: 'composition', label: 'Composition' },
  { value: 'aggregation', label: 'Aggregation' },
  { value: 'dependency', label: 'Dependency' },
  { value: 'realization', label: 'Realization' },
  { value: 'one-to-one', label: '1 : 1' },
  { value: 'one-to-many', label: '1 : N' },
  { value: 'many-to-many', label: 'N : M' },
  { value: 'message-sync', label: 'Message (sync)' },
  { value: 'message-async', label: 'Message (async)' },
  { value: 'message-return', label: 'Return message' },
]

interface EdgePropertiesProps {
  edge: ArchitectureEdge
}

export default function EdgeProperties({ edge }: EdgePropertiesProps) {
  const { updateEdge, deleteEdge, nodes } = useDiagramStore()
  const { pushSnapshot } = useHistoryStore()
  const boardMode = useUiStore((s) => s.boardMode)
  const isLld = boardMode === 'lld'

  const sourceNode = nodes.find((n) => n.id === edge.source)
  const targetNode = nodes.find((n) => n.id === edge.target)

  const handleUpdate = useCallback(
    (updates: Partial<typeof edge.data>) => {
      updateEdge(edge.id, updates)
    },
    [edge.id, updateEdge]
  )

  const handleDelete = useCallback(() => {
    const { nodes: n, edges: e } = useDiagramStore.getState()
    pushSnapshot({ nodes: n, edges: e })
    deleteEdge(edge.id)
  }, [edge.id, deleteEdge, pushSnapshot])

  return (
    <div className="divide-y divide-gray-100">
      <div className="p-4">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Connection</p>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span className="font-medium truncate max-w-[80px]">
            {(sourceNode?.data as any)?.label ?? (sourceNode?.data as any)?.name ?? edge.source}
          </span>
          <span className="text-gray-400">→</span>
          <span className="font-medium truncate max-w-[80px]">
            {(targetNode?.data as any)?.label ?? (targetNode?.data as any)?.name ?? edge.target}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {isLld ? (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Relation</label>
            <select
              value={edge.data?.relationKind ?? 'association'}
              onChange={(e) => handleUpdate({ relationKind: e.target.value as RelationKind })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
            >
              {RELATION_KINDS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Protocol</label>
              <select
                value={edge.data?.protocol ?? ''}
                onChange={(e) => handleUpdate({ protocol: e.target.value as Protocol })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
              >
                <option value="">None</option>
                {PROTOCOLS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Connection Type</label>
              <select
                value={edge.data?.connectionType ?? ''}
                onChange={(e) => handleUpdate({ connectionType: e.target.value as ConnectionType })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
              >
                <option value="">None</option>
                {CONNECTION_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Label</label>
          <input
            type="text"
            value={edge.data?.label ?? ''}
            onChange={(e) => handleUpdate({ label: e.target.value })}
            placeholder={isLld ? 'e.g. creates, login()' : 'e.g. API Request'}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
          />
        </div>

        {!isLld && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-2 font-medium">Style preview</p>
            <ConnectionStylePreview type={edge.data?.connectionType ?? 'synchronous'} />
          </div>
        )}
      </div>

      <div className="p-4">
        <button
          onClick={handleDelete}
          className="w-full flex items-center gap-2 py-2 px-3 text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete Connection
        </button>
      </div>
    </div>
  )
}

function ConnectionStylePreview({ type }: { type: ConnectionType }) {
  const styles: Record<ConnectionType, { label: string; color: string; dash?: string }> = {
    synchronous:   { label: '─── Synchronous', color: '#374151' },
    asynchronous:  { label: '- - Asynchronous', color: '#7C3AED', dash: '6,4' },
    replication:   { label: '═══ Replication', color: '#1D4ED8' },
    event:         { label: '·-· Event', color: '#D97706', dash: '4,3' },
    read:          { label: '─── Read', color: '#0284C7' },
    write:         { label: '─── Write', color: '#DC2626' },
    bidirectional: { label: '◄─► Bidirectional', color: '#374151' },
  }

  const s = styles[type]
  return (
    <div className="flex items-center gap-2">
      <svg width="40" height="12">
        <line
          x1="0" y1="6" x2="40" y2="6"
          stroke={s.color}
          strokeWidth={type === 'replication' ? 3 : 1.5}
          strokeDasharray={s.dash}
        />
      </svg>
      <span className="text-xs text-gray-600">{s.label}</span>
    </div>
  )
}
