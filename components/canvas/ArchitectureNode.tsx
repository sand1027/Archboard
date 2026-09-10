'use client'

import { memo, useState } from 'react'
import {
  Handle,
  Position,
  NodeResizer,
  type NodeProps,
} from '@xyflow/react'
import type { Node } from '@xyflow/react'
import type { ArchitectureNodeData } from '@/types/architecture'
import Image from 'next/image'

type ArchitectureNodeType = Node<ArchitectureNodeData, 'architecture'>

const PROVIDER_COLORS: Record<string, string> = {
  aws: '#FF9900',
  gcp: '#4285F4',
  azure: '#0078D4',
  kubernetes: '#326CE5',
  generic: '#6B7280',
}

const CATEGORY_COLORS: Record<string, string> = {
  clients: '#8B5CF6',
  networking: '#0EA5E9',
  compute: '#10B981',
  services: '#6366F1',
  databases: '#1D4ED8',
  storage: '#0284C7',
  caching: '#DC2626',
  messaging: '#D97706',
  observability: '#16A34A',
  security: '#DC2626',
  frames: '#6B7280',
}

function ArchitectureNode({ data, selected, id }: NodeProps<ArchitectureNodeType>) {
  const [imgError, setImgError] = useState(false)
  const accentColor =
    data.provider
      ? PROVIDER_COLORS[data.provider] ?? '#6B7280'
      : CATEGORY_COLORS[data.category] ?? '#6B7280'

  const handlePositions = [
    Position.Top,
    Position.Right,
    Position.Bottom,
    Position.Left,
  ]

  return (
    <div
      className="group relative"
      style={{ minWidth: 100, minHeight: 80 }}
    >
      <NodeResizer
        minWidth={80}
        minHeight={70}
        isVisible={selected}
        lineClassName="border-blue-400"
        handleClassName="bg-white border-2 border-blue-400 rounded-sm"
      />

      {/* Connection handles — appear on hover */}
      {handlePositions.map((pos) => (
        <Handle
          key={pos}
          type="source"
          position={pos}
          className="opacity-0 group-hover:opacity-100 transition-opacity !w-3 !h-3 !bg-blue-500 !border-2 !border-white !rounded-full !shadow"
          style={{ zIndex: 10 }}
        />
      ))}
      {handlePositions.map((pos) => (
        <Handle
          key={`target-${pos}`}
          type="target"
          position={pos}
          className="opacity-0 group-hover:opacity-100 transition-opacity !w-3 !h-3 !bg-blue-500 !border-2 !border-white !rounded-full !shadow"
          style={{ zIndex: 10 }}
        />
      ))}

      {/* Node body */}
      <div
        className={[
          'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg bg-white',
          'border transition-all duration-150 cursor-default select-none',
          selected
            ? 'shadow-[0_0_0_2px_#3B82F6,0_4px_12px_rgba(0,0,0,0.12)]'
            : 'border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300',
        ].join(' ')}
        style={{
          borderTopColor: selected ? '#3B82F6' : accentColor,
          borderTopWidth: 3,
          minWidth: 100,
          minHeight: 70,
        }}
      >
        {/* Icon */}
        <div className="relative w-10 h-10 flex-shrink-0">
          {!imgError ? (
            <Image
              src={data.icon}
              alt={data.label}
              width={40}
              height={40}
              className="w-10 h-10 object-contain"
              onError={() => setImgError(true)}
              unoptimized
            />
          ) : (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: accentColor }}
            >
              {data.label.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        {/* Label */}
        <span
          className="text-xs font-medium text-gray-800 text-center leading-tight max-w-[120px] truncate"
          title={data.label}
        >
          {data.label}
        </span>

        {/* Provider / subtitle badge */}
        {(data.provider || data.subtitle) && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide"
            style={{ color: accentColor, backgroundColor: `${accentColor}18` }}
          >
            {data.subtitle ?? data.provider}
          </span>
        )}

        {/* Replica indicator */}
        {data.isReplica && (
          <span className="text-[9px] text-gray-400 font-medium">replica</span>
        )}
        {data.isPrimary && (
          <span className="text-[9px] font-semibold" style={{ color: accentColor }}>primary</span>
        )}
      </div>
    </div>
  )
}

export default memo(ArchitectureNode)
