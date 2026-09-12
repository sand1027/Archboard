'use client'

import { memo, useState } from 'react'
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import type { ArchitectureNodeData } from '@/types/architecture'
import { useSimulationStore } from '@/store/simulationStore'
import { useUiStore } from '@/store/uiStore'
import { useRouter } from 'next/navigation'
import { lldWorkspacePath, useDiagramRouteId } from '@/hooks/useDiagramRouteId'
import { Layers, X } from 'lucide-react'
import Image from 'next/image'

type ArchitectureNodeType = Node<ArchitectureNodeData, 'architecture'>

const PROVIDER_COLORS: Record<string, string> = {
  aws: '#FF9900', gcp: '#4285F4', azure: '#0078D4',
  kubernetes: '#326CE5', generic: '#6B7280',
}

const CATEGORY_COLORS: Record<string, string> = {
  clients: '#8B5CF6', networking: '#0EA5E9', compute: '#10B981',
  services: '#6366F1', databases: '#1D4ED8', storage: '#0284C7',
  caching: '#DC2626', messaging: '#D97706', observability: '#16A34A',
  security: '#DC2626', frames: '#6B7280',
}

const SIM_STATUS_STYLES: Record<string, { ring: string; glow: string }> = {
  active:     { ring: '#3B82F6', glow: 'rgba(59,130,246,0.25)' },
  processing: { ring: '#F59E0B', glow: 'rgba(245,158,11,0.25)' },
  error:      { ring: '#EF4444', glow: 'rgba(239,68,68,0.3)'  },
  slow:       { ring: '#F97316', glow: 'rgba(249,115,22,0.25)' },
}

const DEFAULT_W = 72
const DEFAULT_H = 88
const LABEL_H   = 20

function ArchitectureNode({ id, data, selected, width, height }: NodeProps<ArchitectureNodeType>) {
  const [imgError, setImgError] = useState(false)
  // Deterministic handle visibility. Relying on Tailwind's `group-hover:` makes
  // this depend on an ancestor keeping the `group` class, which is fragile.
  const [hovered, setHovered] = useState(false)

  // Simulation glow — only subscribes when simulating
  const router = useRouter()
  const diagramRouteId = useDiagramRouteId()
  // Arming a connector preset in the library means "I am drawing connections",
  // so the whole icon becomes the drag source. Selector-scoped so nodes only
  // re-render when the mode itself flips.
  const connectMode = useUiStore((s) => s.armedConnectionType !== null)
  const simNodeStatus = useSimulationStore((s) => s.nodeStatuses[id])
  const simStatus     = useSimulationStore((s) => s.status)
  const isSimulating  = simStatus === 'running' || simStatus === 'paused'

  // Marked as down for failure injection. This is config, not run state, so it
  // shows whether or not a simulation is going. Without it, clicking a node in
  // failure mode changed the store and nothing on the canvas moved, which is
  // indistinguishable from the click not working.
  const markedDown = useSimulationStore((s) => s.config.failure.failNodes.has(id))
  const failureMode = useSimulationStore(
    (s) => s.config.mode === 'failure-mode' && s.status === 'idle'
  )

  const accentColor =
    data.provider
      ? PROVIDER_COLORS[data.provider] ?? '#6B7280'
      : CATEGORY_COLORS[data.category] ?? '#6B7280'

  const w = width  ?? DEFAULT_W
  const h = height ?? DEFAULT_H
  const iconSize = Math.max(24, Math.min(w, h - LABEL_H - 4))

  const handlesVisible = !isSimulating && (hovered || !!selected || connectMode)

  const simStyle = simNodeStatus ? SIM_STATUS_STYLES[simNodeStatus] : null

  return (
    <div
      className="group relative flex flex-col items-center justify-start select-none bg-transparent"
      style={{
        width: w,
        height: h,
        cursor: connectMode && !isSimulating ? 'crosshair' : failureMode ? 'pointer' : undefined,
      }}
      title={
        failureMode
          ? markedDown
            ? `${data.label} is marked down — click to restore`
            : `Click to mark ${data.label} as down`
          : undefined
      }
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
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

      {/* Discoverable entry to this component's low-level design. Also
          available via right-click and double-click. */}
      {!isSimulating && (
        <button
          type="button"
          title={`Open low-level design for ${data.label}`}
          aria-label={`Open low-level design for ${data.label}`}
          onClick={(e) => {
            e.stopPropagation()
            const path = lldWorkspacePath(diagramRouteId, id)
            if (path) router.push(path)
          }}
          className="nodrag absolute -right-1.5 -top-1.5 z-30 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-opacity hover:border-blue-300 hover:text-blue-600"
          style={{ opacity: handlesVisible ? 1 : 0, pointerEvents: handlesVisible ? 'all' : 'none' }}
        >
          <Layers className="h-3 w-3" />
        </button>
      )}

      {/* Simulation glow ring */}
      {isSimulating && simStyle && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            boxShadow: `0 0 0 2px ${simStyle.ring}, 0 0 16px 4px ${simStyle.glow}`,
            transition: 'box-shadow 0.15s ease',
            zIndex: 20,
          }}
        />
      )}

      {/*
        Marked down. A dashed ring rather than the solid one used for live status,
        so "configured to fail" and "failing right now" stay distinguishable — during
        a run a marked node shows both.
      */}
      {markedDown && (
        <>
          <div
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              border: '2px dashed #EF4444',
              background: 'rgba(239,68,68,0.06)',
              zIndex: 19,
            }}
          />
          <div
            className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full pointer-events-none"
            style={{
              width: 16,
              height: 16,
              background: '#EF4444',
              boxShadow: '0 0 0 2px #ffffff',
              zIndex: 21,
            }}
            title={`${data.label} is marked down`}
          >
            <X className="h-2.5 w-2.5 text-white" strokeWidth={3} />
          </div>
        </>
      )}

      {/*
        SVG icon.

        This is the positioning context for the handles, which is the whole point:
        React Flow places a handle against its nearest positioned ancestor, so
        anchoring them here puts them on the artwork's edges automatically at any
        size. Computing pixel offsets from the `width`/`height` props instead went
        wrong whenever those disagreed with the rendered box — which is the case
        for nodes sized through `node.style`, e.g. anything from a template.
      */}
      <div
        className="relative flex items-center justify-center bg-transparent"
        style={{
          width: w,
          height: h - LABEL_H,
          // A node marked down stays at full strength even before traffic reaches
          // it: it is the thing the user is watching for.
          opacity: isSimulating && !simNodeStatus && !markedDown ? 0.5 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        {/* Whole-icon drag source, only while a connector preset is armed. */}
        {connectMode && !isSimulating && (
          <>
            <Handle
              type="source"
              id="body"
              position={Position.Right}
              title="Drag to connect"
              className="!rounded-lg !border-0 !bg-transparent"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                right: 'auto',
                bottom: 'auto',
                transform: 'none',
                minWidth: 0,
                minHeight: 0,
                zIndex: 10,
              }}
            />
            <div
              className="pointer-events-none absolute -inset-1 rounded-xl"
              style={{ border: `1.5px dashed ${accentColor}`, opacity: 0.55 }}
            />
          </>
        )}

        {/* One connection point per side of the artwork. */}
        {!isSimulating &&
          (
            [
              [Position.Top, 't'],
              [Position.Right, 'r'],
              [Position.Bottom, 'b'],
              [Position.Left, 'l'],
            ] as const
          ).map(([position, hid]) => (
            <Handle
              key={hid}
              type="source"
              id={hid}
              position={position}
              title="Drag to connect"
              className="!h-3 !w-3 !rounded-full !border-2 !border-white !transition-all hover:!h-4 hover:!w-4"
              style={{
                background: accentColor,
                opacity: handlesVisible ? 1 : 0,
                pointerEvents: handlesVisible ? 'all' : 'none',
                zIndex: 25,
              }}
            />
          ))}

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
            style={{ width: iconSize, height: iconSize, backgroundColor: accentColor }}
          >
            {data.label.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Label */}
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
