'use client'

import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react'
import type { ArchitectureEdgeData } from '@/types/architecture'

type ArchitectureEdgeType = Edge<ArchitectureEdgeData>

// Semantic colours when no explicit stroke is set
const CONNECTION_STYLES: Record<string, { stroke: string; strokeDasharray?: string; strokeWidth: number }> = {
  synchronous:    { stroke: '#374151', strokeWidth: 1.5 },
  asynchronous:   { stroke: '#7C3AED', strokeDasharray: '6,4', strokeWidth: 1.5 },
  replication:    { stroke: '#1D4ED8', strokeWidth: 2.5 },
  event:          { stroke: '#D97706', strokeDasharray: '4,3', strokeWidth: 1.5 },
  read:           { stroke: '#0284C7', strokeWidth: 1.5 },
  write:          { stroke: '#DC2626', strokeWidth: 1.5 },
  bidirectional:  { stroke: '#374151', strokeWidth: 1.5 },
}

const PROTOCOL_COLORS: Record<string, string> = {
  HTTP:      '#374151',
  HTTPS:     '#059669',
  TCP:       '#374151',
  UDP:       '#6B7280',
  gRPC:      '#7C3AED',
  WebSocket: '#D97706',
  SSE:       '#0EA5E9',
  REST:      '#059669',
  GraphQL:   '#E10098',
  Kafka:     '#D97706',
  AMQP:      '#F43F5E',
  MQTT:      '#0EA5E9',
}

function ArchitectureEdgeComponent({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  data, selected,
  markerEnd, markerStart,
  style: inlineStyle,
}: EdgeProps<ArchitectureEdgeType>) {

  const connType    = data?.connectionType ?? 'synchronous'
  const semantic    = CONNECTION_STYLES[connType] ?? CONNECTION_STYLES.synchronous
  const lineStyle   = (data?.edgeLineStyle as string) ?? 'bezier'
  const protocolColor = data?.protocol ? PROTOCOL_COLORS[data.protocol as string] ?? '#374151' : '#374151'

  // Inline style (set when edge was drawn with custom style preset) wins over semantic
  const strokeColor  = selected ? '#3B82F6' : (inlineStyle?.stroke as string) ?? semantic.stroke
  const strokeWidth  = ((inlineStyle?.strokeWidth as number) ?? semantic.strokeWidth) + (selected ? 0.5 : 0)
  const strokeDash   = (inlineStyle?.strokeDasharray as string) ?? semantic.strokeDasharray

  // Build path based on line style
  const pathArgs = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }

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

  const edgeStyle = {
    stroke: strokeColor,
    strokeWidth,
    strokeDasharray: strokeDash,
  }

  const hasLabel = !!(data?.label || data?.protocol)

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />

      {hasLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div
              className={[
                'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                'bg-white border shadow-sm whitespace-nowrap',
                selected ? 'border-blue-400' : 'border-gray-200',
              ].join(' ')}
              style={{ color: protocolColor }}
            >
              {data?.protocol && (
                <span className="font-semibold">{data.protocol as string}</span>
              )}
              {data?.label && data?.protocol && (
                <span className="text-gray-300">·</span>
              )}
              {data?.label && (
                <span className="text-gray-600">{data.label as string}</span>
              )}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default memo(ArchitectureEdgeComponent)
