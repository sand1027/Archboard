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
import type { ArchitectureComponent, ComponentCategory, Provider } from '@/types/architecture'
import type { ArchitectureNode } from '@/types/diagram'
import ComponentItem from './ComponentItem'
import ConnectorPresets from './ConnectorPresets'

const CATEGORIES: { id: ComponentCategory | 'all'; label: string; group: string }[] = [
  { id: 'all',              label: 'All',                  group: 'browse' },
  // Core
  { id: 'clients',          label: 'Clients',              group: 'core' },
  { id: 'networking',       label: 'Networking',           group: 'core' },
  { id: 'compute',          label: 'Compute',              group: 'core' },
  { id: 'services',         label: 'Services',             group: 'core' },
  { id: 'databases',        label: 'Databases',            group: 'core' },
  { id: 'storage',          label: 'Storage',              group: 'core' },
  { id: 'caching',          label: 'Caching',              group: 'core' },
  { id: 'messaging',        label: 'Messaging',            group: 'core' },
  { id: 'observability',    label: 'Observability',        group: 'core' },
  { id: 'security',         label: 'Security',             group: 'core' },
  // Deep-dive
  { id: 'sharding',         label: 'Sharding',             group: 'deep' },
  { id: 'rate-limiting',    label: 'Rate Limiting',        group: 'deep' },
  { id: 'caching-patterns', label: 'Cache Patterns',       group: 'deep' },
  { id: 'replication',      label: 'Replication',          group: 'deep' },
  { id: 'load-balancing',   label: 'Load Balancing',       group: 'deep' },
  { id: 'streaming',        label: 'Streaming',            group: 'deep' },
  { id: 'consistency',      label: 'Consistency',          group: 'deep' },
  { id: 'resilience',       label: 'Resilience',           group: 'deep' },
  { id: 'db-internals',     label: 'DB Internals',         group: 'deep' },
  // System
  { id: 'patterns',         label: 'Arch Patterns',        group: 'system' },
  { id: 'infra-devops',     label: 'Infra / DevOps',       group: 'system' },
  { id: 'external',         label: 'External',             group: 'system' },
  { id: 'actors',           label: 'Actors',               group: 'system' },
]

/** How each provider is presented, if it has anything to show. */
const PROVIDER_STYLE: Partial<Record<Provider, { label: string; color: string }>> = {
  aws: { label: 'AWS', color: '#FF9900' },
  gcp: { label: 'GCP', color: '#4285F4' },
  azure: { label: 'Azure', color: '#0078D4' },
  kubernetes: { label: 'K8s', color: '#326CE5' },
  generic: { label: 'Generic', color: '#64748B' },
}

/** Tab order, for the ones that turn out to be present. */
const PROVIDER_ORDER: Provider[] = ['aws', 'gcp', 'azure', 'kubernetes', 'generic']

/**
 * Providers the registry actually has components for.
 *
 * The list used to be hardcoded, so GCP, Azure and K8s rendered as tabs that filtered to
 * nothing — three buttons whose only effect was to empty the panel. Deriving it means a tab
 * appears the moment someone adds a component for that provider, and can never be empty.
 */
const PROVIDERS = PROVIDER_ORDER.filter(
  (id) => getComponentsByProvider(id).length > 0
).map((id) => ({ id, ...PROVIDER_STYLE[id]! }))

// "ByteByteGo" is a tag-based filter, not a provider — handled specially
const BBG_TAG = 'bbg'

const HAS_BBG = componentRegistry.some((c) => c.tags.includes(BBG_TAG))

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
  } = useUiStore()
  const { addNode, nodes } = useDiagramStore()


  const filteredComponents = useMemo(() => {
    if (searchQuery.trim()) return searchComponents(searchQuery)
    if (activeCategory === 'all') return componentRegistry
    if (activeCategory === BBG_TAG) {
      return componentRegistry.filter((c) => c.tags.includes(BBG_TAG))
    }
    if (activeCategory === 'recent') {
      return recentlyUsed
        .map((id) => componentRegistry.find((c) => c.id === id))
        .filter(Boolean) as ArchitectureComponent[]
    }
    // Matched against the tabs that exist rather than a second hardcoded list, so the two
    // cannot disagree about what counts as a provider.
    if (PROVIDERS.some((p) => p.id === activeCategory)) {
      return getComponentsByProvider(activeCategory as Provider)
    }
    return getComponentsByCategory(activeCategory as ComponentCategory)
  }, [searchQuery, activeCategory, recentlyUsed])

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
        connectable: true,
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

  return (
    <div className="flex flex-col h-full bg-slate-50/80">
      <div className="px-3 pt-3 pb-2.5 border-b border-slate-200/80 bg-white">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-0.5">
          Components
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

            {!searchQuery && (
        <div className="border-b border-slate-200/80 bg-white px-3 py-2.5 space-y-3 shrink-0 max-h-[52%] overflow-y-auto">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">
              Connections
            </p>
            <ConnectorPresets />
          </div>

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

          {/* Hidden entirely when there is nothing to filter by. */}
          {(PROVIDERS.length > 0 || HAS_BBG) && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">
              Providers
            </p>
            <div className="flex flex-wrap gap-1">
              {/* ByteByteGo filter */}
              {HAS_BBG && (
              <button
                onClick={() => setActiveCategory(BBG_TAG)}
                className={[
                  'px-2 py-1 rounded-md text-[11px] font-medium transition-all border',
                  activeCategory === BBG_TAG
                    ? 'bg-slate-700 text-white border-transparent shadow-sm'
                    : 'text-slate-600 bg-slate-50 border-slate-200 hover:border-slate-300',
                ].join(' ')}
              >
                BBG
              </button>
              )}
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
          )}

          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">
              Categories
            </p>
            <div className="flex flex-col gap-0.5">
              {/* All */}
              {CATEGORIES.filter((c) => c.group === 'browse').map((cat) => (
                <CategoryBtn key={cat.id} cat={cat} active={activeCategory === cat.id} onClick={setActiveCategory} />
              ))}

              <p className="text-[9px] font-semibold text-slate-300 uppercase tracking-wider px-0.5 pt-2 pb-0.5">Core</p>
              {CATEGORIES.filter((c) => c.group === 'core').map((cat) => (
                <CategoryBtn key={cat.id} cat={cat} active={activeCategory === cat.id} onClick={setActiveCategory} />
              ))}

              <p className="text-[9px] font-semibold text-slate-300 uppercase tracking-wider px-0.5 pt-2 pb-0.5">Deep Dive</p>
              {CATEGORIES.filter((c) => c.group === 'deep').map((cat) => (
                <CategoryBtn key={cat.id} cat={cat} active={activeCategory === cat.id} onClick={setActiveCategory} />
              ))}

              <p className="text-[9px] font-semibold text-slate-300 uppercase tracking-wider px-0.5 pt-2 pb-0.5">System</p>
              {CATEGORIES.filter((c) => c.group === 'system').map((cat) => (
                <CategoryBtn key={cat.id} cat={cat} active={activeCategory === cat.id} onClick={setActiveCategory} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2.5">
        {filteredComponents.length === 0 ? (
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

function CategoryBtn({
  cat,
  active,
  onClick,
}: {
  cat: { id: ComponentCategory | 'all'; label: string; group: string }
  active: boolean
  onClick: (id: ComponentCategory | Provider | 'all' | 'recent') => void
}) {
  return (
    <button
      onClick={() => onClick(cat.id)}
      className={[
        'flex items-center px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors',
        active
          ? 'bg-slate-900 text-white font-medium'
          : 'text-slate-600 hover:bg-slate-100',
      ].join(' ')}
    >
      {cat.label}
    </button>
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
