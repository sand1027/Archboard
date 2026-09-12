// ─── Back-of-envelope capacity estimate ───────────────────────────────────────
//
// Declared here rather than beside the calculator so the persisted document can carry a
// workload without types/ importing from lib/.

/**
 * Everything the estimate is derived from. All of it is user-editable, including the
 * constants — `secondsPerDay` is a field because rounding 86,400 to 100,000 is a
 * standard back-of-envelope shortcut and some people prefer it.
 */
export interface WorkloadInputs {
  /** Daily active users. */
  dau: number
  /** Requests each active user makes per day. */
  requestsPerUserPerDay: number
  /** Peak-to-average traffic ratio. Traffic is never flat across a day. */
  peakFactor: number
  /** Reads per write. 9 means 90% of traffic is reads. */
  readsPerWrite: number
  /** Average request payload, in KB. */
  requestKb: number
  /** Average response payload, in KB. */
  responseKb: number
  /** Bytes durably stored per write, in KB. */
  storedPerWriteKb: number
  /** How long written data is kept. */
  retentionDays: number
  /** Copies kept for durability. */
  replicationFactor: number
  /** Divides stored size. 1 means no compression. */
  compressionRatio: number
  /** Share of reads served by cache, 0–1. */
  cacheHitRate: number
  /** Seconds in a day. 86400 exactly, or 100000 for round mental arithmetic. */
  secondsPerDay: number
}

/**
 * Identifies one line of the derivation. Stable, because overrides are keyed by it and
 * are persisted with the document.
 */
export type EstimateStepId =
  | 'requests-per-day'
  | 'avg-qps'
  | 'peak-qps'
  | 'writes-per-day'
  | 'write-qps'
  | 'read-qps'
  | 'origin-read-qps'
  | 'ingress'
  | 'egress'
  | 'storage-per-day'
  | 'storage-retained'

export type EstimateUnitName = 'count' | 'rate' | 'bytes' | 'byteRate' | 'ratio' | 'days'

/**
 * One line of working.
 *
 * The calculator returns these rather than a bag of totals so the panel can show *how*
 * a number was reached. An estimate nobody can check is an estimate nobody should
 * trust, and the arithmetic is the part worth arguing about.
 */
export interface EstimateStep {
  id: EstimateStepId
  label: string
  /** The arithmetic with real values substituted, e.g. "100M × 10". */
  formula: string
  /** Why this step exists, in one line. */
  note: string
  value: number
  unit: EstimateUnitName
  /** True when the user pinned this value instead of accepting the computed one. */
  overridden: boolean
  /** What the arithmetic produced, kept so the panel can show what was replaced. */
  computed: number
}

/** Values the user has pinned, replacing the computed result and flowing downstream. */
export type EstimateOverrides = Partial<Record<EstimateStepId, number>>

export interface EstimateResult {
  steps: EstimateStep[]
  /** Same steps, addressable by id. */
  byId: Record<EstimateStepId, EstimateStep>
}

/** Persisted alongside the diagram. */
export interface WorkloadDocument {
  inputs: WorkloadInputs
  overrides: EstimateOverrides
}
