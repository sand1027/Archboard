/**
 * Playback timing for simulated packets.
 *
 * Reported latency and animation duration are deliberately separate numbers.
 * The engine used to derive one from the other: a 20ms notional hop latency was
 * converted into a pixels-per-second figure, which worked out to 10,000 px/s and
 * meant a packet crossed a whole edge in one or two animation frames. The dot was
 * being drawn — it just finished before the screen could show it.
 *
 * Latency is a statistic the run reports. How long a dot takes to travel is a
 * presentation choice, and it belongs to the speed multiplier alone.
 */

/** Travel time across an edge of REFERENCE_LENGTH_PX at 1x speed. */
export const BASE_HOP_MS = 850

/** Edge length that maps to exactly BASE_HOP_MS. */
export const REFERENCE_LENGTH_PX = 240

/**
 * Long edges take longer, but sub-linearly. Scaling straight off length makes a
 * cross-canvas connector crawl while a short one blinks; the square root keeps
 * every hop in the same rough tempo, which is what makes a flow readable.
 */
export const LENGTH_EXPONENT = 0.5

/** Guard rails so no hop is imperceptible or feels stuck. */
export const MIN_HOP_MS = 160
export const MAX_HOP_MS = 4000

export interface HopTimingInput {
  /** Straight-line distance between the two nodes, in canvas units. */
  lengthPx: number
  /** User playback speed. Higher is faster, so it divides the duration. */
  speedMultiplier: number
  /** Multiplier applied when the edge is marked slow. 1 means normal. */
  slowFactor?: number
}

/** Wall-clock milliseconds a packet should spend traversing one edge. */
export function hopDurationMs({
  lengthPx,
  speedMultiplier,
  slowFactor = 1,
}: HopTimingInput): number {
  const length = Number.isFinite(lengthPx) && lengthPx > 0 ? lengthPx : REFERENCE_LENGTH_PX
  const speed = Number.isFinite(speedMultiplier) && speedMultiplier > 0 ? speedMultiplier : 1
  const slow = Number.isFinite(slowFactor) && slowFactor > 0 ? slowFactor : 1

  const lengthScale = Math.pow(length / REFERENCE_LENGTH_PX, LENGTH_EXPONENT)
  const raw = (BASE_HOP_MS * lengthScale * slow) / speed

  return Math.min(Math.max(raw, MIN_HOP_MS), MAX_HOP_MS)
}

/**
 * Next progress value along an edge, clamped so it never overshoots past the end.
 *
 * Returns a number that may equal 1 exactly; the caller treats >= 1 as arrival.
 */
export function advanceProgress(progress: number, dtMs: number, durationMs: number): number {
  if (!Number.isFinite(progress)) return 1
  // A zero or negative duration would divide to Infinity. Arriving immediately is
  // the only sane reading of "no time to travel".
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 1
  if (!Number.isFinite(dtMs) || dtMs <= 0) return progress

  return Math.min(progress + dtMs / durationMs, 1)
}

/**
 * Latency the run reports for one hop.
 *
 * Independent of playback speed on purpose: dragging the speed slider is a
 * viewing preference, and it should not change the numbers in the metrics panel.
 */
export function hopLatencyMs(baseLatencyMs: number, isSlow: boolean, slowFactor: number): number {
  const base = Number.isFinite(baseLatencyMs) && baseLatencyMs > 0 ? baseLatencyMs : 0
  const slow = Number.isFinite(slowFactor) && slowFactor > 0 ? slowFactor : 1
  return isSlow ? base * slow : base
}

/**
 * Gap between dispatches when several requests are sent in sequence.
 *
 * Tied to the hop tempo so a load test at 4x actually looks four times busier.
 */
export function dispatchIntervalMs(speedMultiplier: number): number {
  const speed = Number.isFinite(speedMultiplier) && speedMultiplier > 0 ? speedMultiplier : 1
  return Math.max(BASE_HOP_MS / speed, 80)
}

// ─── Comet trail ──────────────────────────────────────────────────────────────

/** Trailing dots drawn behind a packet's head. */
export const TRAIL_DOTS = 4

/** Progress between consecutive trail dots. */
export const TRAIL_GAP = 0.05

export interface TrailDot {
  /** Progress along the edge, 0..1. */
  t: number
  /** Radius multiplier relative to the head dot. */
  scale: number
  /** Alpha, 0..1. */
  opacity: number
}

/**
 * Head dot plus its fading tail.
 *
 * A single dot travelling a line reads as an object being moved. A short tail
 * reads as flow, which is the thing being illustrated, and it also covers the gap
 * between frames at high playback speeds.
 *
 * Dots that would sit before the start of the edge are dropped rather than
 * clamped to 0, otherwise the whole tail piles up on the source node at the
 * beginning of every hop.
 */
export function packetTrail(
  progress: number,
  count: number = TRAIL_DOTS,
  gap: number = TRAIL_GAP
): TrailDot[] {
  const head = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0
  const dots: TrailDot[] = [{ t: head, scale: 1, opacity: 1 }]

  for (let i = 1; i <= count; i++) {
    const t = head - i * gap
    if (t <= 0) break
    // Linear falloff: predictable, and keeps the last dot faint but visible.
    const fade = 1 - i / (count + 1)
    dots.push({ t, scale: 0.35 + fade * 0.5, opacity: fade * 0.7 })
  }

  return dots
}
