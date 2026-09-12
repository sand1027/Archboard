/**
 * Sampling points along an edge's actual rendered connector.
 *
 * The simulation needs to place a moving dot *on* a line. Interpolating between
 * node centres looks right only for straight edges: HLD connectors are smoothstep
 * by default, use floating endpoints that meet the side of the artwork rather than
 * its centre, and can carry a manual offset that bends them. A dot derived from
 * centres cuts the corner and starts and ends inside the node.
 *
 * Rather than reproduce that geometry, we ask the browser. React Flow's BaseEdge
 * spreads its props onto the `<path>` it renders, so passing `id={edgeId}` puts the
 * edge id on the element and `getPointAtLength` gives an exact point on the curve
 * the user is looking at. The path's `d` is in flow coordinates, so the result is
 * too — no viewport maths, and it stays correct through pan and zoom.
 */

export interface Point {
  x: number
  y: number
}

/**
 * The slice of SVGPathElement this module needs.
 *
 * Declared structurally so the geometry can be unit tested without a DOM, and so
 * a browser that lacks the API degrades instead of throwing.
 */
export interface PathLike {
  getTotalLength(): number
  getPointAtLength(distance: number): Point
}

/** Constrain a progress value to the 0..1 these helpers are defined over. */
export function clamp01(t: number): number {
  // NaN is the only input with no sensible ordering against 0 and 1, so it alone
  // needs a special case; the infinities clamp like any other out-of-range value.
  if (Number.isNaN(t)) return 0
  return t < 0 ? 0 : t > 1 ? 1 : t
}

/** Straight-line position, used when real path geometry is unavailable. */
export function lerpPoint(from: Point, to: Point, t: number): Point {
  const k = clamp01(t)
  return {
    x: from.x + (to.x - from.x) * k,
    y: from.y + (to.y - from.y) * k,
  }
}

export function isPathLike(value: unknown): value is PathLike {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PathLike>
  return (
    typeof candidate.getTotalLength === 'function' &&
    typeof candidate.getPointAtLength === 'function'
  )
}

/** Point at fraction `t` along a path element. */
export function pointOnPath(path: PathLike, t: number): Point | null {
  const total = path.getTotalLength()
  // A zero-length path has no meaningful interior point, and Firefox has been
  // known to report NaN for a path that has not been laid out yet.
  if (!Number.isFinite(total) || total <= 0) return null

  const point = path.getPointAtLength(total * clamp01(t))
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null

  // Copy: SVGPoint instances are live objects owned by the element.
  return { x: point.x, y: point.y }
}

/**
 * The `<path>` React Flow rendered for this edge, if it is currently on screen.
 *
 * Returns null rather than throwing when the edge is virtualised away, the id is
 * stale, or we are rendering on the server.
 */
export function edgePathElement(edgeId: string): PathLike | null {
  if (typeof document === 'undefined' || !edgeId) return null
  // getElementById, not querySelector: edge ids begin with a digit, which is not
  // a valid CSS identifier without escaping.
  const el: unknown = document.getElementById(edgeId)
  return isPathLike(el) ? el : null
}

/** Point at fraction `t` along an edge's rendered connector, in flow coordinates. */
export function pointAlongEdge(edgeId: string, t: number): Point | null {
  const path = edgePathElement(edgeId)
  return path ? pointOnPath(path, t) : null
}
