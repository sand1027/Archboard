'use client'

import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  useInternalNode,
  type EdgeProps,
} from '@xyflow/react'
import { markerUrl } from '@/lib/canvas/markers'
import { NOTATION } from '@/lib/canvas/notation'
import { SELF_CALL_WIDTH, messageY } from '@/lib/lld/sequenceLayout'
import { SELECTED_BLUE } from './LldNodeFrame'
import { dashArray, type SequenceMessage } from '@/types/lld'

/**
 * Sequence message with time-axis geometry.
 *
 * Deliberately ignores React Flow's sourceX/Y and targetX/Y: a message's Y comes
 * from its `order` slot, and its X endpoints are the two lifelines' centres.
 * Handle-derived geometry would let messages drift off the shared time axis.
 */
function LldSequenceMessageEdge({
  id,
  source,
  target,
  data,
  selected,
}: EdgeProps<SequenceMessage>) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)

  if (!sourceNode || !targetNode || !data) return null

  const base = NOTATION[data.kind]
  if (!base) return null

  const style = { ...base, ...data.styleOverride }
  const color = selected ? SELECTED_BLUE : style.stroke
  const strokeWidth = style.strokeWidth + (selected ? 0.5 : 0)

  const centerX = (node: typeof sourceNode) =>
    node.internals.positionAbsolute.x + (node.measured.width ?? 140) / 2

  const y = messageY(data.order)
  const x1 = centerX(sourceNode)
  const x2 = centerX(targetNode)

  const isSelfCall = source === target

  let path: string
  let labelX: number
  let labelY: number

  if (isSelfCall) {
    // Rectangular loop out to the right and back, spanning two slots.
    const out = x1 + SELF_CALL_WIDTH
    const yBack = y + 26
    path = `M ${x1},${y} L ${out},${y} L ${out},${yBack} L ${x1},${yBack}`
    labelX = out + 8
    labelY = y + 13
  } else {
    path = `M ${x1},${y} L ${x2},${y}`
    labelX = (x1 + x2) / 2
    labelY = y - 12
  }

  const arrowsLeft = !isSelfCall && x2 < x1

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerUrl(style.endMarker, color)}
        markerStart={markerUrl(style.startMarker, color)}
        style={{
          stroke: color,
          strokeWidth,
          strokeDasharray: dashArray(style.line, style.strokeWidth),
          fill: 'none',
        }}
      />

      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute flex items-center gap-1 whitespace-nowrap"
          style={{
            transform: `translate(${arrowsLeft ? '-50%' : '-50%'}, -100%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
        >
          <span className="rounded bg-white/90 px-1 text-[9px] font-semibold tabular-nums text-slate-400">
            {data.order + 1}
          </span>
          <span
            className={[
              'rounded px-1.5 py-0.5 text-[10px] font-medium',
              selected ? 'bg-blue-50 text-blue-700' : 'bg-white/90 text-slate-700',
            ].join(' ')}
          >
            {data.label || labelFor(data.kind)}
          </span>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

function labelFor(kind: SequenceMessage['data'] extends undefined ? never : string): string {
  switch (kind) {
    case 'msg-return':
      return 'return'
    case 'msg-create':
      return '«create»'
    case 'msg-destroy':
      return '«destroy»'
    case 'msg-async':
      return 'async'
    default:
      return 'message'
  }
}

export default memo(LldSequenceMessageEdge)
