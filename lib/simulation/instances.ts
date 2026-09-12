import type { ComponentCategory } from '@/types/architecture'
import { findInstanceType } from '@/lib/config/instanceTypes'

/**
 * Per-component instance sizing.
 *
 * CPU is deliberately *not* a second field sitting next to concurrency. Concurrency
 * already answers "how many requests at once", and hardware is what buys it — so
 * instances × vCPU derives the concurrency the simulation uses. Two independent fields
 * meaning the same thing would drift, and the user would have no way to know which one
 * the engine believed.
 *
 * With sizing on the node, the capacity estimate can finally answer the question people
 * actually bring to a design review: not "what is my peak QPS" but "how many of these do
 * I need to survive it".
 */

export interface InstanceProfile {
  /** Horizontal count — pods, VMs, shards. */
  instances: number
  /** vCPU per instance. */
  vcpu: number
  /** RAM per instance, in GB. */
  memoryGb: number
  /**
   * Requests one vCPU can have in flight at once.
   *
   * Above 1 because request handling is mostly waiting — on a database, a cache, a
   * downstream call. A CPU-bound service (encoding, inference) should set this to 1.
   */
  concurrencyPerVcpu: number
}

/**
 * A modest general-purpose instance. Two vCPU and 4GB is roughly a small cloud VM, and
 * one of them is the honest default for a box someone has just dropped on a canvas.
 */
export const DEFAULT_INSTANCE_PROFILE: InstanceProfile = {
  instances: 1,
  vcpu: 2,
  memoryGb: 4,
  concurrencyPerVcpu: 4,
}

/**
 * Category defaults that reflect how these tiers are actually run.
 *
 * Stateless tiers scale out and are usually many small instances; datastores are fewer,
 * larger boxes with more memory. Only the values that differ from the general-purpose
 * default are listed.
 */
export const PROFILE_BY_CATEGORY: Partial<Record<ComponentCategory, Partial<InstanceProfile>>> = {
  networking: { instances: 2, vcpu: 4, concurrencyPerVcpu: 16 },
  'load-balancing': { instances: 2, vcpu: 4, concurrencyPerVcpu: 16 },
  'rate-limiting': { instances: 2, vcpu: 2, concurrencyPerVcpu: 16 },

  compute: { instances: 3, vcpu: 2, memoryGb: 4 },
  services: { instances: 3, vcpu: 2, memoryGb: 4 },

  databases: { instances: 1, vcpu: 8, memoryGb: 32, concurrencyPerVcpu: 2 },
  'db-internals': { instances: 1, vcpu: 8, memoryGb: 32, concurrencyPerVcpu: 2 },
  storage: { instances: 1, vcpu: 4, memoryGb: 16, concurrencyPerVcpu: 2 },
  replication: { instances: 2, vcpu: 8, memoryGb: 32, concurrencyPerVcpu: 2 },

  // Caches live in memory, so RAM is the dimension that matters.
  caching: { instances: 2, vcpu: 4, memoryGb: 16, concurrencyPerVcpu: 8 },
  'caching-patterns': { instances: 2, vcpu: 4, memoryGb: 16, concurrencyPerVcpu: 8 },

  messaging: { instances: 3, vcpu: 4, memoryGb: 8, concurrencyPerVcpu: 8 },
  streaming: { instances: 3, vcpu: 4, memoryGb: 8, concurrencyPerVcpu: 8 },

  // Clients are not provisioned by you.
  clients: { instances: 1, vcpu: 1, memoryGb: 1, concurrencyPerVcpu: 64 },
  actors: { instances: 1, vcpu: 1, memoryGb: 1, concurrencyPerVcpu: 64 },
  external: { instances: 1, vcpu: 1, memoryGb: 1, concurrencyPerVcpu: 4 },
}

export const LIMITS = {
  instances: { min: 1, max: 10_000 },
  vcpu: { min: 1, max: 1_024 },
  memoryGb: { min: 0, max: 65_536 },
  concurrencyPerVcpu: { min: 1, max: 1_024 },
} as const

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

/** The component config bag, if present. */
function readConfig(data: unknown): Record<string, unknown> | undefined {
  if (!data || typeof data !== 'object') return undefined
  const config = (data as Record<string, unknown>).config
  return config && typeof config === 'object' ? (config as Record<string, unknown>) : undefined
}

/** True when the node carries any explicit sizing of its own. */
export function hasInstanceConfig(data: unknown): boolean {
  return (
    readNumber(data, 'instances') !== undefined ||
    readNumber(data, 'vcpu') !== undefined ||
    readNumber(data, 'memoryGb') !== undefined ||
    readNumber(data, 'concurrencyPerVcpu') !== undefined ||
    findInstanceType(readConfig(data)?.instanceType) !== undefined
  )
}

/**
 * Sizing for a node: its own values, then its instance type, then its category, then
 * general purpose.
 *
 * The instance type sits between explicit numbers and the category default so choosing
 * "m5.large" fills vCPU and RAM, while someone who typed exact figures keeps them.
 */
export function instanceProfile(data: unknown): InstanceProfile {
  const category = readCategory(data)
  const base: InstanceProfile = {
    ...DEFAULT_INSTANCE_PROFILE,
    ...((category && PROFILE_BY_CATEGORY[category]) ?? {}),
  }

  const machine = findInstanceType(readConfig(data)?.instanceType)
  if (machine) {
    base.vcpu = machine.vcpu
    base.memoryGb = machine.memoryGb
  }

  const pick = (key: keyof InstanceProfile): number => {
    const value = readNumber(data, key)
    if (value === undefined) return base[key]
    const { min, max } = LIMITS[key]
    return clamp(value, min, max, base[key])
  }

  return {
    instances: pick('instances'),
    vcpu: pick('vcpu'),
    memoryGb: pick('memoryGb'),
    concurrencyPerVcpu: pick('concurrencyPerVcpu'),
  }
}

/**
 * A hard concurrency ceiling declared in the component's own configuration.
 *
 * A database's connection pool, a balancer's max connections, a queue's partitions, a
 * Lambda's reserved concurrency — for these tiers the configured limit is the real
 * constraint, not the core count. Returns undefined when the node declares none.
 */
export function configuredConcurrencyLimit(data: unknown): number | undefined {
  const config = readConfig(data)
  if (!config) return undefined

  // Any of these caps requests in flight; the smallest wins, since they compound.
  const keys = ['connectionPool', 'maxConnections', 'partitions', 'reservedConcurrency']
  let limit: number | undefined

  for (const key of keys) {
    const value = config[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) continue
    limit = limit === undefined ? value : Math.min(limit, value)
  }

  return limit
}

/** Requests one instance can hold in flight. */
export function concurrencyPerInstance(profile: InstanceProfile): number {
  return Math.max(Math.floor(profile.vcpu * profile.concurrencyPerVcpu), 1)
}

/** Requests the whole tier can hold in flight — what the simulation uses. */
export function derivedConcurrency(profile: InstanceProfile): number {
  return Math.max(concurrencyPerInstance(profile) * profile.instances, 1)
}

export function totalVcpu(profile: InstanceProfile): number {
  return profile.vcpu * profile.instances
}

export function totalMemoryGb(profile: InstanceProfile): number {
  return profile.memoryGb * profile.instances
}

/**
 * Concurrency a given arrival rate demands, by Little's Law: L = λW.
 *
 * A tier serving 1,000 req/s where each takes 40ms must hold 40 requests at once. This is
 * the bridge between the workload estimate and the hardware on the node.
 */
export function requiredConcurrency(arrivalRatePerSec: number, serviceMs: number): number {
  if (!Number.isFinite(arrivalRatePerSec) || arrivalRatePerSec <= 0) return 0
  if (!Number.isFinite(serviceMs) || serviceMs <= 0) return 0
  return arrivalRatePerSec * (serviceMs / 1000)
}

/** Instances needed to carry that concurrency, rounded up — you cannot run 3.2 of them. */
export function requiredInstances(
  arrivalRatePerSec: number,
  serviceMs: number,
  profile: InstanceProfile
): number {
  const needed = requiredConcurrency(arrivalRatePerSec, serviceMs)
  if (needed <= 0) return 0
  return Math.ceil(needed / concurrencyPerInstance(profile))
}

export type SizingVerdict = 'idle' | 'ok' | 'tight' | 'under'

export interface Sizing {
  /** Concurrency the load demands. */
  required: number
  /** Concurrency the configured hardware provides. */
  provided: number
  /** Instances needed for the load. */
  requiredInstances: number
  /** Instances configured. */
  configuredInstances: number
  /** required ÷ provided. Above 1 means it cannot keep up. */
  utilisation: number
  verdict: SizingVerdict
}

/** Utilisation past which a tier has no meaningful headroom left. */
export const TIGHT_UTILISATION = 0.7

/**
 * Whether a component's configured hardware carries the load.
 *
 * 'tight' rather than 'ok' above 70% because a tier sized exactly to its average has no
 * room for a spike, a deploy, or an instance going away — and queue wait climbs sharply
 * as utilisation approaches 1.
 */
export function sizing(
  arrivalRatePerSec: number,
  serviceMs: number,
  profile: InstanceProfile
): Sizing {
  const required = requiredConcurrency(arrivalRatePerSec, serviceMs)
  const provided = derivedConcurrency(profile)
  const utilisation = provided > 0 ? required / provided : 0

  let verdict: SizingVerdict
  if (required <= 0) verdict = 'idle'
  else if (utilisation > 1) verdict = 'under'
  else if (utilisation >= TIGHT_UTILISATION) verdict = 'tight'
  else verdict = 'ok'

  return {
    required,
    provided,
    requiredInstances: requiredInstances(arrivalRatePerSec, serviceMs, profile),
    configuredInstances: profile.instances,
    utilisation,
    verdict,
  }
}
