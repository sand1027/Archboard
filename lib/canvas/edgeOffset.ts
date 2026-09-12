/**
 * Manual edge nudging.
 *
 * Two edges between the same pair of nodes trace the same route and their labels
 * stack on top of each other. Rather than a full waypoint editor, an edge carries
 * one offset from its natural midpoint: enough to pull overlapping lines apart,
 * and it survives the nodes being moved because it is stored relative to the
 * midpoint rather than in absolute canvas coordinates.
 */

export interface EdgeOffset {
  x: number
  y: number
}

export interface EndPoints {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
}

/** Below this, an offset is treated as absent so the edge snaps back. */
export const OFFSET_EPSILON = 1.5

export function hasOffset(offset: EdgeOffset | undefined | null): offset is EdgeOffset {
  if (!offset) return false
  if (!Number.isFinite(offset.x) || !Number.isFinite(offset.y)) return false
  return Math.abs(offset.x) > OFFSET_EPSILON || Math.abs(offset.y) > OFFSET_EPSILON
}

/** Natural midpoint of the straight line between the endpoints. */
export function naturalMidpoint(p: EndPoints): { x: number; y: number } {
  return {
    x: (p.sourceX + p.targetX) / 2,
    y: (p.sourceY + p.targetY) / 2,
  }
}

/** Where the drag handle sits, and where the path is pulled through. */
export function offsetMidpoint(
  p: EndPoints,
  offset: EdgeOffset | undefined | null
): { x: number; y: number } {
  const mid = naturalMidpoint(p)
  if (!hasOffset(offset)) return mid
  return { x: mid.x + offset.x, y: mid.y + offset.y }
}

/**
 * A quadratic curve that passes exactly through `through`.
 *
 * A quadratic sits at (start + 2·control + end) / 4 at its midpoint, so solving
 * for the control point gives `2·through − (start + end) / 2`. Without that the
 * curve would only lean toward the dragged point rather than follow it, and the
 * handle would drift away from the line under the cursor.
 */
export function curveThrough(p: EndPoints, through: { x: number; y: number }): string {
  const cx = 2 * through.x - (p.sourceX + p.targetX) / 2
  const cy = 2 * through.y - (p.sourceY + p.targetY) / 2
  return `M ${p.sourceX},${p.sourceY} Q ${cx},${cy} ${p.targetX},${p.targetY}`
}

/**
 * A two-segment straight line that bends at `through`.
 *
 * Used for the orthogonal/straight routings, where a quadratic would turn a
 * crisp connector into a bowed one. The corner is sharp on purpose: it reads as
 * a waypoint the user placed rather than as sloppy curvature.
 */
export function polylineThrough(p: EndPoints, through: { x: number; y: number }): string {
  return `M ${p.sourceX},${p.sourceY} L ${through.x},${through.y} L ${p.targetX},${p.targetY}`
}

/** Convert a screen-space drag delta into canvas units. */
export function screenDeltaToFlow(dx: number, dy: number, zoom: number): EdgeOffset {
  const safeZoom = zoom > 0 ? zoom : 1
  return { x: dx / safeZoom, y: dy / safeZoom }
}

/**
 * Offset for an edge that has been dragged.
 *
 * Returns undefined once the drag lands back near the natural midpoint, so
 * nudging a line and then putting it back leaves no residue in the document.
 */
export function nextOffset(
  current: EdgeOffset | undefined | null,
  deltaFlow: EdgeOffset
): EdgeOffset | undefined {
  const candidate = {
    x: (current?.x ?? 0) + deltaFlow.x,
    y: (current?.y ?? 0) + deltaFlow.y,
  }
  return hasOffset(candidate) ? candidate : undefined
}

