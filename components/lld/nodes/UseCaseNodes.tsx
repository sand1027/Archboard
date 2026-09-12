'use client'

import { memo } from 'react'
import { NodeResizer, type NodeProps } from '@xyflow/react'
import { SELECTED_BLUE } from '../LldNodeFrame'
import { useInlineEdit } from '../useInlineEdit'
import { useLldActions } from '../LldDiagramContext'
import { AllHandles } from './FlowShapes'
import type {
  LldPackageShape,
  SystemBoundaryShape,
  UseCaseActorShape,
  UseCaseShape,
} from '@/types/lld'

/**
 * Use case diagram shapes, following the UML notation:
 *   actor           stick figure, name below
 *   use case        horizontal ellipse
 *   subject         rectangle, name in the upper corner, use cases inside
 *   package         tabbed folder
 */

const HEAD_H = 62

// ─── actor ───────────────────────────────────────────────────────────────────

function ActorShapeNodeBase({ id, data, selected, width, height }: NodeProps<UseCaseActorShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, ref, commitProps } = useInlineEdit<'name'>()

  const w = Math.max(width ?? 0, 56)
  const h = Math.max(height ?? 0, 80)
  const color = selected ? SELECTED_BLUE : (data.stroke ?? '#334155')

  return (
    <div className="group relative" style={{ width: w, height: h }}>
      <NodeResizer
        isVisible={!!selected}
        minWidth={56}
        minHeight={80}
        keepAspectRatio
        color={SELECTED_BLUE}
        handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
      />
      <AllHandles />

      {data.isSystem ? (
        // UML permits a custom icon for non-human actors; a boxed «actor» reads
        // more clearly than a stick figure for an external system.
        <div
          className="flex items-center justify-center"
          style={{
            height: HEAD_H,
            border: `1.5px solid ${color}`,
            borderRadius: 4,
            background: data.fill ?? '#ffffff',
          }}
        >
          <span className="text-[9px] italic text-slate-500">«actor»</span>
        </div>
      ) : (
        <svg width={w} height={HEAD_H} viewBox="0 0 48 62" aria-label="Actor">
          <circle cx="24" cy="11" r="9" fill="none" stroke={color} strokeWidth="1.8" />
          <path
            d="M24 20 V40 M10 27 H38 M24 40 L13 60 M24 40 L35 60"
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )}

      <div className="mt-1 px-0.5" onDoubleClick={start('name')}>
        {editing === 'name' ? (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            className="w-full bg-transparent text-center text-[11px] font-medium outline-none"
            value={data.label}
            aria-label="Actor name"
            onChange={(e) => updateShape(id, { label: e.target.value })}
            {...commitProps}
          />
        ) : (
          <p className="truncate text-center text-[11px] font-medium text-slate-800">
            {data.label}
          </p>
        )}
      </div>
    </div>
  )
}

export const ActorShapeNode = memo(ActorShapeNodeBase)

// ─── use case ────────────────────────────────────────────────────────────────

function UseCaseShapeNodeBase({ id, data, selected, width, height }: NodeProps<UseCaseShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, ref, commitProps } = useInlineEdit<'name'>()

  const hasPoints = data.extensionPoints.length > 0
  const w = Math.max(width ?? 0, 120)
  const h = Math.max(height ?? 0, hasPoints ? 96 : 60)
  const color = selected ? SELECTED_BLUE : (data.stroke ?? '#334155')

  return (
    <div className="group relative" style={{ width: w, height: h }}>
      <NodeResizer
        isVisible={!!selected}
        minWidth={120}
        minHeight={60}
        color={SELECTED_BLUE}
        handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
      />
      <AllHandles />

      <svg width={w} height={h} className="absolute inset-0" aria-label="Use case">
        <ellipse
          cx={w / 2}
          cy={h / 2}
          rx={w / 2 - 1.5}
          ry={h / 2 - 1.5}
          fill={data.fill ?? '#ffffff'}
          stroke={color}
          strokeWidth={1.5}
        />
        {hasPoints && (
          <line
            x1={w * 0.12}
            y1={h * 0.58}
            x2={w * 0.88}
            y2={h * 0.58}
            stroke={color}
            strokeWidth={1}
          />
        )}
      </svg>

      <div
        className="absolute inset-0 flex flex-col items-center justify-center px-5"
        onDoubleClick={start('name')}
      >
        {editing === 'name' ? (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            className="w-full bg-transparent text-center text-[12px] outline-none"
            value={data.label}
            aria-label="Use case name"
            onChange={(e) => updateShape(id, { label: e.target.value })}
            {...commitProps}
          />
        ) : (
          <p
            className={[
              'line-clamp-2 text-center text-[12px] leading-tight text-slate-800',
              data.isAbstract ? 'italic' : '',
            ].join(' ')}
            style={hasPoints ? { marginTop: -h * 0.12 } : undefined}
          >
            {data.label}
          </p>
        )}

        {hasPoints && (
          <div
            className="absolute w-full px-6 text-center"
            style={{ top: `${58 + 4}%` }}
          >
            <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">
              extension points
            </p>
            {data.extensionPoints.slice(0, 2).map((ep) => (
              <p key={ep.id} className="truncate text-[9px] text-slate-500">
                {ep.name}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export const UseCaseShapeNode = memo(UseCaseShapeNodeBase)

// ─── subject / system boundary ───────────────────────────────────────────────

function SystemBoundaryShapeNodeBase({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<SystemBoundaryShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, ref, commitProps } = useInlineEdit<'name'>()

  const w = Math.max(width ?? 0, 220)
  const h = Math.max(height ?? 0, 160)
  const color = selected ? SELECTED_BLUE : (data.stroke ?? '#334155')

  return (
    <div className="relative" style={{ width: w, height: h }}>
      <NodeResizer
        isVisible={!!selected}
        minWidth={220}
        minHeight={160}
        color={SELECTED_BLUE}
        handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
      />
      <div
        className="h-full w-full"
        style={{
          border: `1.5px solid ${color}`,
          borderRadius: 4,
          background: 'rgba(248,250,252,0.5)',
        }}
      >
        {/* UML puts the subject name in the upper corner, not centred. */}
        <div className="px-3 py-1.5" onDoubleClick={start('name')}>
          {data.stereotype && (
            <p className="text-[9px] italic leading-none text-slate-500">«{data.stereotype}»</p>
          )}
          {editing === 'name' ? (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              className="w-full bg-transparent text-[12px] font-semibold outline-none"
              value={data.label}
              aria-label="System name"
              onChange={(e) => updateShape(id, { label: e.target.value })}
              {...commitProps}
            />
          ) : (
            <p className="truncate text-[12px] font-semibold text-slate-700">{data.label}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export const SystemBoundaryShapeNode = memo(SystemBoundaryShapeNodeBase)

// ─── package ─────────────────────────────────────────────────────────────────

function LldPackageShapeNodeBase({ id, data, selected, width, height }: NodeProps<LldPackageShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, ref, commitProps } = useInlineEdit<'name'>()

  const w = Math.max(width ?? 0, 140)
  const h = Math.max(height ?? 0, 100)
  const color = selected ? SELECTED_BLUE : (data.stroke ?? '#334155')
  const tabW = Math.min(w * 0.45, 96)

  return (
    <div className="group relative" style={{ width: w, height: h }}>
      <NodeResizer
        isVisible={!!selected}
        minWidth={140}
        minHeight={100}
        color={SELECTED_BLUE}
        handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
      />
      <AllHandles />

      <svg width={w} height={h} className="absolute inset-0" aria-label="Package">
        <path
          d={`M 1,15 H ${tabW} V 1 H 1 Z`}
          fill="#F1F5F9"
          stroke={color}
          strokeWidth={1.5}
        />
        <rect
          x={1}
          y={15}
          width={w - 2}
          height={h - 16}
          fill={data.fill === 'transparent' ? 'rgba(248,250,252,0.5)' : (data.fill ?? '#ffffff')}
          stroke={color}
          strokeWidth={1.5}
        />
      </svg>

      <div className="absolute left-0 top-0 px-2" style={{ width: tabW }} onDoubleClick={start('name')}>
        {editing === 'name' ? (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            className="w-full bg-transparent text-[10px] font-semibold outline-none"
            value={data.label}
            aria-label="Package name"
            onChange={(e) => updateShape(id, { label: e.target.value })}
            {...commitProps}
          />
        ) : (
          <p className="truncate text-[10px] font-semibold leading-[15px] text-slate-700">
            {data.label}
          </p>
        )}
      </div>
    </div>
  )
}

export const LldPackageShapeNode = memo(LldPackageShapeNodeBase)
