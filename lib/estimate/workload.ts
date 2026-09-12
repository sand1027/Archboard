import type {
  EstimateOverrides,
  EstimateResult,
  EstimateStep,
  EstimateStepId,
  EstimateUnitName,
  WorkloadInputs,
} from '@/types/estimate'
import { formatBytes, formatCount } from './format'

/**
 * Back-of-envelope capacity estimation.
 *
 * Deliberately returns the working, not just the totals. Every line carries the
 * arithmetic with real values substituted, so the panel can show how a number was
 * reached — an estimate nobody can check is an estimate nobody should trust, and in a
 * design review the arithmetic is the part worth arguing about.
 *
 * Any line can also be pinned. Disagree that peak is 3× average? Pin peak QPS and
 * storage and bandwidth recompute from your number. That matters because the assumptions
 * are usually the disputed part, not the multiplication.
 */

const KB = 1024

export const DEFAULT_WORKLOAD: WorkloadInputs = {
  dau: 100_000_000,
  requestsPerUserPerDay: 10,
  peakFactor: 3,
  readsPerWrite: 9,
  requestKb: 1,
  responseKb: 4,
  storedPerWriteKb: 2,
  retentionDays: 365,
  replicationFactor: 3,
  compressionRatio: 1,
  cacheHitRate: 0.8,
  secondsPerDay: 86_400,
}

/** Bounds that keep the arithmetic meaningful rather than merely finite. */
const LIMITS: Record<keyof WorkloadInputs, { min: number; max: number }> = {
  dau: { min: 0, max: 1e12 },
  requestsPerUserPerDay: { min: 0, max: 1e6 },
  peakFactor: { min: 1, max: 1000 },
  readsPerWrite: { min: 0, max: 1e6 },
  requestKb: { min: 0, max: 1e9 },
  responseKb: { min: 0, max: 1e9 },
  storedPerWriteKb: { min: 0, max: 1e9 },
  retentionDays: { min: 0, max: 1e6 },
  replicationFactor: { min: 1, max: 100 },
  compressionRatio: { min: 0.01, max: 1000 },
  cacheHitRate: { min: 0, max: 1 },
  secondsPerDay: { min: 1, max: 1e7 },
}

/**
 * Bring inputs into range.
 *
 * A peak factor below 1 would make peak traffic quieter than average, and a compression
 * ratio of 0 divides storage to infinity. Clamping keeps a half-typed field from
 * producing nonsense while the user is still typing.
 */
export function normaliseWorkload(input: unknown): WorkloadInputs {
  const out = { ...DEFAULT_WORKLOAD }
  if (!input || typeof input !== 'object') return out

  const raw = input as Record<string, unknown>
  for (const key of Object.keys(LIMITS) as (keyof WorkloadInputs)[]) {
    const value = raw[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    const { min, max } = LIMITS[key]
    out[key] = Math.min(Math.max(value, min), max)
  }
  return out
}

/**
 * Keep only finite numeric pins.
 *
 * Overrides come back from stored JSON, so a hand-edited or older document could carry a
 * string or null where a number belongs. Validating here rather than at each call site
 * means the document layer and the store cannot disagree about what is acceptable.
 */
export function sanitiseOverrides(raw: unknown): EstimateOverrides {
  if (!raw || typeof raw !== 'object') return {}

  const out: EstimateOverrides = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key as EstimateStepId] = value
    }
  }
  return out
}

interface StepSpec {
  id: EstimateStepId
  label: string
  unit: EstimateUnitName
  note: string
  formula: string
  computed: number
}

/**
 * Run the derivation.
 *
 * Steps are evaluated in order and each one reads the *resolved* value of those before
 * it, so pinning an early line changes everything downstream — which is the point.
 */
export function estimate(
  rawInputs: unknown,
  overrides: EstimateOverrides = {}
): EstimateResult {
  const input = normaliseWorkload(rawInputs)
  const steps: EstimateStep[] = []

  /** Record a step, applying any pin, and return the value later steps should use. */
  const add = (spec: StepSpec): number => {
    const pinned = overrides[spec.id]
    const overridden = typeof pinned === 'number' && Number.isFinite(pinned)
    const value = overridden ? pinned : spec.computed

    steps.push({
      id: spec.id,
      label: spec.label,
      formula: spec.formula,
      note: spec.note,
      unit: spec.unit,
      value,
      overridden,
      computed: spec.computed,
    })
    return value
  }

  const requestsPerDay = add({
    id: 'requests-per-day',
    label: 'Requests per day',
    unit: 'count',
    note: 'Total daily traffic across all users.',
    formula: `${formatCount(input.dau)} DAU × ${formatCount(input.requestsPerUserPerDay)} req/user`,
    computed: input.dau * input.requestsPerUserPerDay,
  })

  const avgQps = add({
    id: 'avg-qps',
    label: 'Average QPS',
    unit: 'rate',
    note: 'Spread evenly across the day — nobody is ever at average.',
    formula: `${formatCount(requestsPerDay)} ÷ ${formatCount(input.secondsPerDay)} s`,
    computed: requestsPerDay / input.secondsPerDay,
  })

  const peakQps = add({
    id: 'peak-qps',
    label: 'Peak QPS',
    unit: 'rate',
    note: 'What the system must actually survive. Size against this, not the average.',
    formula: `${formatCount(avgQps)} × ${input.peakFactor} peak factor`,
    computed: avgQps * input.peakFactor,
  })

  // Reads per write, so one write in every (readsPerWrite + 1) requests.
  const writeShare = 1 / (input.readsPerWrite + 1)

  const writesPerDay = add({
    id: 'writes-per-day',
    label: 'Writes per day',
    unit: 'count',
    note: 'Drives storage growth; reads do not accumulate.',
    formula: `${formatCount(requestsPerDay)} ÷ (${input.readsPerWrite} + 1)`,
    computed: requestsPerDay * writeShare,
  })

  const writeQps = add({
    id: 'write-qps',
    label: 'Peak write QPS',
    unit: 'rate',
    note: 'Writes cannot be cached or served by a replica, so this hits the primary.',
    formula: `${formatCount(peakQps)} ÷ (${input.readsPerWrite} + 1)`,
    computed: peakQps * writeShare,
  })

  const readQps = add({
    id: 'read-qps',
    label: 'Peak read QPS',
    unit: 'rate',
    note: 'Everything that is not a write.',
    formula: `${formatCount(peakQps)} − ${formatCount(writeQps)}`,
    computed: Math.max(peakQps - writeQps, 0),
  })

  add({
    id: 'origin-read-qps',
    label: 'Reads reaching the store',
    unit: 'rate',
    note: 'What the database actually sees once the cache absorbs its share.',
    formula: `${formatCount(readQps)} × (1 − ${input.cacheHitRate})`,
    computed: readQps * (1 - input.cacheHitRate),
  })

  add({
    id: 'ingress',
    label: 'Ingress bandwidth',
    unit: 'byteRate',
    note: 'Inbound at peak.',
    formula: `${formatCount(peakQps)} × ${input.requestKb} KB`,
    computed: peakQps * input.requestKb * KB,
  })

  add({
    id: 'egress',
    label: 'Egress bandwidth',
    unit: 'byteRate',
    note: 'Outbound at peak — usually the one you pay for.',
    formula: `${formatCount(peakQps)} × ${input.responseKb} KB`,
    computed: peakQps * input.responseKb * KB,
  })

  const storagePerDay = add({
    id: 'storage-per-day',
    label: 'Storage per day',
    unit: 'bytes',
    note: 'New durable data each day, after compression.',
    formula: `${formatCount(writesPerDay)} × ${input.storedPerWriteKb} KB ÷ ${input.compressionRatio}`,
    computed: (writesPerDay * input.storedPerWriteKb * KB) / input.compressionRatio,
  })

  add({
    id: 'storage-retained',
    label: 'Storage at retention',
    unit: 'bytes',
    note: 'Total footprint including replica copies.',
    formula: `${formatBytes(storagePerDay)} × ${formatCount(input.retentionDays)} days × ${input.replicationFactor} copies`,
    computed: storagePerDay * input.retentionDays * input.replicationFactor,
  })

  const byId = {} as Record<EstimateStepId, EstimateStep>
  for (const step of steps) byId[step.id] = step

  return { steps, byId }
}

/**
 * Peak QPS the simulation should drive, so a load test reflects the workload rather than
 * an arbitrary concurrency setting.
 */
export function peakQpsFrom(result: EstimateResult): number {
  return result.byId['peak-qps'].value
}
