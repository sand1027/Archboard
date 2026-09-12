'use client'

import type { EdgeOffsetDrag } from './useEdgeOffsetDrag'

/**
 * Grab dot at an edge's midpoint.
 *
 * Purely presentational: the gesture lives in useEdgeOffsetDrag so this dot and
 * the wide overlay on the line drive the same drag. Rendered inside
 * EdgeLabelRenderer, which means screen space — the hook converts back to canvas
 * units.
 */
export function EdgeDragHandle({
  x,
  y,
  visible,
  color,
  drag,
}: {
  x: number
  y: number
  visible: boolean
  color: string
  drag: EdgeOffsetDrag
}) {
  const shown = visible || drag.dragging

  return (
    <button
      type="button"
      // nodrag/nopan keep React Flow's own gestures off this element.
      className="nodrag nopan absolute"
      aria-label="Drag to reposition the connection. Double-click to straighten."
      title="Drag to reposition · double-click to straighten"
      tabIndex={shown ? 0 : -1}
      style={{
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        // While hidden the dot must not intercept clicks meant for the line
        // underneath it — an invisible target that eats pointers reads as the
        // edge simply not responding.
        pointerEvents: shown ? 'all' : 'none',
        cursor: drag.dragging ? 'grabbing' : 'grab',
        width: 14,
        height: 14,
        borderRadius: 999,
        opacity: shown ? 1 : 0,
        background: '#ffffff',
        border: `2px solid ${color}`,
        boxShadow: drag.dragging ? `0 0 0 4px ${color}33` : undefined,
        transition: drag.dragging ? undefined : 'opacity 0.12s',
      }}
      {...drag.dragProps}
      {...drag.resetProps}
    />
  )
}
