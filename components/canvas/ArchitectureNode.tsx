'use client'

import { memo, useState } from 'react'
import { NodeResizer, type NodeProps } from '@xyflow/react'
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

const DEFAULT_W = 72
const DEFAULT_H = 88
const LABEL_H = 20

function ArchitectureNode({ data, selected, width, height }: NodeProps<ArchitectureNodeType>) {
  const [imgError, setImgError] = useState(false)
  const accentColor =
    data.provider
      ? PROVIDER_COLORS[data.provider] ?? '#6B7280'
      : CATEGORY_COLORS[data.category] ?? '#6B7280'

  const w = width ?? DEFAULT_W
  const h = height ?? DEFAULT_H
  // Icon fills the box; label sits below inside the node height
  const iconSize = Math.max(24, Math.min(w, h - LABEL_H - 4))

  return (
    <div
      className="relative flex flex-col items-center justify-start select-none bg-transparent"
      style={{ width: w, height: h }}
    >
      {/* Resize only when active / selected — no connection ports */}
      {selected && (
        <NodeResizer
          minWidth={48}
          minHeight={56}
          isVisible
          keepAspectRatio
          lineClassName="!border-blue-400"
          handleClassName="!bg-white !border-2 !border-blue-400 !rounded-sm !w-2.5 !h-2.5"
        />
      )}

      {/* SVG icon only — no card chrome, no hover handles */}
      <div
        className="flex items-center justify-center bg-transparent"
        style={{ width: w, height: h - LABEL_H }}
      >
        {!imgError ? (
          <Image
            src={data.icon}
            alt={data.label}
            width={iconSize}
            height={iconSize}
            className="object-contain bg-transparent pointer-events-none"
            style={{ width: iconSize, height: iconSize }}
            onError={() => setImgError(true)}
            unoptimized
            draggable={false}
          />
        ) : (
          <div
            className="rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{
              width: iconSize,
              height: iconSize,
              backgroundColor: accentColor,
            }}
          >
            {data.label.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Label under the SVG */}
      <span
        className="text-[11px] font-medium text-gray-800 text-center leading-tight truncate w-full px-0.5"
        title={data.label}
        style={{ height: LABEL_H, lineHeight: `${LABEL_H}px` }}
      >
        {data.label}
      </span>
    </div>
  )
}

export default memo(ArchitectureNode)
