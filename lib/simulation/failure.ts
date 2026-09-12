import type { FailureConfig } from '@/types/simulation'

/**
 * Failure injection rules.
 *
 * Split out from the engine so the decision is a pure function of the config and a
 * supplied dice roll. Inline `Math.random()` made this the one part of the engine
 * that could not be reasoned about or tested, and failure injection is exactly the
 * feature where you want to be sure a marked node fails every single time.
 */

/** Why a hop failed, for the log and for explaining it back to the user. */
export type FailureReason = 'node-down' | 'error-rate'

export interface FailureDecision {
  failed: boolean
  reason: FailureReason | null
}

const OK: FailureDecision = { failed: false, reason: null }

/**
 * Whether a packet arriving at `targetId` fails.
 *
 * A node the user marked as down fails deterministically — that is the point of
 * marking it, and a marked node that only fails sometimes reads as a bug. The error
 * rate is the probabilistic layer on top, applied to everything else.
 *
 * `roll` is a 0..1 sample supplied by the caller.
 */
export function decideFailure(
  targetId: string,
  failure: FailureConfig,
  roll: number
): FailureDecision {
  if (failure.failNodes.has(targetId)) return { failed: true, reason: 'node-down' }

  const rate = Number.isFinite(failure.errorRate) ? failure.errorRate : 0
  // Strictly less than, so a rate of 0 can never fail and a rate of 1 always does.
  if (rate > 0 && roll < rate) return { failed: true, reason: 'error-rate' }

  return OK
}

export function isSlowEdge(edgeId: string, failure: FailureConfig): boolean {
  return failure.slowEdges.has(edgeId)
}

/** Human-readable cause, for the request log. */
export function failureLabel(reason: FailureReason): string {
  return reason === 'node-down' ? 'node down' : 'error rate'
}
