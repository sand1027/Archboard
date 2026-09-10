'use client'

import { useMemo, useCallback } from 'react'
import { Search, Clock, Package } from 'lucide-react'
import { useUiStore } from '@/store/uiStore'
import { useDiagramStore } from '@/store/diagramStore'
import {
  componentRegistry,
  searchComponents,
  getComponentsByCategory,
  getComponentsByProvider,
} from '@/data/components'
import { getLldByTab, searchLldCatalog } from '@/data/lld'
import { spawnLldNode } from '@/lib/spawnLldNode'
import type { ArchitectureComponent, ComponentCategory, Provider } from '@/types/architecture'
import type { ArchitectureNode } from '@/types/diagram'
import type { LldCatalogItem, LldLibraryTab } from '@/types/lld'
import ComponentItem from './ComponentItem'
import LldItem from './LldItem'

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

const LLD_TABS: { id: LldLibraryTab; label: string }[] = [
  { id: 'flowchart', label: 'Flow' },
  { id: 'uml', label: 'UML' },
  { id: 'er', label: 'ER' },
  { id: 'sequence', label: 'Seq' },
  { id: 'icons', label: 'Icons' },
]

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function ComponentLibrary() {
  const {
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    recentlyUsed,
    addRecentlyUsed,
    boardMode,
    lldLibraryTab,
    setLldLibraryTab,
  } = useUiStore()
  const { addNode, nodes } = useDiagramStore()

  const isLld = boardMode === 'lld'

  const filteredComponents = useMemo(() => {
    if (searchQuery.trim()) return searchComponents(searchQuery)
    if (activeCategory === 'all') return componentRegistry
    if (activeCategory === 'recent') {
      return recentlyUsed
        .map((id) => componentRegistry.find((c) => c.id === id))
        .filter(Boolean) as ArchitectureComponent[]
    }
    if (['aws', 'gcp', 'azure', 'kubernetes', 'generic'].includes(activeCategory)) {
      return getComponentsByProvider(activeCategory as Provider)
    }
    return getComponentsByCategory(activeCategory as ComponentCategory)
  }, [searchQuery, activeCategory, recentlyUsed])

  const filteredLld = useMemo(() => {
    if (searchQuery.trim()) return searchLldCatalog(searchQuery)
    return getLldByTab(lldLibraryTab)
  }, [searchQuery, lldLibraryTab])

  const addToCanvas = useCallback(
    (component: ArchitectureComponent) => {
      const offset = nodes.length * 20
      const node: ArchitectureNode = {
        id: generateId(),
        type: 'architecture',
        position: { x: 300 + (offset % 200), y: 200 + (offset % 200) },
        width: 72,
        height: 88,
        style: { width: 72, height: 88 },
        connectable: false,
        zIndex: 10,
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

  const addLldToCanvas = useCallback(
    (item: LldCatalogItem) => {
      const offset = nodes.length * 24
      const node = spawnLldNode(item, {
        x: 360 + (offset % 220),
        y: 220 + (offset % 180),
      })
      addNode(node)
      addRecentlyUsed(item.id)
    },
    [addNode, addRecentlyUsed, nodes.length]
  )

  return (
    <div className="flex flex-col h-full bg-slate-50/80">
      <div className="px-3 pt-3 pb-2.5 border-b border-slate-200/80 bg-white">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-0.5">
          {isLld ? 'LLD Library' : 'Components'}
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
          <input
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl
              focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300
              placeholder-slate-400 text-slate-800"
          />
        </div>
      </div>

      {!searchQuery && isLld && (
        <div className="border-b border-slate-200/80 bg-white px-3 py-2.5 shrink-0">
          <div className="flex flex-wrap gap-1">
            {LLD_TABS.map((tab) => {
              const active = lldLibraryTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setLldLibraryTab(tab.id)}
                  className={[
                    'px-2 py-1 rounded-md text-[11px] font-medium transition-all border',
                    active
                      ? 'bg-slate-900 text-white border-transparent'
                      : 'text-slate-600 bg-slate-50 border-slate-200 hover:border-slate-300',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {!searchQuery && !isLld && (
        <div className="border-b border-slate-200/80 bg-white px-3 py-2.5 space-y-3 shrink-0 max-h-[42%] overflow-y-auto">
          {recentlyUsed.length > 0 && (
            <button
              onClick={() => setActiveCategory('recent')}
              className={[
                'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors',
                activeCategory === 'recent'
                  ? 'bg-slate-900 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              <Clock className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
              <span>Recently used</span>
            </button>
          )}

          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">
              Providers
            </p>
            <div className="flex flex-wrap gap-1">
              {PROVIDERS.map((p) => {
                const active = activeCategory === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setActiveCategory(p.id)}
                    className={[
                      'px-2 py-1 rounded-md text-[11px] font-medium transition-all border',
                      active
                        ? 'text-white border-transparent shadow-sm'
                        : 'text-slate-600 bg-slate-50 border-slate-200 hover:border-slate-300',
                    ].join(' ')}
                    style={active ? { backgroundColor: p.color } : undefined}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">
              Categories
            </p>
            <div className="flex flex-col gap-0.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={[
                    'flex items-center px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors',
                    activeCategory === cat.id
                      ? 'bg-slate-900 text-white font-medium'
                      : 'text-slate-600 hover:bg-slate-100',
                  ].join(' ')}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2.5">
        {isLld ? (
          filteredLld.length === 0 ? (
            <EmptyLibrary label="No LLD items" />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredLld.map((item) => (
                <LldItem key={item.id} item={item} onAdd={addLldToCanvas} />
              ))}
            </div>
          )
        ) : filteredComponents.length === 0 ? (
          <EmptyLibrary label="No components" />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredComponents.map((comp) => (
              <ComponentItem key={comp.id} component={comp} onAdd={addToCanvas} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyLibrary({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-4">
      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2.5">
        <Package className="w-4 h-4 text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">Try another search or category</p>
    </div>
  )
}
