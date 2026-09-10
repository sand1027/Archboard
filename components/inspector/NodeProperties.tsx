'use client'

import { useCallback } from 'react'
import { Copy, Trash2, Link } from 'lucide-react'
import Image from 'next/image'
import { useDiagramStore } from '@/store/diagramStore'
import { useHistoryStore } from '@/store/historyStore'
import { getComponentById } from '@/data/components'
import type { ArchitectureNodeData } from '@/types/architecture'
import type { Node } from '@xyflow/react'

type ArchitectureNodeFull = Node<ArchitectureNodeData, 'architecture'>

interface NodePropertiesProps {
  node: ArchitectureNodeFull
}

export default function NodeProperties({ node }: NodePropertiesProps) {
  const { updateNode, deleteNode, duplicateNodes, edges } = useDiagramStore()
  const { pushSnapshot } = useHistoryStore()

  const component = getComponentById(node.data.componentId)
  const connectionCount = edges.filter(
    (e) => e.source === node.id || e.target === node.id
  ).length

  const handleLabelChange = useCallback(
    (value: string) => {
      updateNode(node.id, { label: value } as Partial<ArchitectureNodeData>)
    },
    [node.id, updateNode]
  )

  const handleDelete = useCallback(() => {
    const { nodes: n, edges: e } = useDiagramStore.getState()
    pushSnapshot({ nodes: n, edges: e })
    deleteNode(node.id)
  }, [node.id, deleteNode, pushSnapshot])

  const handleDuplicate = useCallback(() => {
    const { nodes: n, edges: e } = useDiagramStore.getState()
    pushSnapshot({ nodes: n, edges: e })
    duplicateNodes([node.id])
  }, [node.id, duplicateNodes, pushSnapshot])

  return (
    <div className="divide-y divide-slate-100">
      {/* Node header */}
      <div className="p-4 flex items-start gap-3">
        <div className="relative w-10 h-10 flex-shrink-0 bg-slate-50 rounded-xl border border-slate-100 p-1.5 flex items-center justify-center">
          <Image
            src={node.data.icon}
            alt={node.data.label}
            width={32}
            height={32}
            className="w-8 h-8 object-contain"
            unoptimized
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
            {node.data.provider ? `${node.data.provider} · ` : ''}
            {node.data.category}
          </p>
          <p className="text-sm font-semibold text-slate-900 truncate">{node.data.label}</p>
        </div>
      </div>

      {/* Label editor */}
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Label
          </label>
          <input
            type="text"
            value={node.data.label}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="field-input"
          />
        </div>

        {node.data.subtitle !== undefined && (
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Subtitle
            </label>
            <input
              type="text"
              value={node.data.subtitle ?? ''}
              onChange={(e) => updateNode(node.id, { subtitle: e.target.value } as any)}
              placeholder="Optional subtitle"
              className="field-input"
            />
          </div>
        )}
      </div>

      {/* Component info */}
      <div className="p-4 space-y-3">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Component
        </p>

        <InfoRow label="Name" value={component?.name ?? node.data.componentId} />
        <InfoRow label="Category" value={node.data.category} capitalize />
        {node.data.provider && (
          <InfoRow label="Provider" value={node.data.provider.toUpperCase()} />
        )}
        {component?.description && (
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Description</p>
            <p className="text-xs text-slate-600 leading-relaxed">{component.description}</p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Link className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500">
            {connectionCount} connection{connectionCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Position info */}
      <div className="p-4 space-y-3">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Position
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">X</label>
            <input
              type="number"
              value={Math.round(node.position.x)}
              readOnly
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-600"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Y</label>
            <input
              type="number"
              value={Math.round(node.position.y)}
              readOnly
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-600"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 space-y-2">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Actions
        </p>
        <button
          onClick={handleDuplicate}
          className="w-full flex items-center gap-2 py-2 px-3 text-sm text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors"
        >
          <Copy className="w-4 h-4" />
          Duplicate
        </button>
        <button
          onClick={handleDelete}
          className="w-full flex items-center gap-2 py-2 px-3 text-sm text-red-600 bg-red-50 hover:bg-red-100/80 border border-red-200 rounded-xl transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
  capitalize,
}: {
  label: string
  value: string
  capitalize?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-400">{label}</span>
      <span
        className={`text-xs font-medium text-slate-700 truncate ${capitalize ? 'capitalize' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}
