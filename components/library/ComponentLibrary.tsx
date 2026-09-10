'use client'

import { useMemo, useCallback } from 'react'
import { Search, ChevronRight, Clock, Package } from 'lucide-react'
import { useUiStore } from '@/store/uiStore'
import { useDiagramStore } from '@/store/diagramStore'
import {
  componentRegistry,
  searchComponents,
  getComponentsByCategory,
  getComponentsByProvider,
} from '@/data/components'
import type { ArchitectureComponent, ComponentCategory, Provider } from '@/types/architecture'
import type { ArchitectureNode } from '@/types/diagram'
import ComponentItem from './ComponentItem'

const CATEGORIES: { id: ComponentCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'clients', label: 'Clients' },
  { id: 'networking', label: 'Networking' },
  { id: 'compute', label: 'Compute' },
  { id: 'services', label: 'Services' },
  { id: 'databases', label: 'Databases' },
  { id: 'storage', label: 'Storage' },
  { id: 'caching', label: 'Caching' },
  { id: 'messaging', label: 'Messaging' },
  { id: 'observability', label: 'Observability' },
  { id: 'security', label: 'Security' },
]

const PROVIDERS: { id: Provider; label: string; color: string }[] = [
  { id: 'aws', label: 'AWS', color: '#FF9900' },
  { id: 'gcp', label: 'GCP', color: '#4285F4' },
  { id: 'azure', label: 'Azure', color: '#0078D4' },
  { id: 'kubernetes', label: 'K8s', color: '#326CE5' },
]

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function ComponentLibrary() {
  const { searchQuery, setSearchQuery, activeCategory, setActiveCategory, recentlyUsed, addRecentlyUsed } = useUiStore()
  const { addNode, nodes } = useDiagramStore()

  const filteredComponents = useMemo(() => {
    if (searchQuery.trim()) {
      return searchComponents(searchQuery)
    }
    if (activeCategory === 'all') {
      return componentRegistry
    }
    if (activeCategory === 'recent') {
      return recentlyUsed
        .map((id) => componentRegistry.find((c) => c.id === id))
        .filter(Boolean) as ArchitectureComponent[]
    }
    // Check if it's a provider
    if (['aws', 'gcp', 'azure', 'kubernetes', 'generic'].includes(activeCategory)) {
      return getComponentsByProvider(activeCategory as Provider)
    }
    return getComponentsByCategory(activeCategory as ComponentCategory)
  }, [searchQuery, activeCategory, recentlyUsed])

  const addToCanvas = useCallback(
    (component: ArchitectureComponent) => {
      // Find a good position (avoid stacking on existing nodes)
      const offset = nodes.length * 20
      const node: ArchitectureNode = {
        id: generateId(),
        type: 'architecture',
        position: { x: 300 + (offset % 200), y: 200 + (offset % 200) },
        data: {
          componentId: component.id,
          label: component.name,
          category: component.category,
          provider: component.provider,
          icon: component.icon,
          description: component.description,
        },
      }
      addNode(node)
      addRecentlyUsed(component.id)
    },
    [addNode, addRecentlyUsed, nodes.length]
  )

  return (
    <div className="flex flex-col h-full bg-gray-50 border-r border-gray-200">
      {/* Search */}
      <div className="p-3 border-b border-gray-200 bg-white">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search components…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              placeholder-gray-400 text-gray-800"
          />
        </div>
      </div>

      {/* Category nav */}
      {!searchQuery && (
        <div className="border-b border-gray-200 bg-white">
          {/* Recently used */}
          {recentlyUsed.length > 0 && (
            <button
              onClick={() => setActiveCategory('recent')}
              className={[
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                activeCategory === 'recent'
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50',
              ].join(' ')}
            >
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Recently Used</span>
            </button>
          )}

          {/* Provider groups */}
          <div className="px-3 pt-2 pb-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Cloud Providers
            </p>
            <div className="flex flex-wrap gap-1 mb-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActiveCategory(p.id)}
                  className={[
                    'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                    activeCategory === p.id
                      ? 'text-white'
                      : 'text-gray-600 bg-gray-100 hover:bg-gray-200',
                  ].join(' ')}
                  style={
                    activeCategory === p.id
                      ? { backgroundColor: p.color }
                      : {}
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Generic categories */}
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Generic
            </p>
            <div className="flex flex-col">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={[
                    'flex items-center justify-between px-2 py-1.5 rounded text-xs text-left transition-colors',
                    activeCategory === cat.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <span>{cat.label}</span>
                  {activeCategory === cat.id && (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Component list */}
      <div className="flex-1 overflow-y-auto p-2">
        {searchQuery && (
          <p className="text-xs text-gray-400 px-1 mb-2">
            {filteredComponents.length} result{filteredComponents.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
          </p>
        )}

        {filteredComponents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-400">No components found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {filteredComponents.map((comp) => (
              <ComponentItem
                key={comp.id}
                component={comp}
                onAdd={addToCanvas}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
