'use client'

import { memo } from 'react'
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import LldNodeFrame, { SELECTED_BLUE } from '../LldNodeFrame'
import { AllHandles, SvgShapeNode } from './FlowShapes'
import { OUTLINE_PATHS, hasOutlinePath } from './shapePaths'
import { useInlineEdit } from '../useInlineEdit'
import { useLldActions } from '../LldDiagramContext'
import type { ActivityShape, StateShape, SwimlaneShape, LldNoteShape } from '@/types/lld'

// ─── state ───────────────────────────────────────────────────────────────────

function StateShapeNodeBase({ id, data, selected, width, height }: NodeProps<StateShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, ref, commitProps } = useInlineEdit<'name'>()

  const stroke = selected ? SELECTED_BLUE : (data.stroke ?? '#334155')
  const kind = data.stateKind

  // Initial and final are filled circles, not boxes.
  if (kind === 'initial' || kind === 'final') {
    const size = Math.max(width ?? 0, 24)
    return (
      <div className="group relative" style={{ width: size, height: size }}>
        <AllHandles />
        <svg width={size} height={size} aria-label={kind === 'initial' ? 'Initial state' : 'Final state'}>
          {kind === 'final' && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={size / 2 - 1.5}
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={1.5}
            />
          )}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={kind === 'final' ? size / 2 - 6 : size / 2 - 2}
            fill={stroke}
          />
        </svg>
      </div>
    )
  }

  // History, junction and terminate are small round/marker pseudostates.
  if (
    kind === 'history-shallow' ||
    kind === 'history-deep' ||
    kind === 'junction' ||
    kind === 'terminate' ||
    kind === 'entry-point' ||
    kind === 'exit-point'
  ) {
    const size = Math.max(width ?? 0, kind === 'junction' ? 18 : 24)
    const r = size / 2 - 1.5
    const filled = kind === 'junction' || kind === 'exit-point'
    return (
      <div className="group relative" style={{ width: size, height: size }}>
        <NodeResizer
          isVisible={!!selected}
          minWidth={16}
          minHeight={16}
          keepAspectRatio
          color={SELECTED_BLUE}
          handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
        />
        <AllHandles />
        <svg width={size} height={size} aria-label={STATE_LABEL[kind] ?? 'Pseudostate'}>
          {kind === 'terminate' ? (
            // Terminate is a bare X, with no enclosing circle.
            <path
              d={`M 3,3 L ${size - 3},${size - 3} M ${size - 3},3 L 3,${size - 3}`}
              stroke={stroke}
              strokeWidth={2}
              strokeLinecap="round"
            />
          ) : (
            <>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill={filled ? stroke : '#ffffff'}
                stroke={stroke}
                strokeWidth={1.5}
              />
              {/* Exit points are drawn as a crossed circle. */}
              {kind === 'exit-point' && (
                <path
                  d={`M 5,5 L ${size - 5},${size - 5} M ${size - 5},5 L 5,${size - 5}`}
                  stroke="#ffffff"
                  strokeWidth={1.6}
                />
              )}
              {(kind === 'history-shallow' || kind === 'history-deep') && (
                <text
                  x={size / 2}
                  y={size / 2 + 4}
                  textAnchor="middle"
                  fontSize={size * 0.42}
                  fontWeight={700}
                  fill={stroke}
                >
                  {kind === 'history-deep' ? 'H*' : 'H'}
                </text>
              )}
            </>
          )}
        </svg>
      </div>
    )
  }

  // Fork / join bars, shared with the activity diagram.
  if (kind === 'fork' || kind === 'join') {
    const w2 = Math.max(width ?? 0, 120)
    const h2 = Math.max(height ?? 0, 10)
    return (
      <div className="group relative" style={{ width: w2, height: h2 }}>
        <NodeResizer
          isVisible={!!selected}
          minWidth={60}
          minHeight={8}
          color={SELECTED_BLUE}
          handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
        />
        <AllHandles />
        <div
          className="h-full w-full"
          style={{ background: stroke, borderRadius: 2 }}
          aria-label={kind === 'fork' ? 'Fork' : 'Join'}
        />
      </div>
    )
  }

  // Composite and submachine states are containers with a name band.
  if (kind === 'composite' || kind === 'submachine') {
    const w2 = Math.max(width ?? 0, 200)
    const h2 = Math.max(height ?? 0, kind === 'composite' ? 140 : 70)
    return (
      <div className="group relative" style={{ width: w2, height: h2 }}>
        <NodeResizer
          isVisible={!!selected}
          minWidth={200}
          minHeight={kind === 'composite' ? 140 : 70}
          color={SELECTED_BLUE}
          handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
        />
        <AllHandles />
        <div
          className="h-full w-full overflow-hidden"
          style={{
            border: `1.5px solid ${stroke}`,
            borderRadius: 14,
            background: kind === 'composite' ? 'rgba(248,250,252,0.6)' : (data.fill ?? '#ffffff'),
          }}
        >
          <div
            className="border-b px-2 py-1 text-center"
            style={{ borderColor: stroke }}
            onDoubleClick={start('name')}
          >
            {editing === 'name' ? (
              <input
                ref={ref as React.Ref<HTMLInputElement>}
                className="w-full bg-transparent text-center text-[12px] font-semibold outline-none"
                value={data.label}
                aria-label="State name"
                onChange={(e) => updateShape(id, { label: e.target.value })}
                {...commitProps}
              />
            ) : (
              <p className="truncate text-[12px] font-semibold">{data.label}</p>
            )}
          </div>
          {kind === 'submachine' && (
            <p className="px-2 py-1 text-center text-[11px] text-slate-500">
              {data.doActivity || 'submachine'} ⊕
            </p>
          )}
        </div>
      </div>
    )
  }

  if (kind === 'choice') {
    const w = Math.max(width ?? 0, 64)
    const h = Math.max(height ?? 0, 52)
    return (
      <div className="group relative" style={{ width: w, height: h }}>
        <NodeResizer
          isVisible={!!selected}
          minWidth={64}
          minHeight={52}
          color={SELECTED_BLUE}
          handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
        />
        <AllHandles />
        <svg width={w} height={h} aria-label="Choice point">
          <polygon
            points={`${w / 2},1 ${w - 1},${h / 2} ${w / 2},${h - 1} 1,${h / 2}`}
            fill={data.fill ?? '#ffffff'}
            stroke={stroke}
            strokeWidth={1.5}
          />
        </svg>
      </div>
    )
  }

  const w = Math.max(width ?? 0, 120)
  const hasActions = Boolean(data.entryAction || data.exitAction || data.doActivity)
  const h = Math.max(height ?? 0, hasActions ? 84 : 56)

  return (
    <div className="group">
      <LldNodeFrame
        selected={selected}
        width={w}
        height={h}
        minWidth={120}
        minHeight={56}
        fill={data.fill}
        stroke={data.stroke}
        rounded={14}
      >
        <div
          className={`flex items-center justify-center px-2 ${hasActions ? 'border-b py-1' : 'flex-1'}`}
          style={hasActions ? { borderColor: data.stroke ?? '#334155' } : undefined}
          onDoubleClick={start('name')}
        >
          {editing === 'name' ? (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              className="w-full bg-transparent text-center text-[12px] font-semibold outline-none"
              value={data.label}
              aria-label="State name"
              onChange={(e) => updateShape(id, { label: e.target.value })}
              {...commitProps}
            />
          ) : (
            <p className="truncate text-center text-[12px] font-semibold">{data.label}</p>
          )}
        </div>
        {hasActions && (
          <div className="flex-1 space-y-0.5 px-2 py-1 font-mono text-[10px] text-slate-600">
            {data.entryAction && <p className="truncate">entry / {data.entryAction}</p>}
            {data.doActivity && <p className="truncate">do / {data.doActivity}</p>}
            {data.exitAction && <p className="truncate">exit / {data.exitAction}</p>}
          </div>
        )}
      </LldNodeFrame>
    </div>
  )
}

export const StateShapeNode = memo(StateShapeNodeBase)

// ─── activity ────────────────────────────────────────────────────────────────

function ActivityShapeNodeBase({ id, data, selected, width, height }: NodeProps<ActivityShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, ref, commitProps } = useInlineEdit<'name'>()

  const stroke = selected ? SELECTED_BLUE : (data.stroke ?? '#334155')
  const kind = data.activityKind

  // fork / join are solid synchronisation bars.
  if (kind === 'fork' || kind === 'join') {
    const vertical = data.orientation === 'vertical'
    const w = Math.max(width ?? 0, vertical ? 10 : 120)
    const h = Math.max(height ?? 0, vertical ? 120 : 10)
    return (
      <div className="group relative" style={{ width: w, height: h }}>
        <NodeResizer
          isVisible={!!selected}
          minWidth={vertical ? 8 : 60}
          minHeight={vertical ? 60 : 8}
          color={SELECTED_BLUE}
          handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
        />
        <AllHandles />
        <div
          className="h-full w-full"
          style={{ background: stroke, borderRadius: 2 }}
          aria-label={kind === 'fork' ? 'Fork' : 'Join'}
        />
      </div>
    )
  }

  if (kind === 'decision' || kind === 'merge') {
    const w = Math.max(width ?? 0, 100)
    const h = Math.max(height ?? 0, 72)
    return (
      <div className="group relative" style={{ width: w, height: h }}>
        <NodeResizer
          isVisible={!!selected}
          minWidth={100}
          minHeight={72}
          color={SELECTED_BLUE}
          handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
        />
        <AllHandles />
        <svg width={w} height={h} aria-label={kind === 'decision' ? 'Decision' : 'Merge'}>
          <polygon
            points={`${w / 2},1 ${w - 1},${h / 2} ${w / 2},${h - 1} 1,${h / 2}`}
            fill={data.fill ?? '#ffffff'}
            stroke={stroke}
            strokeWidth={1.5}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center px-4"
          onDoubleClick={start('name')}
        >
          {editing === 'name' ? (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              className="w-full bg-transparent text-center text-[10px] outline-none"
              value={data.label}
              aria-label="Decision label"
              onChange={(e) => updateShape(id, { label: e.target.value })}
              {...commitProps}
            />
          ) : (
            <span className="truncate text-center text-[10px]">{data.label}</span>
          )}
        </div>
      </div>
    )
  }

  // Round markers stay square and label-free.
  if (kind === 'connector' || kind === 'or' || kind === 'summing-junction' || kind === 'final-flow') {
    const size = Math.max(width ?? 0, 34)
    const r = size / 2 - 1.5
    return (
      <div className="group relative" style={{ width: size, height: size }}>
        <NodeResizer
          isVisible={!!selected}
          minWidth={28}
          minHeight={28}
          keepAspectRatio
          color={SELECTED_BLUE}
          handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
        />
        <AllHandles />
        <svg width={size} height={size} aria-label={FLOW_LABEL[kind] ?? 'Connector'}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill={kind === 'final-flow' ? stroke : (data.fill ?? '#ffffff')}
            stroke={stroke}
            strokeWidth={1.5}
          />
          {/* `or` is a crossed circle; summing junction uses a saltire. */}
          {kind === 'or' && (
            <path
              d={`M ${size / 2},2 V ${size - 2} M 2,${size / 2} H ${size - 2}`}
              stroke={stroke}
              strokeWidth={1.4}
            />
          )}
          {kind === 'summing-junction' && (
            <path
              d={`M 5,5 L ${size - 5},${size - 5} M ${size - 5},5 L 5,${size - 5}`}
              stroke={stroke}
              strokeWidth={1.4}
            />
          )}
        </svg>
        {kind === 'connector' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-[11px] font-semibold text-slate-700">{data.label}</span>
          </div>
        )}
      </div>
    )
  }

  // Predefined process, internal storage and multi-document need more than one
  // path element, so they are drawn inline.
  if (kind === 'predefined' || kind === 'internal-storage' || kind === 'multi-document') {
    const w2 = Math.max(width ?? 0, 130)
    const h2 = Math.max(height ?? 0, 60)
    return (
      <SvgShapeNode
        id={id}
        label={data.label}
        selected={selected}
        width={w2}
        height={h2}
        minWidth={130}
        minHeight={60}
        fill={data.fill ?? '#ffffff'}
        stroke={data.stroke ?? '#334155'}
        ariaLabel={FLOW_LABEL[kind] ?? 'Process'}
        labelInset={kind === 'predefined' ? 22 : 14}
        draw={(w3, h3) => {
          if (kind === 'predefined') {
            const inset = Math.min(w3 * 0.1, 14)
            return (
              <>
                <rect x={1} y={1} width={w3 - 2} height={h3 - 2} />
                <line x1={inset} y1={1} x2={inset} y2={h3 - 1} />
                <line x1={w3 - inset} y1={1} x2={w3 - inset} y2={h3 - 1} />
              </>
            )
          }
          if (kind === 'internal-storage') {
            const inset = Math.min(w3 * 0.12, 18)
            const top = Math.min(h3 * 0.22, 16)
            return (
              <>
                <rect x={1} y={1} width={w3 - 2} height={h3 - 2} />
                <line x1={inset} y1={1} x2={inset} y2={h3 - 1} />
                <line x1={1} y1={top} x2={w3 - 1} y2={top} />
              </>
            )
          }
          // Multi-document: stacked wavy-bottom pages.
          const wave = Math.min(h3 * 0.16, 12)
          const body = h3 - wave - 9
          return (
            <>
              <path
                d={`M 9,1 H ${w3 - 1} V ${body} Q ${w3 * 0.75},${body + wave} ${w3 / 2 + 4},${body} Q ${w3 * 0.28},${body - wave} 9,${body} Z`}
              />
              <path
                d={`M 5,5 H ${w3 - 5} V ${body + 4} Q ${w3 * 0.72},${body + 4 + wave} ${w3 / 2},${body + 4} Q ${w3 * 0.25},${body + 4 - wave} 5,${body + 4} Z`}
              />
              <path
                d={`M 1,9 H ${w3 - 9} V ${body + 8} Q ${w3 * 0.68},${body + 8 + wave} ${w3 / 2 - 4},${body + 8} Q ${w3 * 0.22},${body + 8 - wave} 1,${body + 8} Z`}
              />
            </>
          )
        }}
      />
    )
  }

  // Everything else with a single outline path.
  if (hasOutlinePath(kind)) {
    const min = { w: 120, h: 56 }
    const w2 = Math.max(width ?? 0, min.w)
    const h2 = Math.max(height ?? 0, min.h)
    const builder = OUTLINE_PATHS[kind]
    return (
      <SvgShapeNode
        id={id}
        label={data.label}
        selected={selected}
        width={w2}
        height={h2}
        minWidth={min.w}
        minHeight={min.h}
        fill={data.fill ?? '#ffffff'}
        stroke={data.stroke ?? '#334155'}
        draw={(w3, h3) => <path d={builder(w3, h3)} />}
        labelInset={kind === 'send-signal' || kind === 'receive-signal' ? 22 : 14}
        ariaLabel={FLOW_LABEL[kind] ?? 'Shape'}
      />
    )
  }

  // Object node is a plain rectangle with the object name convention.
  if (kind === 'object-node') {
    const w2 = Math.max(width ?? 0, 130)
    const h2 = Math.max(height ?? 0, 52)
    return (
      <SvgShapeNode
        id={id}
        label={data.label}
        selected={selected}
        width={w2}
        height={h2}
        minWidth={130}
        minHeight={52}
        fill={data.fill ?? '#ffffff'}
        stroke={data.stroke ?? '#334155'}
        draw={(w3, h3) => <rect x={1} y={1} width={w3 - 2} height={h3 - 2} />}
        ariaLabel="Object node"
      />
    )
  }

  const isTerminal = kind === 'start' || kind === 'end'
  const w = Math.max(width ?? 0, 100)
  const h = Math.max(height ?? 0, isTerminal ? 40 : 56)

  return (
    <div className="group">
      <LldNodeFrame
        selected={selected}
        width={w}
        height={h}
        minWidth={100}
        minHeight={isTerminal ? 40 : 56}
        fill={isTerminal ? (kind === 'start' ? '#ECFDF5' : '#FEF2F2') : data.fill}
        stroke={isTerminal ? (kind === 'start' ? '#059669' : '#DC2626') : data.stroke}
        rounded={isTerminal ? 999 : 6}
      >
        <div
          className="flex flex-1 items-center justify-center px-2"
          onDoubleClick={start('name')}
        >
          {editing === 'name' ? (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              className="w-full bg-transparent text-center text-[12px] outline-none"
              value={data.label}
              aria-label="Action label"
              onChange={(e) => updateShape(id, { label: e.target.value })}
              {...commitProps}
            />
          ) : (
            <p className="truncate text-center text-[12px]">{data.label}</p>
          )}
        </div>
      </LldNodeFrame>
    </div>
  )
}

export const ActivityShapeNode = memo(ActivityShapeNodeBase)

const STATE_LABEL: Partial<Record<string, string>> = {
  'history-shallow': 'Shallow history',
  'history-deep': 'Deep history',
  junction: 'Junction',
  terminate: 'Terminate',
  'entry-point': 'Entry point',
  'exit-point': 'Exit point',
  composite: 'Composite state',
  submachine: 'Submachine state',
}

const FLOW_LABEL: Partial<Record<string, string>> = {
  data: 'Data',
  document: 'Document',
  predefined: 'Predefined process',
  connector: 'Connector',
  'manual-input': 'Manual input',
  'manual-operation': 'Manual operation',
  delay: 'Delay',
  or: 'Or junction',
  'summing-junction': 'Summing junction',
  'stored-data': 'Stored data',
  'internal-storage': 'Internal storage',
  database: 'Database',
  'off-page': 'Off-page connector',
  display: 'Display',
  tape: 'Sequential data',
  'multi-document': 'Multi-document',
  preparation: 'Preparation',
  extract: 'Extract',
  'loop-limit': 'Loop limit',
  'send-signal': 'Send signal',
  'receive-signal': 'Receive signal',
  'time-event': 'Time event',
  'object-node': 'Object node',
  'final-flow': 'Flow final',
}

// ─── swimlane ────────────────────────────────────────────────────────────────

function SwimlaneShapeNodeBase({ id, data, selected, width, height }: NodeProps<SwimlaneShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, ref, commitProps } = useInlineEdit<'name'>()

  const vertical = data.orientation === 'vertical'
  const w = Math.max(width ?? 0, vertical ? 200 : 400)
  const h = Math.max(height ?? 0, vertical ? 400 : 140)
  const stroke = selected ? SELECTED_BLUE : (data.stroke ?? '#CBD5E1')

  return (
    <div className="relative" style={{ width: w, height: h }}>
      <NodeResizer
        isVisible={!!selected}
        minWidth={vertical ? 160 : 240}
        minHeight={vertical ? 240 : 100}
        color={SELECTED_BLUE}
        handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
      />
      <div
        className="h-full w-full"
        style={{ border: `1.5px solid ${stroke}`, background: 'rgba(248,250,252,0.4)' }}
      >
        <div
          className={
            vertical
              ? 'flex items-center justify-center border-b px-1 py-1'
              : 'flex h-full w-8 items-center justify-center border-r'
          }
          style={{ borderColor: stroke, background: '#F1F5F9', float: vertical ? 'none' : 'left' }}
          onDoubleClick={start('name')}
        >
          {editing === 'name' ? (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              className="w-full bg-transparent text-center text-[11px] font-semibold outline-none"
              value={data.label}
              aria-label="Lane name"
              onChange={(e) => updateShape(id, { label: e.target.value })}
              {...commitProps}
            />
          ) : (
            <span
              className="whitespace-nowrap text-[11px] font-semibold text-slate-600"
              style={vertical ? undefined : { writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              {data.label}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export const SwimlaneShapeNode = memo(SwimlaneShapeNodeBase)

// ─── note ────────────────────────────────────────────────────────────────────

function LldNoteShapeNodeBase({ id, data, selected, width, height }: NodeProps<LldNoteShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, stop, ref } = useInlineEdit<'text'>()

  const w = Math.max(width ?? 0, 120)
  const h = Math.max(height ?? 0, 80)

  return (
    <LldNodeFrame
      selected={selected}
      width={w}
      height={h}
      minWidth={120}
      minHeight={80}
      connectable={false}
      fill={data.fill ?? '#FFFBEB'}
      stroke={data.stroke ?? '#D97706'}
      rounded={4}
    >
      <div className="flex-1 overflow-hidden" onDoubleClick={start('text')}>
        {editing === 'text' ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            className="h-full w-full resize-none bg-transparent p-2 text-[11px] leading-snug outline-none"
            value={data.text}
            aria-label="Note text"
            placeholder="Note…"
            onChange={(e) => updateShape(id, { text: e.target.value })}
            onBlur={stop}
          />
        ) : (
          <p className="whitespace-pre-wrap p-2 text-[11px] leading-snug text-amber-900">
            {data.text || 'Double-click to write…'}
          </p>
        )}
      </div>
    </LldNodeFrame>
  )
}

export const LldNoteShapeNode = memo(LldNoteShapeNodeBase)
