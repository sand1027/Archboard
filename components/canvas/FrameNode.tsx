'use client'

import { memo, useRef, useCallback } from 'react'
import { NodeResizer, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import type { FrameNodeData } from '@/types/architecture'
import { useDiagramStore } from '@/store/diagramStore'

type FrameNodeType = Node<FrameNodeData, 'frame'>

const FRAME_STYLES: Record<string, { bg: string; border: string; label: string }> = {
  region:              { bg: '#FFF7ED', border: '#F97316', label: '#C2410C' },
  'availability-zone': { bg: '#EFF6FF', border: '#3B82F6', label: '#1D4ED8' },
  vpc:                 { bg: '#F0FDF4', border: '#16A34A', label: '#15803D' },
  cluster:             { bg: '#F5F3FF', border: '#7C3AED', label: '#6D28D9' },
  service:             { bg: '#ECFDF5', border: '#10B981', label: '#047857' },
  'database-cluster':  { bg: '#EFF6FF', border: '#1D4ED8', label: '#1E40AF' },
  'data-center':       { bg: '#F1F5F9', border: '#475569', label: '#334155' },
  custom:              { bg: '#F8FAFC', border: '#94A3B8', label: '#64748B' },
}

function FrameNode({ id, data, selected }: NodeProps<FrameNodeType>) {
  const { updateNode } = useDiagramStore()
  const frameStyle = FRAME_STYLES[data.frameType] ?? FRAME_STYLES.custom
  const frameRef   = useRef<HTMLDivElement>(null)
  const dragState  = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)

  // Current label position — default top-left
  const lx = typeof data.labelX === 'number' ? data.labelX : 8
  const ly = typeof data.labelY === 'number' ? data.labelY : 8

  const onLabelMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only drag on left button; don't propagate to RF (which would drag the whole frame)
      if (e.button !== 0) return
      e.stopPropagation()
      e.preventDefault()

      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: lx,
        originY: ly,
      }

      const onMove = (ev: MouseEvent) => {
        if (!dragState.current || !frameRef.current) return
        const rect = frameRef.current.getBoundingClientRect()
        const dx = ev.clientX - dragState.current.startX
        const dy = ev.clientY - dragState.current.startY
        // Clamp within frame bounds (with a small margin)
        const newX = Math.max(4, Math.min(rect.width  - 80, dragState.current.originX + dx))
        const newY = Math.max(4, Math.min(rect.height - 24, dragState.current.originY + dy))
        updateNode(id, { labelX: newX, labelY: newY } as Partial<FrameNodeData>)
      }

      const onUp = () => {
        dragState.current = null
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [id, lx, ly, updateNode]
  )

  return (
    <div
      ref={frameRef}
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
      {selected && (
        <NodeResizer
          minWidth={150}
          minHeight={100}
          isVisible
          lineClassName="border-blue-400"
          handleClassName="bg-white border-2 border-blue-400 rounded-sm"
        />
      )}

      {/* Draggable label — grab and move anywhere inside the frame */}
      <div
        className="absolute flex items-center gap-1.5 select-none"
        style={{
          left: lx,
          top:  ly,
          cursor: 'grab',
          zIndex: 10,
        }}
        onMouseDown={onLabelMouseDown}
        title="Drag to reposition"
      >
        <span
          className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
          style={{
            color: frameStyle.label,
            backgroundColor: `${frameStyle.border}20`,
            border: `1px solid ${frameStyle.border}40`,
          }}
        >
          {data.frameType.replace(/-/g, ' ')}
        </span>
        {data.label && (
          <span className="text-xs font-medium" style={{ color: frameStyle.label }}>
            {data.label}
          </span>
        )}
      </div>

      {/* Description */}
      {data.description && (
        <div className="absolute left-3 right-3" style={{ top: ly + 24 }}>
          <span className="text-[10px] text-gray-400">{data.description}</span>
        </div>
      )}
    </div>
  )
}

export default memo(FrameNode)
