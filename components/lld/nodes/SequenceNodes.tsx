'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { NodeResizer } from '@xyflow/react'
import { useInlineEdit } from '../useInlineEdit'
import { useLldActions } from '../LldDiagramContext'
import { SELECTED_BLUE } from '../LldNodeFrame'
import { ACTIVATION_WIDTH } from '@/lib/lld/sequenceLayout'
import type { SequenceFragmentShape, SequenceLifelineShape } from '@/types/lld'

const HEAD_H = 48
const MIN_W = 90

/** Activation intervals in node-local coordinates, injected by LldCanvas. */
export interface LifelineActivationProps {
  activations?: Array<{ start: number; end: number; depth: number }>
  destroyed?: boolean
}

function ActorGlyph({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 30" className="h-7 w-6" aria-hidden="true">
      <circle cx="12" cy="6" r="4.5" fill="none" stroke={color} strokeWidth="1.6" />
      <path
        d="M12 11 L12 20 M6 14 L18 14 M12 20 L7 29 M12 20 L17 29"
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Sequence participant: head box (or stick figure) plus a dashed vertical
 * lifeline with derived activation bars.
 *
 * Vertical drag is clamped by LldCanvas, so a lifeline reorders horizontally but
 * never drifts off the shared time axis.
 */
function LifelineShapeNodeBase({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<SequenceLifelineShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, ref, commitProps } = useInlineEdit<'name'>()

  const w = Math.max(width ?? 0, MIN_W)
  const h = Math.max(height ?? 0, 240)
  const stroke = data.stroke ?? '#334155'
  const isActor = data.lifelineKind === 'actor'

  const activations = (data.__activations as LifelineActivationProps['activations']) ?? []
  const destroyed = Boolean(data.__destroyed)

  const stereotype =
    data.lifelineKind === 'boundary' ||
    data.lifelineKind === 'control' ||
    data.lifelineKind === 'entity'
      ? data.lifelineKind
      : null

  return (
    <div className="group relative select-none" style={{ width: w, height: h }}>
      <NodeResizer
        isVisible={!!selected}
        minWidth={MIN_W}
        minHeight={240}
        color={SELECTED_BLUE}
        handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
      />

      {/* head */}
      <div
        className="flex items-center justify-center"
        style={{ height: HEAD_H }}
        onDoubleClick={start('name')}
      >
        {isActor ? (
          <div className="flex flex-col items-center">
            <ActorGlyph color={selected ? SELECTED_BLUE : stroke} />
          </div>
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center overflow-hidden px-1.5"
            style={{
              background: data.fill ?? '#ffffff',
              border: `1.5px solid ${selected ? SELECTED_BLUE : stroke}`,
              borderRadius: 4,
              boxShadow: selected ? '0 0 0 1px #93C5FD' : undefined,
            }}
          >
            {stereotype && (
              <span className="text-[9px] italic leading-none text-slate-500">«{stereotype}»</span>
            )}
            {editing === 'name' ? (
              <input
                ref={ref as React.Ref<HTMLInputElement>}
                className="w-full bg-transparent text-center text-[11px] font-semibold outline-none"
                value={data.label}
                aria-label="Participant name"
                onChange={(e) => updateShape(id, { label: e.target.value })}
                {...commitProps}
              />
            ) : (
              <span className="w-full truncate text-center text-[11px] font-semibold">
                {data.label}
              </span>
            )}
          </div>
        )}
      </div>

      {isActor &&
        (editing === 'name' ? (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            className="w-full bg-transparent text-center text-[11px] font-semibold outline-none"
            value={data.label}
            aria-label="Actor name"
            onChange={(e) => updateShape(id, { label: e.target.value })}
            {...commitProps}
          />
        ) : (
          <p
            className="truncate text-center text-[11px] font-semibold"
            onDoubleClick={start('name')}
          >
            {data.label}
          </p>
        ))}

      {/* lifeline + activation bars */}
      <svg
        className="pointer-events-none absolute inset-0"
        width={w}
        height={h}
        aria-hidden="true"
      >
        <line
          x1={w / 2}
          y1={isActor ? HEAD_H + 18 : HEAD_H}
          x2={w / 2}
          y2={destroyed ? h - 18 : h}
          stroke="#94A3B8"
          strokeWidth={1}
          strokeDasharray="5 4"
        />
        {activations.map((a, i) => (
          <rect
            key={i}
            x={w / 2 - ACTIVATION_WIDTH / 2 + a.depth * 4}
            y={a.start}
            width={ACTIVATION_WIDTH}
            height={Math.max(a.end - a.start, 8)}
            fill="#E2E8F0"
            stroke="#64748B"
            strokeWidth={1}
            rx={1}
          />
        ))}
        {destroyed && (
          <path
            d={`M ${w / 2 - 7},${h - 21} L ${w / 2 + 7},${h - 7} M ${w / 2 + 7},${h - 21} L ${w / 2 - 7},${h - 7}`}
            stroke="#DC2626"
            strokeWidth={2}
            strokeLinecap="round"
          />
        )}
      </svg>

      {/* Messages attach at the head; the custom edge overrides the geometry. */}
      <Handle
        type="source"
        id="msg"
        position={Position.Right}
        className="!h-2 !w-2 !border-white !bg-slate-400 !opacity-0 group-hover:!opacity-100"
        style={{ top: HEAD_H / 2 }}
      />
      <Handle
        type="target"
        id="msg-in"
        position={Position.Left}
        className="!h-2 !w-2 !border-white !bg-slate-400 !opacity-0 group-hover:!opacity-100"
        style={{ top: HEAD_H / 2 }}
      />
    </div>
  )
}

export const LifelineShapeNode = memo(LifelineShapeNodeBase)

const OPERATOR_LABEL: Record<SequenceFragmentShape['data']['operator'], string> = {
  alt: 'alt',
  opt: 'opt',
  loop: 'loop',
  par: 'par',
  critical: 'critical',
  ref: 'ref',
}

/**
 * Combined fragment frame.
 *
 * v1 is manually positioned and sized — membership is explicit via
 * SequenceMessageData.fragmentId, so export stays correct regardless of
 * geometry.
 */
function FragmentShapeNodeBase({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<SequenceFragmentShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, ref, commitProps } = useInlineEdit<'guard'>()

  const w = Math.max(width ?? 0, 200)
  const h = Math.max(height ?? 0, 120)
  const stroke = selected ? SELECTED_BLUE : (data.stroke ?? '#64748B')

  return (
    <div className="relative select-none" style={{ width: w, height: h }}>
      <NodeResizer
        isVisible={!!selected}
        minWidth={200}
        minHeight={120}
        color={SELECTED_BLUE}
        handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
      />
      <div
        className="h-full w-full"
        style={{ border: `1.5px solid ${stroke}`, background: 'rgba(248,250,252,0.35)' }}
      >
        {/* operator tab */}
        <div
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600"
          style={{
            borderRight: `1.5px solid ${stroke}`,
            borderBottom: `1.5px solid ${stroke}`,
            background: '#F1F5F9',
          }}
        >
          {OPERATOR_LABEL[data.operator]}
        </div>

        {/* operand guards */}
        {data.operands.map((operand, i) => (
          <div
            key={operand.id}
            className="px-2 py-0.5 text-[10px] italic text-slate-500"
            style={i > 0 ? { borderTop: `1px dashed ${stroke}` } : undefined}
            onDoubleClick={start('guard')}
          >
            {editing === 'guard' ? (
              <input
                ref={i === 0 ? (ref as React.Ref<HTMLInputElement>) : undefined}
                className="w-full bg-transparent italic outline-none"
                value={operand.guard}
                aria-label="Guard condition"
                onChange={(e) =>
                  updateShape(id, {
                    operands: data.operands.map((o) =>
                      o.id === operand.id ? { ...o, guard: e.target.value } : o
                    ),
                  })
                }
                {...commitProps}
              />
            ) : (
              <span>{operand.guard ? `[${operand.guard}]` : '[condition]'}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export const FragmentShapeNode = memo(FragmentShapeNodeBase)
