'use client'

import { memo } from 'react'
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import { SELECTED_BLUE } from '../LldNodeFrame'
import { useInlineEdit } from '../useInlineEdit'
import { useLldActions } from '../LldDiagramContext'
import type { SequenceActivationShape } from '@/types/lld'

/** Source + target on all four sides, for shapes drawn as raw SVG. */
export function AllHandles() {
  return (
    <>
      {(
        [
          [Position.Top, 't'],
          [Position.Right, 'r'],
          [Position.Bottom, 'b'],
          [Position.Left, 'l'],
        ] as const
      ).map(([position, id]) => (
        <div key={id}>
          <Handle
            type="target"
            id={`${id}-in`}
            position={position}
            className="!h-2 !w-2 !border-white !bg-slate-400 !opacity-0 group-hover:!opacity-100"
          />
          <Handle
            type="source"
            id={id}
            position={position}
            className="!h-2 !w-2 !border-white !bg-slate-400 !opacity-0 group-hover:!opacity-100"
          />
        </div>
      ))}
    </>
  )
}

/**
 * Wraps a custom SVG outline with a centred, editable label.
 *
 * The classic flowchart primitives (parallelogram, wavy-bottom document,
 * double-barred subroutine) cannot be expressed with CSS borders, so they are
 * real paths that scale with the node box.
 */
export function SvgShapeNode({
  id,
  label,
  selected,
  width,
  height,
  minWidth,
  minHeight,
  fill,
  stroke,
  draw,
  labelInset = 10,
  ariaLabel,
}: {
  id: string
  label: string
  selected?: boolean
  width: number
  height: number
  minWidth: number
  minHeight: number
  fill: string
  stroke: string
  draw: (w: number, h: number) => React.ReactNode
  labelInset?: number
  ariaLabel: string
}) {
  const { updateShape } = useLldActions()
  const { editing, start, ref, commitProps } = useInlineEdit<'name'>()

  return (
    <div className="group relative" style={{ width, height }}>
      <NodeResizer
        isVisible={!!selected}
        minWidth={minWidth}
        minHeight={minHeight}
        color={SELECTED_BLUE}
        handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
      />
      <AllHandles />

      <svg width={width} height={height} aria-label={ariaLabel} className="absolute inset-0">
        <g fill={fill} stroke={selected ? SELECTED_BLUE : stroke} strokeWidth={1.5}>
          {draw(width, height)}
        </g>
      </svg>

      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ padding: labelInset }}
        onDoubleClick={start('name')}
      >
        {editing === 'name' ? (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            className="w-full bg-transparent text-center text-[12px] outline-none"
            value={label}
            aria-label={`${ariaLabel} label`}
            onChange={(e) => updateShape(id, { label: e.target.value })}
            {...commitProps}
          />
        ) : (
          <span className="line-clamp-3 text-center text-[12px] leading-tight text-slate-800">
            {label}
          </span>
        )}
      </div>
    </div>
  )
}

/** Geometry for the classic flowchart primitives. */
export const FLOW_PATHS = {
  /** Input / output. */
  data: (w: number, h: number) => {
    const skew = Math.min(w * 0.18, 26)
    return <polygon points={`${skew},1 ${w - 1},1 ${w - skew},${h - 1} 1,${h - 1}`} />
  },
  /** Document — flat top, wavy base. */
  document: (w: number, h: number) => {
    const wave = Math.min(h * 0.2, 16)
    const body = h - wave - 1
    return (
      <path
        d={`M 1,1 H ${w - 1} V ${body} Q ${w * 0.75},${body + wave} ${w / 2},${body} Q ${w * 0.25},${body - wave} 1,${body} Z`}
      />
    )
  },
  /** Predefined process / subroutine — double side bars. */
  predefined: (w: number, h: number) => {
    const inset = Math.min(w * 0.1, 14)
    return (
      <>
        <rect x={1} y={1} width={w - 2} height={h - 2} />
        <line x1={inset} y1={1} x2={inset} y2={h - 1} />
        <line x1={w - inset} y1={1} x2={w - inset} y2={h - 1} />
      </>
    )
  },
  /** On-page connector. */
  connector: (w: number, h: number) => (
    <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - 1.5} />
  ),
} as const

/**
 * Activation bar — an execution occurrence sitting on a lifeline.
 *
 * Bars are normally derived from message ordering; this placeable version exists
 * for diagrams drawn by hand rather than message-first.
 */
function ActivationShapeNodeBase({
  data,
  selected,
  width,
  height,
}: NodeProps<SequenceActivationShape>) {
  const w = Math.max(width ?? 0, 8)
  const h = Math.max(height ?? 0, 24)

  return (
    <div className="group relative" style={{ width: w, height: h }}>
      <NodeResizer
        isVisible={!!selected}
        minWidth={8}
        minHeight={24}
        color={SELECTED_BLUE}
        handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
      />
      <div
        className="h-full w-full"
        aria-label="Activation bar"
        style={{
          background: data.fill ?? '#E2E8F0',
          border: `1px solid ${selected ? SELECTED_BLUE : (data.stroke ?? '#64748B')}`,
          borderRadius: 1,
        }}
      />
    </div>
  )
}

export const ActivationShapeNode = memo(ActivationShapeNodeBase)
