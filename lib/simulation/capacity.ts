import type { ComponentCategory } from '@/types/architecture'
import type { BottleneckSeverity } from '@/types/simulation'
import { BEHAVIORS } from '@/data/components/behaviors'

/**
 * Node capacity, and the rule for calling one a bottleneck.
 *
 * A bottleneck is the node that caps end-to-end throughput: work arrives faster
 * than it can be drained, so requests wait. It is a property of contention, not of
 * latency — which is why the engine's old `avgLatencyMs > 200` test could never fire.
 * Every hop cost a flat 20ms, so no node could be slower than any other and the
 * average had no way to reach the threshold.
 *
 * Two numbers make contention possible: how long one request occupies a node, and
 * how many it can handle at once. Divide the rate work arrives by the rate it drains
 * and you get utilisation. Under 1 the node keeps up; approaching 1, arrivals start
 * finding every server busy and queue wait climbs sharply.
 */

export interface NodeCapacity {
  /** Milliseconds one request occupies one server. */
  serviceMs: number
  /** Requests the node can serve simultaneously. */
  concurrency: number
}

/** Used for any category without a specific profile, and as the override fallback. */
export const GENERIC_CAPACITY: NodeCapacity = { serviceMs: 20, concurrency: 8 }

/**
 * Plausible defaults per component category, so the feature works with nothing
 * configured. Deliberately relative rather than precise: what matters for finding a
 * bottleneck is that a relational database is slower and narrower than a cache, not
 * that either number is accurate for a particular deployment.
 */
export const CAPACITY_BY_CATEGORY: Partial<Record<ComponentCategory, NodeCapacity>> = {
  // Traffic originates here; clients are not a served resource.
  clients: { serviceMs: 1, concurrency: 64 },
  actors: { serviceMs: 1, concurrency: 64 },

  // Edge and routing tiers are built to fan traffic out cheaply.
  networking: { serviceMs: 3, concurrency: 64 },
  'load-balancing': { serviceMs: 3, concurrency: 64 },
  'rate-limiting': { serviceMs: 2, concurrency: 48 },

  // Application tiers do the work, and are the usual first bottleneck.
  compute: { serviceMs: 25, concurrency: 8 },
  services: { serviceMs: 25, concurrency: 8 },

  // Stateful stores: slower, and far narrower than anything stateless.
  databases: { serviceMs: 40, concurrency: 4 },
  'db-internals': { serviceMs: 40, concurrency: 4 },
  storage: { serviceMs: 30, concurrency: 8 },
  replication: { serviceMs: 35, concurrency: 4 },
  sharding: { serviceMs: 30, concurrency: 8 },
  consistency: { serviceMs: 35, concurrency: 4 },

  // Caches are the fast, wide tier — the reason putting one in front helps.
  caching: { serviceMs: 2, concurrency: 32 },
  'caching-patterns': { serviceMs: 2, concurrency: 32 },

  // Queues absorb bursts, which is exactly why they are rarely the bottleneck.
  messaging: { serviceMs: 8, concurrency: 24 },
  streaming: { serviceMs: 8, concurrency: 24 },

  observability: { serviceMs: 10, concurrency: 16 },
  security: { serviceMs: 8, concurrency: 16 },
  resilience: { serviceMs: 5, concurrency: 24 },

  // A third party you do not control, and cannot scale.
  external: { serviceMs: 80, concurrency: 4 },
}

/** Bounds on what an override may set, so one bad value cannot stall a run. */
export const MIN_SERVICE_MS = 0
export const MAX_SERVICE_MS = 5000
export const MIN_CONCURRENCY = 1
export const MAX_CONCURRENCY = 512

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(value, min), max)
}

function readNumber(data: unknown, key: string): number | undefined {
  if (!data || typeof data !== 'object') return undefined
  const value = (data as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : undefined
}

function readCategory(data: unknown): ComponentCategory | undefined {
  if (!data || typeof data !== 'object') return undefined
  const value = (data as Record<string, unknown>).category
  return typeof value === 'string' ? (value as ComponentCategory) : undefined
}

function readString(data: unknown, key: string): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const value = (data as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

/**
 * Concurrency floor for a component that buffers.
 *
 * A queue, topic or event bus exists precisely to absorb a burst its consumers cannot
 * keep up with. Modelling one as a narrow synchronous resource made it queue, wait, and
 * get reported as the bottleneck — the opposite of what it is doing. Giving async
 * components deep capacity means backpressure shows up at the consumer that is actually
 * behind, which is the useful answer.
 */
export const ASYNC_CONCURRENCY = 128

/** The authored simulation hints for a component, if the registry has any. */
export function behaviourHints(componentId: string | undefined) {
  return componentId ? BEHAVIORS[componentId]?.sim : undefined
}

/**
 * Capacity for a node.
 *
 * Precedence, most specific first:
 *   1. Explicit overrides on the node — the user said so.
 *   2. The component's authored `sim` hints. 193 of the 233 registry entries carry a
 *      real latency, from a 0ms DNS lookup to a 500ms analytics query, and using them
 *      beats guessing from the category: "databases" covers both a key-value store and
 *      a warehouse.
 *   3. The category profile.
 *   4. The generic default.
 */
export function nodeCapacity(data: unknown): NodeCapacity {
  const category = readCategory(data)
  const categoryBase = (category && CAPACITY_BY_CATEGORY[category]) || GENERIC_CAPACITY

  const hints = behaviourHints(readString(data, 'componentId'))

  const base: NodeCapacity = {
    serviceMs:
      typeof hints?.latencyMs === 'number' && Number.isFinite(hints.latencyMs)
        ? clamp(hints.latencyMs, MIN_SERVICE_MS, MAX_SERVICE_MS, categoryBase.serviceMs)
        : categoryBase.serviceMs,
    concurrency: hints?.async
      ? Math.max(categoryBase.concurrency, ASYNC_CONCURRENCY)
      : categoryBase.concurrency,
  }

  const serviceMs = readNumber(data, 'serviceMs')
  const concurrency = readNumber(data, 'concurrency')

  return {
    serviceMs:
      serviceMs === undefined
        ? base.serviceMs
        : clamp(serviceMs, MIN_SERVICE_MS, MAX_SERVICE_MS, base.serviceMs),
    concurrency:
      concurrency === undefined
        ? base.concurrency
        : clamp(concurrency, MIN_CONCURRENCY, MAX_CONCURRENCY, base.concurrency),
  }
}

/**
 * Fraction of the node's serving capacity that was in use, 0..1.
 *
 * `busyServerMs` is summed across servers, so a node with 4 servers busy for a whole
 * 1000ms window contributes 4000 — hence the concurrency in the denominator.
 */
export function utilisation(busyServerMs: number, elapsedMs: number, concurrency: number): number {
  if (!Number.isFinite(busyServerMs) || busyServerMs <= 0) return 0
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0
  const servers = Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 1

  return Math.min(busyServerMs / (elapsedMs * servers), 1)
}

/** Utilisation at which a node is called a bottleneck. */
export const BOTTLENECK_UTILISATION = 0.7

/** Utilisation at which it is past saturated rather than merely busy. */
export const CRITICAL_UTILISATION = 0.9

/**
 * Queue depth that counts as a bottleneck regardless of utilisation.
 *
 * A short burst can leave a node with a real queue while its average utilisation is
 * still modest, and a request that had to wait behind two others is a bottleneck
 * from the caller's point of view whatever the average says.
 */
export const BOTTLENECK_QUEUE_DEPTH = 2

/** Below this, there was not enough traffic to draw any conclusion. */
export const MIN_SAMPLES = 2

export type { BottleneckSeverity }

export interface BottleneckInput {
  utilisation: number
  maxQueueDepth: number
  requestsIn: number
}

/**
 * How loaded a node was over the run.
 *
 * Needs more than one request to say anything: a single request necessarily finds
 * every server free, so flagging on it would just be noise. This is also why nothing
 * is ever a bottleneck in request-flow mode — one request cannot contend with itself.
 */
export function bottleneckSeverity({
  utilisation: util,
  maxQueueDepth,
  requestsIn,
}: BottleneckInput): BottleneckSeverity {
  if (requestsIn < MIN_SAMPLES) return 'none'

  if (util >= CRITICAL_UTILISATION || maxQueueDepth > BOTTLENECK_QUEUE_DEPTH) return 'saturated'
  if (util >= BOTTLENECK_UTILISATION || maxQueueDepth >= BOTTLENECK_QUEUE_DEPTH) return 'busy'
  return 'none'
}

export function isBottleneck(input: BottleneckInput): boolean {
  return bottleneckSeverity(input) !== 'none'
}

/**
 * Expected queue wait, for explaining *why* a node is a bottleneck.
 *
 * The standard single-queue result: wait grows as service × ρ/(1−ρ), which is flat
 * while there is headroom and then climbs without bound as utilisation reaches 1.
 * Reported alongside the measured wait to show where the node sits on that curve.
 */
export function expectedWaitMs(serviceMs: number, util: number): number {
  if (!Number.isFinite(serviceMs) || serviceMs <= 0) return 0
  const rho = Math.min(Math.max(Number.isFinite(util) ? util : 0, 0), 0.99)
  return (serviceMs * rho) / (1 - rho)
}
