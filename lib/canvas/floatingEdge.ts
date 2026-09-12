import { Position, type InternalNode, type Node } from '@xyflow/react'

/**
 * Floating edge geometry.
 *
 * A fixed handle means an edge always leaves the same side, however the nodes
 * are arranged — so an edge with no explicit handle falls back to the node's
 * first handle and every such edge exits the top. Computing the endpoint from
 * geometry instead lets the edge meet whichever side actually faces the other
 * node, and it keeps meeting the right side as nodes move.
 *
 * This is the standard approach for icon-based diagrams (draw.io, Cloudcraft).
 */

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Absolute box of a node, falling back to measured then styled size. */
function nodeRect(node: InternalNode<Node>): Rect {
  const w = node.measured?.width ?? node.width ?? 100
  const h = node.measured?.height ?? node.height ?? 80
  return {
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    w,
    h,
  }
}

/**
 * Where the centre-to-centre line crosses `from`'s border.
 *
 * Solved on the rectangle rather than by sampling: scale the direction vector
 * until it hits whichever edge is reached first.
 */
function borderPoint(from: Rect, to: Rect, inset: number): { x: number; y: number } {
  const fromCx = from.x + from.w / 2
  const fromCy = from.y + from.h / 2
  const toCx = to.x + to.w / 2
  const toCy = to.y + to.h / 2

  const dx = toCx - fromCx
  const dy = toCy - fromCy

  // Concentric nodes have no meaningful direction; anchor at the centre.
  if (dx === 0 && dy === 0) return { x: fromCx, y: fromCy }

  const halfW = Math.max(from.w / 2 - inset, 1)
  const halfH = Math.max(from.h / 2 - inset, 1)

  // Scale so the vector lands exactly on the nearer of the two edge pairs.
  const scaleX = dx === 0 ? Infinity : halfW / Math.abs(dx)
  const scaleY = dy === 0 ? Infinity : halfH / Math.abs(dy)
  const scale = Math.min(scaleX, scaleY)

  return { x: fromCx + dx * scale, y: fromCy + dy * scale }
}

/** Which side of `rect` the point sits on, for correct path curvature. */
function sideOf(rect: Rect, point: { x: number; y: number }): Position {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const dx = (point.x - cx) / Math.max(rect.w / 2, 1)
  const dy = (point.y - cy) / Math.max(rect.h / 2, 1)

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Position.Right : Position.Left
  }
  return dy > 0 ? Position.Bottom : Position.Top
}

export interface FloatingEdgeParams {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
}

/**
 * Endpoints and sides for an edge between two nodes.
 *
 * `inset` pulls the anchor inside the border, which matters for icon nodes whose
 * artwork does not fill its bounding box.
 */
export function getFloatingEdgeParams(
  source: InternalNode<Node>,
  target: InternalNode<Node>,
  inset = 0
): FloatingEdgeParams {
  const sourceRect = nodeRect(source)
  const targetRect = nodeRect(target)

  const sourcePoint = borderPoint(sourceRect, targetRect, inset)
  const targetPoint = borderPoint(targetRect, sourceRect, inset)

  return {
    sourceX: sourcePoint.x,
    sourceY: sourcePoint.y,
    targetX: targetPoint.x,
    targetY: targetPoint.y,
    sourcePosition: sideOf(sourceRect, sourcePoint),
    targetPosition: sideOf(targetRect, targetPoint),
  }
}

/**
 * Architecture nodes carry a label band under the artwork, so the vertical
 * centre of the box is below the icon's centre. Shrinking the box to the icon
 * square makes edges meet the graphic.
 */
export function iconInsetFor(node: InternalNode<Node>, labelHeight: number): Rect {
  const rect = nodeRect(node)
  return { ...rect, h: Math.max(rect.h - labelHeight, 1) }
}

export function getFloatingEdgeParamsForIcons(
  source: InternalNode<Node>,
  target: InternalNode<Node>,
  sourceLabelH: number,
  targetLabelH: number
): FloatingEdgeParams {
  const sourceRect = iconInsetFor(source, sourceLabelH)
  const targetRect = iconInsetFor(target, targetLabelH)

  const sourcePoint = borderPoint(sourceRect, targetRect, 0)
  const targetPoint = borderPoint(targetRect, sourceRect, 0)

  return {
    sourceX: sourcePoint.x,
    sourceY: sourcePoint.y,
    targetX: targetPoint.x,
    targetY: targetPoint.y,
    sourcePosition: sideOf(sourceRect, sourcePoint),
    targetPosition: sideOf(targetRect, targetPoint),
  }
}
