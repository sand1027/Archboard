/**
 * Canvas geometry helpers, lifted out of Whiteboard.tsx so both the HLD board
 * and the LLD workspace share one implementation.
 */

export interface MeasurableNode {
  position: { x: number; y: number }
  width?: number | null
  height?: number | null
  measured?: { width?: number | null; height?: number | null }
  style?: { width?: number | string; height?: number | string }
}

export interface NodeRect {
  x: number
  y: number
  w: number
  h: number
}

const FALLBACK_W = 100
const FALLBACK_H = 80

/**
 * Resolve a node's box.
 *
 * React Flow spreads size across three fields depending on how the node was
 * created and whether it has been measured yet, so the fallback order matters:
 * explicit `width` → measured → inline `style` → default.
 */
export function nodeBounds(node: MeasurableNode): NodeRect {
  const styleW = typeof node.style?.width === 'number' ? node.style.width : undefined
  const styleH = typeof node.style?.height === 'number' ? node.style.height : undefined

  return {
    x: node.position.x,
    y: node.position.y,
    w: node.width ?? node.measured?.width ?? styleW ?? FALLBACK_W,
    h: node.height ?? node.measured?.height ?? styleH ?? FALLBACK_H,
  }
}

/** Size only — the `{ w, h }` accessor exporters need. */
export function nodeSize(node: MeasurableNode): { w: number; h: number } {
  const { w, h } = nodeBounds(node)
  return { w, h }
}

/** True when the child's centre point falls inside the parent rect. */
export function centerInside(child: MeasurableNode, parent: NodeRect): boolean {
  const c = nodeBounds(child)
  const cx = c.x + c.w / 2
  const cy = c.y + c.h / 2
  return cx >= parent.x && cx <= parent.x + parent.w && cy >= parent.y && cy <= parent.y + parent.h
}

/** Frames and closed shapes can contain other nodes; lines, arrows and text cannot. */
export function isContainerNode(node: { type?: string; data?: Record<string, unknown> }): boolean {
  if (node.type === 'frame') return true
  if (node.type === 'lldSwimlane' || node.type === 'lldFragment') return true
  if (node.type !== 'shape') return false
  const t = String(node.data?.shapeType ?? '')
  return t !== 'line' && t !== 'arrow' && t !== 'text' && !t.startsWith('arrow')
}

/** Union of several node boxes. Returns null for an empty list. */
export function boundsOf(nodes: MeasurableNode[]): NodeRect | null {
  if (nodes.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const n of nodes) {
    const b = nodeBounds(n)
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.w)
    maxY = Math.max(maxY, b.y + b.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** Snap a scalar to the nearest multiple of `grid`. */
export function snap(value: number, grid: number): number {
  return grid <= 0 ? value : Math.round(value / grid) * grid
}
