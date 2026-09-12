'use client'

import { memo, useCallback } from 'react'
import {
  useInternalNode,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  MarkerType,
  type EdgeProps,
  type Edge,
} from '@xyflow/react'
import type { ArchitectureEdgeData, RelationKind } from '@/types/architecture'
import { useSimulationStore } from '@/store/simulationStore'
import { HLD_NOTATION, PROTOCOL_COLORS } from '@/lib/canvas/hldNotation'
import { markerUrl } from '@/lib/canvas/markers'
import { getFloatingEdgeParamsForIcons } from '@/lib/canvas/floatingEdge'
import {
  curveThrough,
  hasOffset,
  offsetMidpoint,
  polylineThrough,
  type EdgeOffset,
} from '@/lib/canvas/edgeOffset'
import { EdgeDragHandle } from './EdgeDragHandle'
import { useEdgeOffsetDrag } from './useEdgeOffsetDrag'
import { useDiagramStore } from '@/store/diagramStore'
import { dashArray } from '@/types/lld'

type ArchitectureEdgeType = Edge<ArchitectureEdgeData>

const RELATION_STYLES: Partial<
  Record<RelationKind, { strokeDasharray?: string; end?: MarkerType; start?: MarkerType; label?: string }>
> = {
  association:      { end: MarkerType.ArrowClosed },
  inheritance:      { end: MarkerType.Arrow },
  realization:      { strokeDasharray: '6,4', end: MarkerType.Arrow },
  dependency:       { strokeDasharray: '6,4', end: MarkerType.ArrowClosed },
  composition:      { end: MarkerType.ArrowClosed, start: MarkerType.ArrowClosed },
  aggregation:      { end: MarkerType.ArrowClosed },
  'one-to-one':     { end: MarkerType.ArrowClosed, label: '1:1' },
  'one-to-many':    { end: MarkerType.ArrowClosed, label: '1:N' },
  'many-to-many':   { end: MarkerType.ArrowClosed, label: 'N:M' },
  'message-sync':   { end: MarkerType.ArrowClosed },
  'message-async':  { strokeDasharray: '6,4', end: MarkerType.ArrowClosed },
  'message-return': { strokeDasharray: '4,3', end: MarkerType.Arrow },
}

// Sim colors per packet — must match engine.ts PACKET_COLORS
const SIM_COLORS = [
  '#3B82F6','#10B981','#F59E0B','#8B5CF6',
  '#EF4444','#0EA5E9','#F97316','#EC4899',
]

/** Label band height on architecture nodes; see ArchitectureNode. */
const ARCH_LABEL_H = 20

function ArchitectureEdgeComponent({
  id,
  source, target,
  sourceHandleId, targetHandleId,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  data, selected,
  markerEnd, markerStart,
  style: inlineStyle,
}: EdgeProps<ArchitectureEdgeType>) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  const updateEdge = useDiagramStore((st) => st.updateEdge)

  const offset = data?.offset
  const applyOffset = useCallback(
    (next: EdgeOffset | undefined) => updateEdge(id, { offset: next }),
    [id, updateEdge]
  )
  const drag = useEdgeOffsetDrag(offset, applyOffset)

  // ── Simulation state — subscribe to a string that changes each tick ─────────
  // We use string-based tick ID so the component knows when to re-check
  const simStatus     = useSimulationStore((s) => s.status)
  const isActive      = useSimulationStore((s) => s.activeEdgeIds.has(id))
  const isFailed      = useSimulationStore((s) => s.failedEdgeIds.has(id))
  const packetColor   = useSimulationStore((s) => {
    const pkt = s.packets.find((p) => p.edgeId === id)
    return pkt?.color ?? null
  })

  const isSimulating = simStatus === 'running' || simStatus === 'paused'
  const simColor = isActive ? packetColor : null

  // ── Normal edge styling ───────────────────────────────────────────────────
  const relationKind = data?.relationKind as RelationKind | undefined
  const relation = relationKind ? RELATION_STYLES[relationKind] : undefined

  const connType = data?.connectionType ?? 'synchronous'
  const semantic = HLD_NOTATION[connType] ?? HLD_NOTATION.synchronous
  // Routing comes from the notation table, which asks for orthogonal
  // (smoothstep) connectors — the clean right-angled look the LLD board already
  // has. This previously hardcoded 'bezier', so HLD_NOTATION.path was ignored and
  // every HLD edge rendered as a loose curve.
  const lineStyle =
    (data?.edgeLineStyle as string) ??
    (relationKind?.startsWith('message') ? 'straight' : semantic.path)
  const protocolColor = data?.protocol
    ? (PROTOCOL_COLORS[data.protocol] ?? '#374151')
    : '#374151'

  // When simulating: active = packet color, failed = red, rest = dim
  let strokeColor: string
  let strokeWidth: number
  let strokeDash: string | undefined
  let opacity = 1

  if (isSimulating) {
    if (isActive && simColor) {
      strokeColor = simColor
      strokeWidth = 2.5
      strokeDash  = undefined   // animated flow — no manual dash, let RF handle it
    } else if (isFailed) {
      strokeColor = '#EF4444'
      strokeWidth = 2
      strokeDash  = '4,3'
    } else {
      // non-active edges dim during simulation
      strokeColor = '#D1D5DB'
      strokeWidth = 1
      strokeDash  = undefined
      opacity = 0.35
    }
  } else {
    strokeColor = selected ? '#3B82F6' : (inlineStyle?.stroke as string) ?? semantic.stroke
    strokeWidth = ((inlineStyle?.strokeWidth as number) ?? semantic.strokeWidth) + (selected ? 0.5 : 0)
    strokeDash =
      (inlineStyle?.strokeDasharray as string) ??
      relation?.strokeDasharray ??
      dashArray(semantic.line, semantic.strokeWidth)
  }

  // ── Path ─────────────────────────────────────────────────────────────────
  // An explicit handle is a deliberate choice, so honour it. Without one the
  // edge floats: endpoints are derived from geometry so it meets whichever sides
  // actually face each other, instead of defaulting to the first handle (which
  // made every such edge leave the top).
  // Only the four side handles are genuine anchors. A stale id (e.g. the
  // connect-mode `body` handle, which unmounts with the preset) must fall through
  // to floating geometry rather than be trusted.
  const isSideHandle = (h: string | null | undefined) => !!h && /^[trbl](-in)?$/.test(h)
  const hasExplicitHandles = isSideHandle(sourceHandleId) && isSideHandle(targetHandleId)

  const floating =
    !hasExplicitHandles && sourceNode && targetNode
      ? getFloatingEdgeParamsForIcons(
          sourceNode,
          targetNode,
          sourceNode.type === 'architecture' ? ARCH_LABEL_H : 0,
          targetNode.type === 'architecture' ? ARCH_LABEL_H : 0
        )
      : null

  const pathArgs = floating ?? {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  }
  let edgePath: string, labelX: number, labelY: number

  if (lineStyle === 'straight') {
    ;[edgePath, labelX, labelY] = getStraightPath(pathArgs)
  } else if (lineStyle === 'step' || lineStyle === 'smoothstep') {
    ;[edgePath, labelX, labelY] = getSmoothStepPath({
      ...pathArgs,
      borderRadius: lineStyle === 'smoothstep' ? 12 : 0,
    })
  } else {
    ;[edgePath, labelX, labelY] = getBezierPath(pathArgs)
  }

  // ── manual nudge ──────────────────────────────────────────────────────────
  // An offset pulls the line through a dragged midpoint. The label moves with it,
  // which is the point: two edges sharing a node pair otherwise stack their
  // labels on top of each other.
  const ends = {
    sourceX: pathArgs.sourceX,
    sourceY: pathArgs.sourceY,
    targetX: pathArgs.targetX,
    targetY: pathArgs.targetY,
  }
  const midpoint = offsetMidpoint(ends, offset)

  if (hasOffset(offset)) {
    // Bezier routing keeps a curve; everything else bends at the dragged point so
    // a nudged connector stays as crisp as it was before the drag.
    edgePath =
      lineStyle === 'bezier'
        ? curveThrough(ends, midpoint)
        : polylineThrough(ends, midpoint)
    labelX = midpoint.x
    labelY = midpoint.y
  }

  const edgeStyle: React.CSSProperties = {
    stroke: strokeColor,
    strokeWidth,
    strokeDasharray: isActive ? undefined : strokeDash,   // class handles dash when active
    opacity,
    transition: isSimulating ? 'stroke 0.15s, opacity 0.15s' : undefined,
  }

  const displayLabel =
    data?.label ||
    data?.protocol ||
    relation?.label ||
    (relationKind ? relationKind.replace(/-/g, ' ') : '')

  const hasLabel = !!displayLabel && !isSimulating  // hide labels during sim to reduce clutter

  // Arrowheads come from HLD_NOTATION (or the LLD relation table on the legacy
  // board). Custom SVG markers, so replication reads differently from an event.
  const notationEnd = relation?.end
    ? { type: relation.end, width: 16, height: 16, color: strokeColor }
    : undefined
  const notationStart = relation?.start
    ? { type: relation.start, width: 14, height: 14, color: strokeColor }
    : undefined

  const resolvedMarkerEnd = markerEnd ?? notationEnd
  const resolvedMarkerStart = markerStart ?? notationStart

  // When no legacy relation/inline marker applies, use the shared glyph set.
  const glyphEnd =
    !resolvedMarkerEnd && !isSimulating ? markerUrl(semantic.endMarker, strokeColor) : undefined
  const glyphStart =
    !resolvedMarkerStart && !isSimulating
      ? markerUrl(semantic.startMarker, strokeColor)
      : undefined

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        // Widen the click target; a 1.5px line is hard to hit precisely. React
        // Flow renders this as a separate transparent path, so it does not
        // interfere with the visible stroke.
        interactionWidth={20}
        style={edgeStyle}
        className={isActive ? 'sim-edge-active' : undefined}
        markerEnd={(resolvedMarkerEnd ?? glyphEnd) as typeof markerEnd}
        markerStart={(resolvedMarkerStart ?? glyphStart) as typeof markerStart}
      />

      {/*
        Grab strip over the whole line. A single midpoint dot means the user has
        to find a 14px target before the edge will move; here any point on the
        connector can be dragged. Transparent stroke with pointerEvents on the
        stroke only, so it widens the grab area without covering the canvas.
        Clicks still bubble to React Flow's edge group, which is what selects the
        edge — the hook only takes over once the pointer has actually moved.
      */}
      {!isSimulating && (
        <path
          d={edgePath}
          className="nodrag nopan"
          fill="none"
          stroke="transparent"
          strokeWidth={22}
          strokeLinecap="round"
          style={{ pointerEvents: 'stroke', cursor: drag.dragging ? 'grabbing' : 'grab' }}
          {...drag.dragProps}
          {...drag.resetProps}
        />
      )}

      {hasLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              // Lifted clear of the line so the grab dot at the midpoint stays
              // readable underneath it.
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY - 14}px)`,
              // Decoration only. With pointer events on, the chip sat over the
              // middle of the line and swallowed both the grab dot and any click
              // meant to select the edge.
              pointerEvents: 'none',
            }}
            className="nodrag nopan"
          >
            <div
              className={[
                'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                'bg-white border shadow-sm whitespace-nowrap',
                selected ? 'border-blue-400' : 'border-gray-200',
              ].join(' ')}
              style={{ color: data?.protocol ? protocolColor : '#475569' }}
            >
              {data?.protocol && (
                <span className="font-semibold">{data.protocol as string}</span>
              )}
              {data?.label && data?.protocol && (
                <span className="text-gray-300">·</span>
              )}
              {(data?.label || (!data?.protocol && displayLabel)) && (
                <span className="text-gray-600 capitalize">
                  {(data?.label as string) || displayLabel}
                </span>
              )}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}

      {/* After the label on purpose: rendered before it, the chip painted over
          the dot and the edge looked immovable. */}
      <EdgeLabelRenderer>
        <EdgeDragHandle
          x={midpoint.x}
          y={midpoint.y}
          visible={!!selected && !isSimulating}
          color={strokeColor}
          drag={drag}
        />
      </EdgeLabelRenderer>
    </>
  )
}

export default memo(ArchitectureEdgeComponent)
