'use client'

import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
} from '@xyflow/react'
import { markerUrl } from '@/lib/canvas/markers'
import { NOTATION, cardinalityLabel, cardinalityMarker } from '@/lib/canvas/notation'
import { SELECTED_BLUE } from './LldNodeFrame'
import { useLldScope } from './LldDiagramContext'
import {
  dashArray,
  formatTransitionLabel,
  type ClassRelationData,
  type ErRelationData,
  type LldEdge,
  type LldEdgeStyle,
} from '@/types/lld'

/**
 * Generic NOTATION-driven edge, used by six of the seven diagram types.
 *
 * Arrowheads come from NOTATION, never from defaultEdgeOptions — the HLD canvas
 * sets markerEnd unconditionally and its edge resolves `markerEnd ?? …`, which
 * permanently masks relation-driven arrowheads. Not repeating that here.
 */
function LldEdgeRenderer({
  id,
  data,
  selected,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps<LldEdge>) {
  const { erNotation } = useLldScope()

  const kind = data?.kind
  if (!kind) return null

  const base = NOTATION[kind]
  if (!base) return null

  const style: LldEdgeStyle = { ...base, ...data?.styleOverride }
  const color = selected ? SELECTED_BLUE : style.stroke

  // ER cardinality overrides the notation defaults per endpoint, since
  // "one-to-many" is really a pair of independent endpoint cardinalities.
  let startMarker = style.startMarker
  let endMarker = style.endMarker
  let sourceEndLabel: string | undefined
  let targetEndLabel: string | undefined

  const erData = isErRelation(kind) ? (data as ErRelationData) : null
  if (erData && kind !== 'er-fk-ref') {
    if (erNotation === 'uml') {
      startMarker = 'none'
      endMarker = 'none'
      sourceEndLabel = cardinalityLabel(erData.sourceCardinality)
      targetEndLabel = cardinalityLabel(erData.targetCardinality)
    } else {
      startMarker = cardinalityMarker(erData.sourceCardinality)
      endMarker = cardinalityMarker(erData.targetCardinality)
    }
  }

  const classData = isClassRelation(kind) ? (data as ClassRelationData) : null
  if (classData) {
    sourceEndLabel = classData.sourceMultiplicity
    targetEndLabel = classData.targetMultiplicity
    if (kind === 'association' && classData.isDirected) endMarker = 'arrow-open'
  }

  const args = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }
  const [path, labelX, labelY] =
    style.path === 'straight'
      ? getStraightPath(args)
      : style.path === 'bezier'
        ? getBezierPath(args)
        : getSmoothStepPath({ ...args, borderRadius: style.path === 'smoothstep' ? 12 : 0 })

  const strokeWidth = style.strokeWidth + (selected ? 0.5 : 0)

  const mainLabel =
    data?.label ||
    // include / extend are only distinguishable by their stereotype.
    (kind === 'uc-include' ? '«include»' : '') ||
    (kind === 'uc-extend' ? '«extend»' : '') ||
    (kind === 'state-transition' ? formatTransitionLabel(data as never) : '') ||
    (kind === 'api-response' && 'statusCode' in (data ?? {})
      ? String((data as { statusCode?: number }).statusCode ?? '')
      : '')

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerStart={markerUrl(startMarker, color)}
        markerEnd={markerUrl(endMarker, color)}
        style={{
          stroke: color,
          strokeWidth,
          strokeDasharray: dashArray(style.line, style.strokeWidth),
        }}
      />

      <EdgeLabelRenderer>
        {mainLabel && (
          <EdgeChip x={labelX} y={labelY} selected={selected}>
            {mainLabel}
          </EdgeChip>
        )}

        {/* Multiplicity belongs at the end it describes, not the midpoint. */}
        {sourceEndLabel && (
          <EndLabel x={sourceX} y={sourceY} position={sourcePosition}>
            {sourceEndLabel}
          </EndLabel>
        )}
        {targetEndLabel && (
          <EndLabel x={targetX} y={targetY} position={targetPosition}>
            {targetEndLabel}
          </EndLabel>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

function EdgeChip({
  x,
  y,
  selected,
  children,
}: {
  x: number
  y: number
  selected?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={[
        'absolute whitespace-nowrap rounded-full border bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm',
        selected ? 'border-blue-400' : 'border-slate-200',
      ].join(' ')}
      style={{ transform: `translate(-50%, -50%) translate(${x}px,${y}px)`, pointerEvents: 'all' }}
    >
      {children}
    </div>
  )
}

/** Offset the label outward from the endpoint so it does not sit on the marker. */
function EndLabel({
  x,
  y,
  position,
  children,
}: {
  x: number
  y: number
  position?: string
  children: React.ReactNode
}) {
  const OFF = 16
  let dx = 0
  let dy = 0
  if (position === 'top') dy = -OFF
  else if (position === 'bottom') dy = OFF
  else if (position === 'left') dx = -OFF
  else dx = OFF

  return (
    <div
      className="absolute whitespace-nowrap text-[10px] font-medium text-slate-500"
      style={{
        transform: `translate(-50%, -50%) translate(${x + dx}px,${y + dy}px)`,
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>
  )
}

function isErRelation(kind: string): boolean {
  return kind.startsWith('er-')
}

function isClassRelation(kind: string): boolean {
  return (
    kind === 'inheritance' ||
    kind === 'realization' ||
    kind === 'composition' ||
    kind === 'aggregation' ||
    kind === 'association' ||
    kind === 'dependency'
  )
}

export default memo(LldEdgeRenderer)
