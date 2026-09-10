'use client'

import { memo } from 'react'
import { NodeResizer, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import type { FrameNodeData } from '@/types/architecture'

type FrameNodeType = Node<FrameNodeData, 'frame'>

const FRAME_STYLES: Record<string, { bg: string; border: string; label: string }> = {
  region:           { bg: '#FFF7ED', border: '#F97316', label: '#C2410C' },
  'availability-zone': { bg: '#EFF6FF', border: '#3B82F6', label: '#1D4ED8' },
  vpc:              { bg: '#F0FDF4', border: '#16A34A', label: '#15803D' },
  cluster:          { bg: '#F5F3FF', border: '#7C3AED', label: '#6D28D9' },
  service:          { bg: '#ECFDF5', border: '#10B981', label: '#047857' },
  'database-cluster': { bg: '#EFF6FF', border: '#1D4ED8', label: '#1E40AF' },
  'data-center':    { bg: '#F1F5F9', border: '#475569', label: '#334155' },
  custom:           { bg: '#F8FAFC', border: '#94A3B8', label: '#64748B' },
}

function FrameNode({ data, selected }: NodeProps<FrameNodeType>) {
  const frameStyle = FRAME_STYLES[data.frameType] ?? FRAME_STYLES.custom

  return (
    <div
      className="relative rounded-lg"
      style={{
        width: '100%',
        height: '100%',
        minWidth: 200,
        minHeight: 150,
        backgroundColor: frameStyle.bg,
        border: `2px dashed ${selected ? '#3B82F6' : frameStyle.border}`,
      }}
    >
      <NodeResizer
        minWidth={150}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-blue-400"
        handleClassName="bg-white border-2 border-blue-400 rounded-sm"
      />

      {/* Frame label */}
      <div
        className="absolute top-2 left-3 flex items-center gap-1.5"
      >
        <span
          className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
          style={{
            color: frameStyle.label,
            backgroundColor: `${frameStyle.border}20`,
            border: `1px solid ${frameStyle.border}40`,
          }}
        >
          {data.frameType.replace('-', ' ')}
        </span>
        <span
          className="text-xs font-medium"
          style={{ color: frameStyle.label }}
        >
          {data.label}
        </span>
      </div>

      {/* Description */}
      {data.description && (
        <div className="absolute top-8 left-3 right-3">
          <span className="text-[10px] text-gray-400">{data.description}</span>
        </div>
      )}
    </div>
  )
}

export default memo(FrameNode)
