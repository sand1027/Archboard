import type { Connection } from '@xyflow/react'
import type { ArchitectureEdgeData } from '@/types/architecture'
import { BEHAVIORS } from '@/data/components/behaviors'
import { getComponentById } from '@/data/components'

/**
 * Infer edge label, protocol, and connectionType when an arrow is drawn.
 *
 * Logic:
 *   1. Look up source component's behavior.outbound
 *   2. Look up target component's behavior.inbound
 *   3. Combine to produce a meaningful label + protocol + connectionType
 *   4. If no behavior data, use sensible defaults from category
 *
 * Returns partial ArchitectureEdgeData to merge into the new edge.
 */
export function inferConnection(
  connection: Connection,
  nodes: { id: string; data: unknown; type?: string }[],
): Partial<ArchitectureEdgeData> {
  const srcNode = nodes.find((n) => n.id === connection.source)
  const tgtNode = nodes.find((n) => n.id === connection.target)

  if (!srcNode || !tgtNode) return defaultEdge()

  const srcData = srcNode.data as Record<string, unknown>
  const tgtData = tgtNode.data as Record<string, unknown>

  const srcComponentId = srcData?.componentId as string | undefined
  const tgtComponentId = tgtData?.componentId as string | undefined

  // Get behaviors
  const srcBehavior = srcComponentId ? BEHAVIORS[srcComponentId] : undefined
  const tgtBehavior = tgtComponentId ? BEHAVIORS[tgtComponentId] : undefined

  // Get component registry entries for category fallback
  const srcComponent = srcComponentId ? getComponentById(srcComponentId) : undefined
  const tgtComponent = tgtComponentId ? getComponentById(tgtComponentId) : undefined

  // ── Case 1: both have behaviors → use outbound from source ─────────────────
  if (srcBehavior) {
    const out = srcBehavior.outbound
    const label = buildLabel(srcBehavior, tgtBehavior, srcComponent?.name, tgtComponent?.name)

    return {
      label,
      protocol: out.protocol as ArchitectureEdgeData['protocol'],
      connectionType: out.connectionType,
      animated: srcBehavior.sim?.async ?? false,
    }
  }

  // ── Case 2: only target has behavior → use inbound hint ────────────────────
  if (tgtBehavior) {
    const inb = tgtBehavior.inbound
    return {
      label: inb.dataHint ?? inb.flowLabel,
      protocol: inb.protocol as ArchitectureEdgeData['protocol'],
      connectionType: inb.connectionType,
      animated: false,
    }
  }

  // ── Case 3: no behavior data → infer from node types/categories ────────────
  return inferFromCategory(srcData, tgtData)
}

// ─── Label builder ────────────────────────────────────────────────────────────

function buildLabel(
  src: import('@/types/architecture').ComponentBehavior | undefined,
  tgt: import('@/types/architecture').ComponentBehavior | undefined,
  srcName?: string,
  tgtName?: string,
): string {
  if (!src) return ''

  const out = src.outbound

  // Pattern-specific label overrides
  const srcPattern = src.pattern
  const tgtPattern = tgt?.pattern

  // Special pairings
  if (srcPattern === 'client' && tgtPattern === 'dns-resolution') return 'domain query'
  if (srcPattern === 'dns-resolution' && (tgtPattern === 'caching' || tgtPattern === 'load-balancing')) return 'IP address'
  if (srcPattern === 'caching' && tgtPattern === 'load-balancing') return 'CDN miss'
  if (srcPattern === 'load-balancing') return 'routed request'
  if (srcPattern === 'api-gateway') return 'API request'
  if (srcPattern === 'pub-sub' && tgtPattern === 'async-worker') return 'message'
  if (srcPattern === 'message-queue' && tgtPattern === 'async-worker') return 'job'
  if (srcPattern === 'compute' && tgtPattern === 'caching') return 'cache lookup'
  if (srcPattern === 'caching' && tgtPattern === 'rdbms') return 'cache miss → DB'
  if (srcPattern === 'compute' && tgtPattern === 'rdbms') return 'SQL query'
  if (srcPattern === 'compute' && tgtPattern === 'nosql') return 'document query'
  if (srcPattern === 'compute' && tgtPattern === 'key-value') return 'key lookup'
  if (srcPattern === 'compute' && tgtPattern === 'message-queue') return 'enqueue message'
  if (srcPattern === 'compute' && tgtPattern === 'pub-sub') return 'publish event'
  if (srcPattern === 'compute' && tgtPattern === 'object-storage') return 'upload / download'
  if (srcPattern === 'compute' && tgtPattern === 'search') return 'search query'
  if (srcPattern === 'cdc' && tgtPattern === 'pub-sub') return 'change event'
  if (srcPattern === 'replication') return 'replication stream'
  if (srcPattern === 'auth' || srcPattern === 'oauth') return 'auth token'
  if (srcPattern === 'authz') return 'permission decision'
  if (srcPattern === 'secrets') return 'secret value'
  if (srcPattern === 'observability') return 'telemetry'
  if (srcPattern === 'rate-limiting') return 'rate check'
  if (srcPattern === 'resilience') return out.flowLabel
  if (srcPattern === 'sharding') return 'routed query'
  if (srcPattern === 'cicd') return 'deploy'
  if (srcPattern === 'configuration') return 'config value'
  if (srcPattern === 'stream-processing') return 'stream event'

  // Use dataHint if set, else flowLabel
  return out.dataHint ?? out.flowLabel
}

// ─── Category fallback ────────────────────────────────────────────────────────

function inferFromCategory(
  srcData: Record<string, unknown>,
  tgtData: Record<string, unknown>,
): Partial<ArchitectureEdgeData> {
  const srcCat = srcData?.category as string | undefined
  const tgtCat = tgtData?.category as string | undefined

  const catMap: Record<string, Partial<ArchitectureEdgeData>> = {
    'clients→networking':    { label: 'HTTPS request', protocol: 'HTTPS', connectionType: 'synchronous' },
    'clients→compute':       { label: 'API call',      protocol: 'HTTPS', connectionType: 'synchronous' },
    'networking→compute':    { label: 'routed request', protocol: 'HTTP', connectionType: 'synchronous' },
    'compute→databases':     { label: 'DB query',       protocol: 'TCP',  connectionType: 'synchronous' },
    'compute→caching':       { label: 'cache lookup',   protocol: 'TCP',  connectionType: 'synchronous' },
    'compute→messaging':     { label: 'publish event',  protocol: 'AMQP', connectionType: 'asynchronous', animated: true },
    'messaging→compute':     { label: 'consume message', protocol: 'AMQP', connectionType: 'asynchronous', animated: true },
    'compute→storage':       { label: 'store object',   protocol: 'HTTPS', connectionType: 'synchronous' },
    'compute→observability': { label: 'telemetry',      protocol: 'HTTP',  connectionType: 'asynchronous', animated: true },
    'compute→security':      { label: 'auth check',     protocol: 'HTTPS', connectionType: 'synchronous' },
    'databases→databases':   { label: 'replication',    protocol: 'TCP',   connectionType: 'replication' },
    'services→databases':    { label: 'data query',     protocol: 'TCP',   connectionType: 'synchronous' },
    'services→caching':      { label: 'cache read',     protocol: 'TCP',   connectionType: 'synchronous' },
    'services→messaging':    { label: 'emit event',     protocol: 'AMQP',  connectionType: 'asynchronous', animated: true },
  }

  const key = `${srcCat}→${tgtCat}`
  return catMap[key] ?? defaultEdge()
}

function defaultEdge(): Partial<ArchitectureEdgeData> {
  return {
    protocol: 'HTTPS',
    connectionType: 'synchronous',
    animated: false,
  }
}
