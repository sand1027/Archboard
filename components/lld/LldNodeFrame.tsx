'use client'

import { memo } from 'react'
import { Handle, NodeResizer, Position } from '@xyflow/react'

export const SELECTED_BLUE = '#3B82F6'

/**
 * Shared chrome for every LLD shape: border, selection ring, resizer and
 * handles. Renderers supply only their compartment content, which is what keeps
 * twelve node components from drifting apart visually.
 *
 * Handles are source AND target on all four sides, following ShapeNode. The
 * legacy Uml* nodes declare target-only on Top/Left and source-only on
 * Bottom/Right, which makes some legal relationships undrawable.
 */

const SIDES = [
  { position: Position.Top, id: 't' },
  { position: Position.Right, id: 'r' },
  { position: Position.Bottom, id: 'b' },
  { position: Position.Left, id: 'l' },
] as const

interface LldNodeFrameProps {
  selected?: boolean
  width: number
  height: number
  minWidth?: number
  minHeight?: number
  /** Omit handles entirely (notes, swimlanes). */
  connectable?: boolean
  resizable?: boolean
  keepAspectRatio?: boolean
  fill?: string
  stroke?: string
  strokeWidth?: number
  /** Dashed border, for abstract/optional semantics. */
  dashed?: boolean
  rounded?: number | string
  /** Rendered instead of the default bordered box (custom SVG shapes). */
  bare?: boolean
  className?: string
  children: React.ReactNode
}

function LldNodeFrame({
  selected,
  width,
  height,
  minWidth = 80,
  minHeight = 40,
  connectable = true,
  resizable = true,
  keepAspectRatio = false,
  fill = '#ffffff',
  stroke = '#334155',
  strokeWidth = 1.5,
  dashed = false,
  rounded = 6,
  bare = false,
  className = '',
  children,
}: LldNodeFrameProps) {
  return (
    <div className="relative select-none" style={{ width, height, minWidth, minHeight }}>
      {resizable && (
        <NodeResizer
          isVisible={!!selected}
          minWidth={minWidth}
          minHeight={minHeight}
          keepAspectRatio={keepAspectRatio}
          color={SELECTED_BLUE}
          handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
        />
      )}

      {connectable &&
        SIDES.map(({ position, id }) => (
          <div key={id}>
            <Handle
              type="target"
              id={`${id}-in`}
              position={position}
              className="!h-2 !w-2 !border-white !bg-slate-400 !opacity-0 transition-opacity group-hover:!opacity-100"
            />
            <Handle
              type="source"
              id={id}
              position={position}
              className="!h-2 !w-2 !border-white !bg-slate-400 !opacity-0 transition-opacity group-hover:!opacity-100"
            />
          </div>
        ))}

      {bare ? (
        <div className={`h-full w-full ${className}`}>{children}</div>
      ) : (
        <div
          className={`flex h-full w-full flex-col overflow-hidden text-slate-900 ${className}`}
          style={{
            background: fill,
            border: `${strokeWidth}px ${dashed ? 'dashed' : 'solid'} ${selected ? SELECTED_BLUE : stroke}`,
            borderRadius: rounded,
            boxShadow: selected ? `0 0 0 1px #93C5FD` : undefined,
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export default memo(LldNodeFrame)
