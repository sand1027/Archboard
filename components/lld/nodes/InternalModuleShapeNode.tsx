'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import LldNodeFrame from '../LldNodeFrame'
import { useInlineEdit } from '../useInlineEdit'
import { useLldActions } from '../LldDiagramContext'
import type { InternalModuleShape, ModuleLayer, PortSide } from '@/types/lld'

/** Layer accent colours read top-to-bottom through a typical service. */
const LAYER_ACCENT: Record<ModuleLayer, string> = {
  controller: '#2563EB',
  service: '#7C3AED',
  repository: '#059669',
  adapter: '#D97706',
  domain: '#0EA5E9',
  custom: '#64748B',
}

const SIDE_TO_POSITION: Record<PortSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
}

/**
 * Internal sub-module with edge-mounted ports.
 *
 * Ports carry `side` + `offset` (0–1) so they stay pinned to the correct edge
 * position as the box is resized.
 */
function InternalModuleShapeNode({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<InternalModuleShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, ref, commitProps } = useInlineEdit<'name' | 'tech'>()

  const w = Math.max(width ?? 0, 140)
  const h = Math.max(height ?? 0, 72)
  const accent = LAYER_ACCENT[data.layer]

  return (
    <div className="group">
      <LldNodeFrame
        selected={selected}
        width={w}
        height={h}
        minWidth={140}
        minHeight={72}
        fill={data.fill}
        stroke={data.stroke}
        rounded={8}
      >
        <div className="h-1 w-full shrink-0" style={{ background: accent }} />

        <div className="flex flex-1 flex-col justify-center px-2.5">
          <p
            className="text-[9px] font-semibold uppercase tracking-wider"
            style={{ color: accent }}
          >
            {data.layer === 'custom' ? 'module' : data.layer}
          </p>

          {editing === 'name' ? (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              className="w-full bg-transparent text-[12px] font-semibold outline-none"
              value={data.label}
              aria-label="Module name"
              onChange={(e) => updateShape(id, { label: e.target.value })}
              {...commitProps}
            />
          ) : (
            <p
              className="truncate text-[12px] font-semibold"
              onDoubleClick={start('name')}
              title={data.label}
            >
              {data.label}
            </p>
          )}

          {editing === 'tech' ? (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              className="w-full bg-transparent text-[10px] outline-none"
              value={data.technology ?? ''}
              aria-label="Technology"
              placeholder="technology"
              onChange={(e) => updateShape(id, { technology: e.target.value })}
              {...commitProps}
            />
          ) : (
            data.technology && (
              <p
                className="truncate text-[10px] text-slate-500"
                onDoubleClick={start('tech')}
              >
                {data.technology}
              </p>
            )
          )}
        </div>
      </LldNodeFrame>

      {/* Ports: square = provided interface, hollow = required. */}
      {data.ports.map((port) => {
        const position = SIDE_TO_POSITION[port.side]
        const along = `${Math.round(port.offset * 100)}%`
        const style =
          port.side === 'top' || port.side === 'bottom' ? { left: along } : { top: along }

        return (
          <div key={port.id}>
            <Handle
              type="source"
              id={`port:${port.id}`}
              position={position}
              title={`${port.name} (${port.direction})`}
              className="!h-2.5 !w-2.5 !rounded-none !border-2"
              style={{
                ...style,
                background: port.direction === 'provided' ? accent : '#ffffff',
                borderColor: accent,
              }}
            />
            <Handle
              type="target"
              id={`port:${port.id}-in`}
              position={position}
              className="!h-2.5 !w-2.5 !rounded-none !border-0 !bg-transparent"
              style={style}
            />
          </div>
        )
      })}
    </div>
  )
}

export default memo(InternalModuleShapeNode)
