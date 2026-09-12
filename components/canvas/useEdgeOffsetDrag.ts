'use client'

import { useCallback, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  nextOffset,
  screenDeltaToFlow,
  type EdgeOffset,
} from '@/lib/canvas/edgeOffset'

/** Below this total movement a gesture counts as a click, not a drag. */
const CLICK_SLOP = 3

export interface EdgeOffsetDrag {
  dragging: boolean
  /** Spread onto any element that should nudge the edge when dragged. */
  dragProps: {
    onPointerDown: (e: React.PointerEvent<Element>) => void
    onPointerMove: (e: React.PointerEvent<Element>) => void
    onPointerUp: (e: React.PointerEvent<Element>) => void
    onPointerCancel: (e: React.PointerEvent<Element>) => void
    onClick: (e: React.MouseEvent<Element>) => void
  }
  /** Double-click to straighten. */
  resetProps: { onDoubleClick: (e: React.MouseEvent<Element>) => void }
}

/**
 * Pointer-drag behaviour for nudging an edge sideways.
 *
 * One instance is shared by the visible grab dot and the invisible wide overlay
 * on the line, so the user can grab either and both agree on the drag state.
 *
 * Pointer-down is deliberately *not* swallowed: React Flow selects an edge from
 * the click that follows, and a gesture under CLICK_SLOP has to stay a plain
 * click. Only once the pointer has actually travelled do we take the events over
 * and cancel the trailing click.
 */
export function useEdgeOffsetDrag(
  offset: EdgeOffset | undefined,
  onChange: (offset: EdgeOffset | undefined) => void
): EdgeOffsetDrag {
  const { getZoom } = useReactFlow()
  const [dragging, setDragging] = useState(false)

  // Refs, so the move handler never reads a stale offset or start point.
  const origin = useRef<{ x: number; y: number; offset: EdgeOffset | undefined } | null>(null)
  const moved = useRef(0)

  const onPointerDown = useCallback(
    (e: React.PointerEvent<Element>) => {
      if (e.button !== 0) return
      origin.current = { x: e.clientX, y: e.clientY, offset }
      moved.current = 0
      setDragging(true)
      ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    },
    [offset]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<Element>) => {
      const start = origin.current
      if (!start) return

      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      moved.current = Math.max(moved.current, Math.hypot(dx, dy))

      // Ignore jitter so a click does not leave a 1px offset behind.
      if (moved.current < CLICK_SLOP) return

      e.stopPropagation()
      onChange(nextOffset(start.offset, screenDeltaToFlow(dx, dy, getZoom())))
    },
    [getZoom, onChange]
  )

  const endDrag = useCallback((e: React.PointerEvent<Element>) => {
    const el = e.currentTarget as Element
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
    origin.current = null
    setDragging(false)
  }, [])

  // A drag is followed by a click event; left alone it would toggle selection
  // as a side effect of repositioning the line.
  const onClick = useCallback((e: React.MouseEvent<Element>) => {
    if (moved.current < CLICK_SLOP) return
    moved.current = 0
    e.stopPropagation()
  }, [])

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<Element>) => {
      e.stopPropagation()
      onChange(undefined)
    },
    [onChange]
  )

  return {
    dragging,
    dragProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onClick,
    },
    resetProps: { onDoubleClick },
  }
}
