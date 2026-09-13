import type { CollabOp } from '@/types/collab'
import { applyOp, type DocumentSlice } from './ops'

/**
 * Convergence for concurrent edits.
 *
 * Applying operations in arrival order does not converge. If two people rename the same node
 * at once, each applies their own change first and the other's second, so one ends on
 * "Cache" and the other on "Redis" — permanently different documents, which is worse than
 * losing an edit.
 *
 * The fix is to decide by the data rather than by delivery: every write carries a logical
 * timestamp, and a change is accepted only when it is newer than the value already held.
 * "Newest wins" is order-independent, so both clients reach the same state whatever sequence
 * the messages arrive in. This is a last-write-wins register — the simplest useful CRDT.
 *
 * Granularity is per field, so two people editing different properties of the same node both
 * keep their work; only edits to the *same* field compete.
 */

export interface OpStamp {
  /** Lamport counter. Monotonic per client, advanced past anything observed. */
  c: number
  /** Client id, breaking ties so every replica picks the same winner. */
  by: string
}

export interface StampedOp {
  op: CollabOp
  stamp: OpStamp
}

/** Version of the last accepted write, keyed by field. */
export type VersionMap = Map<string, OpStamp>

/**
 * Order two stamps. Positive when `a` is newer.
 *
 * The client-id tiebreak is what makes this deterministic: with equal counters every replica
 * must still agree, and comparing ids is the cheapest rule they can all apply independently.
 */
export function compareStamps(a: OpStamp, b: OpStamp): number {
  if (a.c !== b.c) return a.c - b.c
  return a.by < b.by ? -1 : a.by > b.by ? 1 : 0
}

export function isNewer(candidate: OpStamp, current: OpStamp | undefined): boolean {
  return current === undefined || compareStamps(candidate, current) > 0
}

/**
 * A Lamport clock.
 *
 * `observe` pulls the counter past anything seen, so a client that has received a remote edit
 * cannot then issue a write that looks older than it — which would make its own change lose
 * for no reason.
 */
export function createClock(clientId: string, start = 0) {
  let counter = start

  return {
    get clientId() {
      return clientId
    },
    next(): OpStamp {
      counter += 1
      return { c: counter, by: clientId }
    },
    observe(stamp: OpStamp): void {
      if (stamp.c > counter) counter = stamp.c
    },
    get counter() {
      return counter
    },
  }
}

export type Clock = ReturnType<typeof createClock>

// ─── version keys ─────────────────────────────────────────────────────────────

/**
 * Existence key. Kept after a removal as a tombstone, so a late-arriving add cannot
 * resurrect a node someone deleted.
 */
const existsKey = (kind: 'n' | 'e', id: string) => `${kind}:${id}`
const positionKey = (id: string) => `n:${id}:position`
const dataKey = (kind: 'n' | 'e', id: string, field: string) => `${kind}:${id}:d:${field}`

/** Which version keys an operation writes. */
export function keysFor(op: CollabOp): string[] {
  switch (op.t) {
    case 'node:add':
    case 'node:remove':
      return [existsKey('n', op.t === 'node:add' ? op.node.id : op.id)]
    case 'node:move':
      return [positionKey(op.id)]
    case 'node:data':
      return Object.keys(op.data).map((field) => dataKey('n', op.id, field))
    case 'edge:add':
    case 'edge:remove':
      return [existsKey('e', op.t === 'edge:add' ? op.edge.id : op.id)]
    case 'edge:data':
      return Object.keys(op.data).map((field) => dataKey('e', op.id, field))
    case 'diagram:name':
      return ['doc:name']
  }
}

export interface ApplyResult {
  doc: DocumentSlice
  /** True when the operation won and the document changed. */
  applied: boolean
}

/**
 * Apply an operation only where it is newer than what is already held.
 *
 * A `node:data` carrying several fields is filtered rather than accepted or rejected whole:
 * if one field is stale and another is fresh, only the fresh one lands. Rejecting the whole
 * message would throw away a good edit because it travelled next to an old one.
 */
export function applyStamped(
  doc: DocumentSlice,
  versions: VersionMap,
  { op, stamp }: StampedOp
): ApplyResult {
  // Field-level ops can be partially accepted, so they are handled separately.
  if (op.t === 'node:data' || op.t === 'edge:data') {
    const kind = op.t === 'node:data' ? 'n' : 'e'
    const fresh: Record<string, unknown> = {}

    for (const [field, value] of Object.entries(op.data)) {
      const key = dataKey(kind, op.id, field)
      if (!isNewer(stamp, versions.get(key))) continue
      versions.set(key, stamp)
      fresh[field] = value
    }

    if (Object.keys(fresh).length === 0) return { doc, applied: false }

    const next = applyOp(doc, { ...op, data: fresh })
    return { doc: next, applied: next !== doc }
  }

  const keys = keysFor(op)
  const wins = keys.every((key) => isNewer(stamp, versions.get(key)))
  if (!wins) return { doc, applied: false }

  for (const key of keys) versions.set(key, stamp)

  const next = applyOp(doc, op)
  return { doc: next, applied: next !== doc }
}

/** Apply a batch. Order does not affect the outcome — that is the point. */
export function applyStampedBatch(
  doc: DocumentSlice,
  versions: VersionMap,
  entries: StampedOp[]
): DocumentSlice {
  return entries.reduce((acc, entry) => applyStamped(acc, versions, entry).doc, doc)
}

/**
 * Record local writes without applying them.
 *
 * A local edit is already in the store, but its stamps must still be registered or a
 * concurrent remote edit with an older stamp would be treated as newer and overwrite it.
 */
export function noteLocal(versions: VersionMap, op: CollabOp, stamp: OpStamp): void {
  for (const key of keysFor(op)) versions.set(key, stamp)
}
