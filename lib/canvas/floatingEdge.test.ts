import { describe, it, expect } from 'vitest'
import { Position, type InternalNode, type Node } from '@xyflow/react'
import { getFloatingEdgeParams, getFloatingEdgeParamsForIcons } from './floatingEdge'

/** Minimal stand-in for React Flow's measured internal node. */
function node(x: number, y: number, w = 100, h = 100, type = 'architecture'): InternalNode<Node> {
  return {
    id: `${x}-${y}`,
    type,
    position: { x, y },
    data: {},
    measured: { width: w, height: h },
    internals: { positionAbsolute: { x, y } },
  } as unknown as InternalNode<Node>
}

describe('getFloatingEdgeParams', () => {
  // The bug this fixes: a fixed handle means every edge leaves the same side.
  it('picks the facing sides when the target is to the right', () => {
    const p = getFloatingEdgeParams(node(0, 0), node(300, 0))
    expect(p.sourcePosition).toBe(Position.Right)
    expect(p.targetPosition).toBe(Position.Left)
  })

  it('picks the facing sides when the target is to the left', () => {
    const p = getFloatingEdgeParams(node(300, 0), node(0, 0))
    expect(p.sourcePosition).toBe(Position.Left)
    expect(p.targetPosition).toBe(Position.Right)
  })

  it('picks vertical sides when the target is below', () => {
    const p = getFloatingEdgeParams(node(0, 0), node(0, 300))
    expect(p.sourcePosition).toBe(Position.Bottom)
    expect(p.targetPosition).toBe(Position.Top)
  })

  it('picks vertical sides when the target is above', () => {
    const p = getFloatingEdgeParams(node(0, 300), node(0, 0))
    expect(p.sourcePosition).toBe(Position.Top)
    expect(p.targetPosition).toBe(Position.Bottom)
  })

  it('anchors on the border, not the centre', () => {
    const p = getFloatingEdgeParams(node(0, 0, 100, 100), node(300, 0, 100, 100))
    // Source centre is (50,50); its right border is x=100.
    expect(p.sourceX).toBeCloseTo(100)
    expect(p.sourceY).toBeCloseTo(50)
    // Target centre is (350,50); its left border is x=300.
    expect(p.targetX).toBeCloseTo(300)
    expect(p.targetY).toBeCloseTo(50)
  })

  it('favours the horizontal side on a shallow diagonal', () => {
    const p = getFloatingEdgeParams(node(0, 0), node(400, 40))
    expect(p.sourcePosition).toBe(Position.Right)
  })

  it('favours the vertical side on a steep diagonal', () => {
    const p = getFloatingEdgeParams(node(0, 0), node(40, 400))
    expect(p.sourcePosition).toBe(Position.Bottom)
  })

  it('does not divide by zero for concentric nodes', () => {
    const p = getFloatingEdgeParams(node(0, 0), node(0, 0))
    expect(Number.isFinite(p.sourceX)).toBe(true)
    expect(Number.isFinite(p.targetY)).toBe(true)
  })

  it('keeps the anchor on the border as nodes move', () => {
    const near = getFloatingEdgeParams(node(0, 0), node(200, 0))
    const far = getFloatingEdgeParams(node(0, 0), node(900, 0))
    expect(near.sourceX).toBeCloseTo(far.sourceX)
  })
})

describe('getFloatingEdgeParamsForIcons', () => {
  // Architecture nodes carry a 20px label band, so the box centre sits below the
  // artwork centre and edges would meet the caption rather than the icon.
  it('lifts the anchor above the label band', () => {
    const withLabel = getFloatingEdgeParamsForIcons(
      node(0, 0, 72, 88),
      node(400, 0, 72, 88),
      20,
      20
    )
    const withoutLabel = getFloatingEdgeParams(node(0, 0, 72, 88), node(400, 0, 72, 88))

    expect(withLabel.sourceY).toBeLessThan(withoutLabel.sourceY)
    // Icon area is 68px tall, so its centre is y=34.
    expect(withLabel.sourceY).toBeCloseTo(34)
  })

  it('still resolves the facing sides', () => {
    const p = getFloatingEdgeParamsForIcons(node(0, 0, 72, 88), node(0, 400, 72, 88), 20, 20)
    expect(p.sourcePosition).toBe(Position.Bottom)
    expect(p.targetPosition).toBe(Position.Top)
  })

  it('treats a zero label band the same as no label', () => {
    const a = getFloatingEdgeParamsForIcons(node(0, 0), node(300, 0), 0, 0)
    const b = getFloatingEdgeParams(node(0, 0), node(300, 0))
    expect(a).toEqual(b)
  })
})
