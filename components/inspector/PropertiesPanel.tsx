'use client'

import { useDiagramStore } from '@/store/diagramStore'
import { useHistoryStore } from '@/store/historyStore'
import NodeProperties from './NodeProperties'
import EdgeProperties from './EdgeProperties'
import { Layers } from 'lucide-react'

export default function PropertiesPanel() {
  const { nodes, edges, selectedNodeIds, selectedEdgeIds } = useDiagramStore()

  const selectedNode = selectedNodeIds.length === 1
    ? nodes.find((n) => n.id === selectedNodeIds[0])
    : null

  const selectedEdge = selectedEdgeIds.length === 1
    ? edges.find((e) => e.id === selectedEdgeIds[0])
    : null

  const multiSelected = selectedNodeIds.length > 1

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Properties
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selectedNode && selectedNode.type === 'architecture' && (
          <NodeProperties node={selectedNode as any} />
        )}

        {selectedNode && selectedNode.type === 'frame' && (
          <FrameNodePropertiesInline node={selectedNode as any} />
        )}

        {selectedEdge && (
          <EdgeProperties edge={selectedEdge} />
        )}

        {multiSelected && (
          <MultiSelectInfo count={selectedNodeIds.length} />
        )}

        {!selectedNode && !selectedEdge && !multiSelected && (
          <EmptyState />
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
        <Layers className="w-5 h-5 text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-500 mb-1">Nothing selected</p>
      <p className="text-xs text-gray-400">
        Click a component or connection to inspect its properties
      </p>
    </div>
  )
}

function MultiSelectInfo({ count }: { count: number }) {
  const { duplicateNodes, deleteSelected, selectedNodeIds } = useDiagramStore()

  return (
    <div className="p-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <p className="text-sm font-medium text-blue-700">{count} components selected</p>
      </div>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => {
            useDiagramStore.getState().copySelected()
          }}
          className="w-full py-2 px-3 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors text-left"
        >
          Copy selection
        </button>
        <button
          onClick={() => {
            const { nodes: n, edges: e } = useDiagramStore.getState()
            useHistoryStore.getState().pushSnapshot({ nodes: n, edges: e })
            duplicateNodes(selectedNodeIds)
          }}
          className="w-full py-2 px-3 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors text-left"
        >
          Duplicate
        </button>
        <button
          onClick={() => {
            const { nodes: n, edges: e } = useDiagramStore.getState()
            useHistoryStore.getState().pushSnapshot({ nodes: n, edges: e })
            deleteSelected()
          }}
          className="w-full py-2 px-3 text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors text-left"
        >
          Delete selected
        </button>
      </div>
    </div>
  )
}

function FrameNodePropertiesInline({ node }: { node: any }) {
  const { updateNode, deleteNode } = useDiagramStore()

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
        <input
          type="text"
          value={node.data.label}
          onChange={(e) => updateNode(node.id, { label: e.target.value } as any)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Frame Type</label>
        <p className="text-sm text-gray-800 capitalize">{node.data.frameType.replace('-', ' ')}</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
        <input
          type="text"
          value={node.data.description ?? ''}
          onChange={(e) => updateNode(node.id, { description: e.target.value } as any)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Optional description"
        />
      </div>
      <div className="pt-2 border-t border-gray-100">
        <button
          onClick={() => deleteNode(node.id)}
          className="w-full py-2 px-3 text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
        >
          Delete Frame
        </button>
      </div>
    </div>
  )
}
