'use client'

import { useDiagramStore } from '@/store/diagramStore'
import { useHistoryStore } from '@/store/historyStore'
import NodeProperties from './NodeProperties'
import EdgeProperties from './EdgeProperties'
import ShapeProperties from './ShapeProperties'
import {
  UmlClassProperties,
  UmlEntityProperties,
  UmlLifelineProperties,
  IconNodeProperties,
} from './LldProperties'
import { MousePointer2 } from 'lucide-react'

export default function PropertiesPanel() {
  const { nodes, edges, selectedNodeIds, selectedEdgeIds } = useDiagramStore()

  const selectedNode =
    selectedNodeIds.length === 1 ? nodes.find((n) => n.id === selectedNodeIds[0]) : null

  const selectedEdge =
    selectedEdgeIds.length === 1 ? edges.find((e) => e.id === selectedEdgeIds[0]) : null

  const multiSelected = selectedNodeIds.length > 1

  const subtitle = selectedNode
    ? selectedNode.type === 'shape'
      ? String((selectedNode.data as { shapeType?: string }).shapeType ?? 'shape').replace(/-/g, ' ')
      : selectedNode.type === 'frame'
        ? 'Frame'
        : selectedNode.type === 'umlClass'
          ? 'UML Class'
          : selectedNode.type === 'umlEntity'
            ? 'ER Entity'
            : selectedNode.type === 'umlLifeline'
              ? 'Lifeline'
              : selectedNode.type === 'icon'
                ? 'Icon'
                : (selectedNode.data as { label?: string }).label ?? 'Component'
    : selectedEdge
      ? 'Connection'
      : multiSelected
        ? `${selectedNodeIds.length} selected`
        : null

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3 border-b border-slate-200/80 bg-slate-50/80">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Properties
        </p>
        {subtitle && (
          <p className="text-sm font-semibold text-slate-800 capitalize mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedNode?.type === 'architecture' && (
          <NodeProperties node={selectedNode as any} />
        )}
        {selectedNode?.type === 'frame' && (
          <FrameNodePropertiesInline node={selectedNode as any} />
        )}
        {selectedNode?.type === 'shape' && (
          <ShapeProperties node={selectedNode as any} />
        )}
        {selectedNode?.type === 'umlClass' && (
          <UmlClassProperties node={selectedNode} />
        )}
        {selectedNode?.type === 'umlEntity' && (
          <UmlEntityProperties node={selectedNode} />
        )}
        {selectedNode?.type === 'umlLifeline' && (
          <UmlLifelineProperties node={selectedNode} />
        )}
        {selectedNode?.type === 'icon' && (
          <IconNodeProperties node={selectedNode} />
        )}
        {selectedEdge && <EdgeProperties edge={selectedEdge} />}
        {multiSelected && <MultiSelectInfo count={selectedNodeIds.length} />}
        {!selectedNode && !selectedEdge && !multiSelected && <EmptyState />}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
      <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
        <MousePointer2 className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-600 mb-1">Nothing selected</p>
      <p className="text-xs text-slate-400 leading-relaxed max-w-[180px]">
        Select a component, shape, or connection to edit its properties
      </p>
    </div>
  )
}

function MultiSelectInfo({ count }: { count: number }) {
  const { duplicateNodes, deleteSelected, selectedNodeIds } = useDiagramStore()

  return (
    <div className="p-4 space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p className="text-sm font-medium text-slate-800">{count} items selected</p>
      </div>
      <button
        onClick={() => useDiagramStore.getState().copySelected()}
        className="w-full py-2 px-3 text-sm text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors text-left"
      >
        Copy
      </button>
      <button
        onClick={() => {
          const { nodes: n, edges: e } = useDiagramStore.getState()
          useHistoryStore.getState().pushSnapshot({ nodes: n, edges: e })
          duplicateNodes(selectedNodeIds)
        }}
        className="w-full py-2 px-3 text-sm text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors text-left"
      >
        Duplicate
      </button>
      <button
        onClick={() => {
          const { nodes: n, edges: e } = useDiagramStore.getState()
          useHistoryStore.getState().pushSnapshot({ nodes: n, edges: e })
          deleteSelected()
        }}
        className="w-full py-2 px-3 text-sm text-red-600 bg-red-50 hover:bg-red-100/80 border border-red-200 rounded-xl transition-colors text-left"
      >
        Delete
      </button>
    </div>
  )
}

function FrameNodePropertiesInline({ node }: { node: any }) {
  const { updateNode, deleteNode } = useDiagramStore()

  return (
    <div className="p-4 space-y-4">
      <Field label="Label">
        <input
          type="text"
          value={node.data.label}
          onChange={(e) => updateNode(node.id, { label: e.target.value } as any)}
          className="field-input"
        />
      </Field>
      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
          Frame type
        </p>
        <p className="text-sm text-slate-800 capitalize">
          {String(node.data.frameType).replace(/-/g, ' ')}
        </p>
      </div>
      <Field label="Description">
        <input
          type="text"
          value={node.data.description ?? ''}
          onChange={(e) => updateNode(node.id, { description: e.target.value } as any)}
          className="field-input"
          placeholder="Optional"
        />
      </Field>
      <button
        onClick={() => deleteNode(node.id)}
        className="w-full py-2 px-3 text-sm text-red-600 bg-red-50 hover:bg-red-100/80 border border-red-200 rounded-xl transition-colors"
      >
        Delete frame
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}
