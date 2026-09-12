/**
 * Sequence-diagram geometry and derivation, as pure functions.
 *
 * Sequence is the one diagram type that fights free-form node dragging: it has
 * a vertical time axis, so message position comes from an explicit `order`
 * rather than from handle geometry, and lifelines are pinned to a single Y.
 *
 * Activation bars are DERIVED from messages rather than stored. The legacy
 * UmlLifelineNodeData.activations field is render-only dead data — it has no
 * editing UI and spawnLldNode hardcodes the same interval for every lifeline.
 */

import type { LldEdge, LldShape, SequenceMessage } from '@/types/lld'

/** Y of the lifeline head; every lifeline is clamped here. */
export const LIFELINE_TOP = 80
/** Horizontal spacing used when seeding lifelines. */
export const LIFELINE_PITCH = 200
/** Distance from the head to the first message slot. */
export const HEADER_OFFSET = 96
/** Vertical distance between message slots. */
export const MESSAGE_GAP = 56
/** Width of an activation bar. */
export const ACTIVATION_WIDTH = 12
/** Horizontal reach of a self-call loop. */
export const SELF_CALL_WIDTH = 52

/** Absolute Y for a message slot. */
export function messageY(order: number): number {
  return LIFELINE_TOP + HEADER_OFFSET + order * MESSAGE_GAP
}

/** Lifeline height needed to cover every message plus tail slack. */
export function requiredLifelineHeight(messageCount: number): number {
  return HEADER_OFFSET + Math.max(messageCount, 1) * MESSAGE_GAP + MESSAGE_GAP
}

export function isSequenceMessage(edge: LldEdge): edge is SequenceMessage {
  return edge.type === 'lldSequenceMessage'
}

export function sequenceMessages(edges: LldEdge[]): SequenceMessage[] {
  return edges.filter(isSequenceMessage)
}

/** Messages sorted by time order; ties broken by id for stability. */
export function orderedMessages(edges: LldEdge[]): SequenceMessage[] {
  return sequenceMessages(edges).sort((a, b) => {
    const d = (a.data?.order ?? 0) - (b.data?.order ?? 0)
    return d !== 0 ? d : a.id.localeCompare(b.id)
  })
}

/** Next free slot at the end of the timeline. */
export function nextOrder(edges: LldEdge[]): number {
  const msgs = sequenceMessages(edges)
  if (msgs.length === 0) return 0
  return Math.max(...msgs.map((m) => m.data?.order ?? 0)) + 1
}

/**
 * Reassign orders so they are contiguous 0..n-1 in current sorted order.
 * Called after a delete so gaps do not accumulate.
 */
export function compactOrders(edges: LldEdge[]): LldEdge[] {
  const ordered = orderedMessages(edges)
  const rank = new Map(ordered.map((m, i) => [m.id, i]))
  return edges.map((e) =>
    isSequenceMessage(e) && rank.has(e.id)
      ? { ...e, data: { ...e.data!, order: rank.get(e.id)! } }
      : e
  )
}

/** Move one message to a new slot, shifting the others to stay contiguous. */
export function reorderMessage(edges: LldEdge[], messageId: string, newIndex: number): LldEdge[] {
  const ordered = orderedMessages(edges)
  const from = ordered.findIndex((m) => m.id === messageId)
  if (from === -1) return edges

  const clamped = Math.max(0, Math.min(newIndex, ordered.length - 1))
  if (clamped === from) return edges

  const next = [...ordered]
  const [moved] = next.splice(from, 1)
  next.splice(clamped, 0, moved)

  const rank = new Map(next.map((m, i) => [m.id, i]))
  return edges.map((e) =>
    isSequenceMessage(e) && rank.has(e.id)
      ? { ...e, data: { ...e.data!, order: rank.get(e.id)! } }
      : e
  )
}

export interface Activation {
  lifelineId: string
  /** Absolute Y coordinates. */
  startY: number
  endY: number
  /** Nesting level, for horizontal offset of overlapping bars. */
  depth: number
}

/**
 * Derive activation bars by walking the timeline.
 *
 * A sync call opens a bar on the receiver; a return closes the innermost open
 * bar on the sender. Unmatched bars stay open to the end of the timeline, which
 * is the correct reading for a diagram that is still being drawn.
 */
export function deriveActivations(shapes: LldShape[], edges: LldEdge[]): Activation[] {
  const lifelineIds = new Set(
    shapes.filter((s) => s.type === 'lldLifeline').map((s) => s.id)
  )
  const ordered = orderedMessages(edges)
  if (ordered.length === 0) return []

  const open = new Map<string, number[]>() // lifelineId → stack of start Ys
  const out: Activation[] = []
  const endOfTimeline = messageY(ordered.length - 1) + MESSAGE_GAP

  const push = (lifelineId: string, y: number) => {
    const stack = open.get(lifelineId) ?? []
    stack.push(y)
    open.set(lifelineId, stack)
  }

  const pop = (lifelineId: string, y: number) => {
    const stack = open.get(lifelineId)
    if (!stack || stack.length === 0) return
    const startY = stack.pop()!
    out.push({ lifelineId, startY, endY: y, depth: stack.length })
  }

  for (const msg of ordered) {
    const y = messageY(msg.data?.order ?? 0)
    const kind = msg.data?.kind
    const source = msg.source
    const target = msg.target

    if (!lifelineIds.has(source) || !lifelineIds.has(target)) continue

    if (kind === 'msg-sync' || kind === 'msg-create') {
      push(target, y)
    } else if (kind === 'msg-async') {
      // Async does not block the caller; give the receiver a short bar.
      out.push({
        lifelineId: target,
        startY: y,
        endY: y + MESSAGE_GAP * 0.6,
        depth: (open.get(target) ?? []).length,
      })
    } else if (kind === 'msg-return') {
      pop(source, y)
    } else if (kind === 'msg-destroy') {
      pop(target, y)
    }
  }

  // Close anything still open at the end of the timeline.
  for (const [lifelineId, stack] of open) {
    while (stack.length > 0) {
      const startY = stack.pop()!
      out.push({ lifelineId, startY, endY: endOfTimeline, depth: stack.length })
    }
  }

  return out.sort((a, b) => a.startY - b.startY)
}

/** Activations for one lifeline, in node-local coordinates. */
export function activationsFor(
  activations: Activation[],
  lifelineId: string,
  lifelineTopY: number
): Array<{ start: number; end: number; depth: number }> {
  return activations
    .filter((a) => a.lifelineId === lifelineId)
    .map((a) => ({
      start: a.startY - lifelineTopY,
      end: a.endY - lifelineTopY,
      depth: a.depth,
    }))
}

/** Which lifeline is destroyed by which message, for the X terminator. */
export function destroyedLifelines(edges: LldEdge[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of sequenceMessages(edges)) {
    if (m.data?.kind === 'msg-destroy') out.set(m.target, m.id)
  }
  return out
}

/** Which lifeline is created by which message, so its head can be offset. */
export function createdLifelines(edges: LldEdge[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of sequenceMessages(edges)) {
    if (m.data?.kind === 'msg-create') out.set(m.target, m.id)
  }
  return out
}
