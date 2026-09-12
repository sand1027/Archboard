/**
 * Auto-suggest: pick starting diagrams from an HLD component's type.
 *
 * Pure function of (component, hldNodes, hldEdges) so it is testable with no
 * store and no DOM. Rules compound — an API Gateway with connections gets all
 * three diagram types.
 */

import { generateId } from '@/lib/canvas/ids'
import { emptyDiagram, type LldDiagram, type LldDiagramType } from '@/types/lld'
import type { ArchitectureEdge, ArchitectureNode } from '@/types/diagram'
import type { ComponentCategory } from '@/types/architecture'
import { LLD_DIAGRAM_SPECS } from './specs'

const ER_CATEGORIES: ComponentCategory[] = [
  'databases',
  'db-internals',
  'sharding',
  'storage',
  'replication',
]

const API_CATEGORIES: ComponentCategory[] = ['compute', 'services', 'networking']

const ER_KEYWORDS = [
  'database',
  'shard',
  'postgres',
  'mysql',
  'mongo',
  'dynamo',
  'table',
  'sql',
  'store',
  'warehouse',
]

const API_KEYWORDS = [
  'service',
  'server',
  'gateway',
  'api',
  'lambda',
  'function',
  'endpoint',
  'backend',
  'worker',
  'handler',
]

function haystack(node: ArchitectureNode): string {
  const d = node.data as Record<string, unknown>
  return [d.label, d.componentId, d.subtitle, d.description]
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
    .toLowerCase()
}

function category(node: ArchitectureNode): ComponentCategory | undefined {
  const c = (node.data as Record<string, unknown>).category
  return typeof c === 'string' ? (c as ComponentCategory) : undefined
}

export function wantsEr(node: ArchitectureNode): boolean {
  const cat = category(node)
  if (cat && ER_CATEGORIES.includes(cat)) return true
  const text = haystack(node)
  return ER_KEYWORDS.some((k) => text.includes(k))
}

const USECASE_CATEGORIES: ComponentCategory[] = ['clients', 'actors', 'external']

const USECASE_KEYWORDS = ['client', 'user', 'browser', 'mobile', 'app', 'portal', 'gateway']

export function wantsUseCase(node: ArchitectureNode): boolean {
  const cat = category(node)
  if (cat && USECASE_CATEGORIES.includes(cat)) return true
  const text = haystack(node)
  return USECASE_KEYWORDS.some((k) => text.includes(k))
}

export function wantsApi(node: ArchitectureNode): boolean {
  const cat = category(node)
  if (cat && API_CATEGORIES.includes(cat)) return true
  const text = haystack(node)
  return API_KEYWORDS.some((k) => text.includes(k))
}

/** HLD nodes directly connected to `component`, deduplicated, in edge order. */
export function connectedComponents(
  component: ArchitectureNode,
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[]
): ArchitectureNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const seen = new Set<string>()
  const out: ArchitectureNode[] = []

  for (const edge of edges) {
    let peerId: string | null = null
    if (edge.source === component.id) peerId = edge.target
    else if (edge.target === component.id) peerId = edge.source
    if (!peerId || seen.has(peerId)) continue

    const peer = byId.get(peerId)
    // Only architecture components make sense as sequence participants.
    if (!peer || peer.type !== 'architecture') continue

    seen.add(peerId)
    out.push(peer)
  }

  return out
}

/**
 * Which diagram types a component should start with, in landing order.
 *
 * The first entry becomes the active tab, so this ordering is what the component
 * picker promises. Shared with the picker so the preview and the workspace
 * cannot drift apart.
 */
export function suggestedDiagramTypes(
  component: ArchitectureNode,
  connectedCount: number
): LldDiagramType[] {
  const out: LldDiagramType[] = []

  // Anything users talk to directly leads with its use cases — that is the
  // requirements view, and it is the natural starting point for a front door.
  if (wantsUseCase(component)) out.push('usecase')

  // Data stores lead with their schema.
  if (wantsEr(component)) out.push('er')

  // Services lead with their contract, then their internal types.
  if (wantsApi(component)) {
    out.push('api', 'class')
  }

  // Anything wired into the HLD graph gets an interaction diagram too.
  if (connectedCount > 0) out.push('sequence')

  return out
}

/**
 * Build the initial diagram set. An empty array means "no suggestion" — the
 * workspace then starts with one blank diagram (see lldStore).
 */
export function seedWorkspace(
  component: ArchitectureNode,
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[]
): LldDiagram[] {
  const connected = connectedComponents(component, nodes, edges)
  const ctx = { component, connected }

  return suggestedDiagramTypes(component, connected.length).map((type) => {
    const spec = LLD_DIAGRAM_SPECS[type]
    const seeded = spec.seed(ctx)
    return {
      ...emptyDiagram(generateId(), type, spec.label),
      shapes: seeded.shapes,
      edges: seeded.edges,
    }
  })
}
