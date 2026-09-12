'use client'

import { memo } from 'react'
import { NodeResizer, type NodeProps } from '@xyflow/react'
import LldNodeFrame, { SELECTED_BLUE } from '../LldNodeFrame'
import { useInlineEdit } from '../useInlineEdit'
import { useLldActions } from '../LldDiagramContext'
import { AllHandles } from './FlowShapes'
import type {
  ArtifactShape,
  ComponentShape,
  DeployNodeShape,
  InterfaceShape,
  ObjectShape,
} from '@/types/lld'

/**
 * Structural UML shapes: object (instance specification), deployment node,
 * artifact, component and interface.
 */

// ─── object / instance specification ─────────────────────────────────────────

const OBJ_HEADER = 32
const SLOT_H = 20

/**
 * UML underlines `instance : Class` to mark an instance rather than its
 * classifier. An empty instance name renders as `: Class`, which is the standard
 * anonymous form.
 */
function ObjectShapeNodeBase({ id, data, selected, width, height }: NodeProps<ObjectShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, stop, ref, commitProps } = useInlineEdit<'header' | 'slots'>()

  const naturalH = OBJ_HEADER + data.slots.length * SLOT_H + 14
  const w = Math.max(width ?? 0, 150)
  const h = Math.max(height ?? 0, naturalH, 60)
  const stroke = data.stroke ?? '#334155'

  const header = `${data.instanceName}${data.instanceName ? ' ' : ''}: ${data.className}`

  return (
    <div className="group">
      {/* A multi-object is drawn as a stacked pair. */}
      {data.isMultiObject && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: 6,
            top: -6,
            width: w,
            height: h,
            border: `1.5px solid ${stroke}`,
            background: data.fill ?? '#ffffff',
          }}
        />
      )}
      <LldNodeFrame
        selected={selected}
        width={w}
        height={h}
        minWidth={150}
        minHeight={60}
        fill={data.fill}
        stroke={stroke}
        rounded={2}
      >
        <div
          className="border-b px-2 py-1.5 text-center"
          style={{ borderColor: stroke }}
          onDoubleClick={start('header')}
        >
          {editing === 'header' ? (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              className="w-full bg-transparent text-center text-[12px] font-semibold outline-none"
              value={header}
              aria-label="Instance and class"
              onChange={(e) => {
                const [inst, cls] = e.target.value.split(':')
                updateShape(id, {
                  instanceName: (inst ?? '').trim(),
                  className: (cls ?? '').trim(),
                })
              }}
              {...commitProps}
            />
          ) : (
            <p className="truncate text-[12px] font-semibold underline">{header}</p>
          )}
        </div>

        <div className="flex-1 overflow-hidden" onDoubleClick={start('slots')}>
          {editing === 'slots' ? (
            <textarea
              ref={ref as React.Ref<HTMLTextAreaElement>}
              className="h-full w-full resize-none bg-transparent p-2 font-mono text-[11px] outline-none"
              value={data.slots.map((sl) => `${sl.name} = ${sl.value}`).join('\n')}
              aria-label="Slot values"
              placeholder="status = ACTIVE"
              onChange={(e) =>
                updateShape(id, {
                  slots: e.target.value
                    .split('\n')
                    .filter((l) => l.trim() !== '')
                    .map((line, i) => {
                      const [name, ...rest] = line.split('=')
                      return {
                        id: data.slots[i]?.id ?? `slot-${i}`,
                        name: name.trim(),
                        value: rest.join('=').trim(),
                      }
                    }),
                })
              }
              onBlur={stop}
            />
          ) : (
            <ul className="px-2 py-1">
              {data.slots.map((slot) => (
                <li
                  key={slot.id}
                  className="truncate font-mono text-[11px] text-slate-700"
                  style={{ height: SLOT_H }}
                >
                  {slot.name} = <span className="text-slate-500">{slot.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </LldNodeFrame>
    </div>
  )
}

export const ObjectShapeNode = memo(ObjectShapeNodeBase)

// ─── deployment node ─────────────────────────────────────────────────────────

const DEPTH = 12

/** UML draws a deployment target as a 3-D box. */
function DeployNodeShapeNodeBase({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<DeployNodeShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, ref, commitProps } = useInlineEdit<'name'>()

  const w = Math.max(width ?? 0, 160)
  const h = Math.max(height ?? 0, 110)
  const stroke = selected ? SELECTED_BLUE : (data.stroke ?? '#334155')

  const stereotype =
    data.stereotype ??
    (data.nodeKind === 'device'
      ? 'device'
      : data.nodeKind === 'execution-environment'
        ? 'execution environment'
        : undefined)

  return (
    <div className="group relative" style={{ width: w, height: h }}>
      <NodeResizer
        isVisible={!!selected}
        minWidth={160}
        minHeight={110}
        color={SELECTED_BLUE}
        handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
      />
      <AllHandles />

      <svg width={w} height={h} className="absolute inset-0" aria-label="Deployment node">
        <g fill={data.fill ?? '#F8FAFC'} stroke={stroke} strokeWidth={1.5}>
          {/* top and right faces give the 3-D reading */}
          <path d={`M 1,${DEPTH + 1} L ${DEPTH + 1},1 H ${w - 1} L ${w - DEPTH - 1},${DEPTH + 1} Z`} />
          <path d={`M ${w - DEPTH - 1},${DEPTH + 1} L ${w - 1},1 V ${h - DEPTH - 1} L ${w - DEPTH - 1},${h - 1} Z`} />
          <rect x={1} y={DEPTH + 1} width={w - DEPTH - 2} height={h - DEPTH - 2} />
        </g>
      </svg>

      <div
        className="absolute px-2 pt-1"
        style={{ top: DEPTH, left: 0, width: w - DEPTH }}
        onDoubleClick={start('name')}
      >
        {stereotype && (
          <p className="text-center text-[9px] italic leading-tight text-slate-500">
            «{stereotype}»
          </p>
        )}
        {editing === 'name' ? (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            className="w-full bg-transparent text-center text-[12px] font-semibold outline-none"
            value={data.label}
            aria-label="Node name"
            onChange={(e) => updateShape(id, { label: e.target.value })}
            {...commitProps}
          />
        ) : (
          <p className="truncate text-center text-[12px] font-semibold text-slate-800">
            {data.label}
          </p>
        )}
        {data.spec && (
          <p className="truncate text-center text-[9px] text-slate-400">{data.spec}</p>
        )}
      </div>
    </div>
  )
}

export const DeployNodeShapeNode = memo(DeployNodeShapeNodeBase)

// ─── artifact ────────────────────────────────────────────────────────────────

/** Rectangle with the dog-eared page icon in the top-right corner. */
function ArtifactShapeNodeBase({ id, data, selected, width, height }: NodeProps<ArtifactShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, ref, commitProps } = useInlineEdit<'name'>()

  const w = Math.max(width ?? 0, 150)
  const h = Math.max(height ?? 0, 64)
  const stroke = data.stroke ?? '#334155'

  return (
    <div className="group">
      <LldNodeFrame
        selected={selected}
        width={w}
        height={h}
        minWidth={150}
        minHeight={64}
        fill={data.fill}
        stroke={stroke}
        rounded={2}
      >
        <div className="relative flex flex-1 flex-col justify-center px-2">
          <svg
            className="absolute right-1.5 top-1.5"
            width={13}
            height={16}
            aria-hidden="true"
          >
            <path
              d="M1 1 H8 L12 5 V15 H1 Z"
              fill="none"
              stroke={stroke}
              strokeWidth={1.1}
            />
            <path d="M8 1 V5 H12" fill="none" stroke={stroke} strokeWidth={1.1} />
          </svg>

          <p className="text-[9px] italic leading-none text-slate-500">«{data.artifactKind}»</p>
          {editing === 'name' ? (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              className="w-full bg-transparent pr-4 font-mono text-[11px] font-semibold outline-none"
              value={data.label}
              aria-label="Artifact name"
              onChange={(e) => updateShape(id, { label: e.target.value })}
              {...commitProps}
            />
          ) : (
            <p
              className="truncate pr-4 font-mono text-[11px] font-semibold text-slate-800"
              onDoubleClick={start('name')}
            >
              {data.label}
            </p>
          )}
        </div>
      </LldNodeFrame>
    </div>
  )
}

export const ArtifactShapeNode = memo(ArtifactShapeNodeBase)

// ─── component ───────────────────────────────────────────────────────────────

/** Rectangle with the two-tab component icon. */
function ComponentShapeNodeBase({ id, data, selected, width, height }: NodeProps<ComponentShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, ref, commitProps } = useInlineEdit<'name'>()

  const w = Math.max(width ?? 0, 160)
  const h = Math.max(height ?? 0, 72)
  const stroke = data.stroke ?? '#334155'

  return (
    <div className="group">
      <LldNodeFrame
        selected={selected}
        width={w}
        height={h}
        minWidth={160}
        minHeight={72}
        fill={data.fill}
        stroke={stroke}
        rounded={2}
      >
        <div className="relative flex flex-1 flex-col justify-center px-2.5">
          {data.showIcon !== false && (
            <svg className="absolute right-2 top-2" width={18} height={16} aria-hidden="true">
              <rect x={4} y={1} width={13} height={14} fill="none" stroke={stroke} strokeWidth={1.1} />
              <rect x={1} y={3.5} width={6} height={3.5} fill="#ffffff" stroke={stroke} strokeWidth={1.1} />
              <rect x={1} y={9} width={6} height={3.5} fill="#ffffff" stroke={stroke} strokeWidth={1.1} />
            </svg>
          )}

          <p className="text-[9px] italic leading-none text-slate-500">
            «{data.stereotype ?? 'component'}»
          </p>
          {editing === 'name' ? (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              className="w-full bg-transparent pr-6 text-[12px] font-semibold outline-none"
              value={data.label}
              aria-label="Component name"
              onChange={(e) => updateShape(id, { label: e.target.value })}
              {...commitProps}
            />
          ) : (
            <p
              className="truncate pr-6 text-[12px] font-semibold text-slate-800"
              onDoubleClick={start('name')}
            >
              {data.label}
            </p>
          )}
        </div>
      </LldNodeFrame>
    </div>
  )
}

export const ComponentShapeNode = memo(ComponentShapeNodeBase)

// ─── interface (lollipop / socket) ───────────────────────────────────────────

/**
 * Provided interfaces are a filled circle on a stick ("lollipop"); required
 * interfaces are a half-open socket. Pairing them is what makes a component
 * wiring diagram readable.
 */
function InterfaceShapeNodeBase({ id, data, selected, width }: NodeProps<InterfaceShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, ref, commitProps } = useInlineEdit<'name'>()

  const w = Math.max(width ?? 0, 90)
  const h = 40
  const color = selected ? SELECTED_BLUE : (data.stroke ?? '#334155')
  const provided = data.direction === 'provided'

  return (
    <div className="group relative" style={{ width: w, height: h }}>
      <AllHandles />
      <svg width={w} height={22} className="absolute left-0 top-0" aria-label={`${data.direction} interface`}>
        <line x1={0} y1={11} x2={w / 2 - 6} y2={11} stroke={color} strokeWidth={1.5} />
        {provided ? (
          <circle cx={w / 2} cy={11} r={6} fill={color} />
        ) : (
          <path
            d={`M ${w / 2 - 6},4 A 7 7 0 0 0 ${w / 2 - 6},18`}
            fill="none"
            stroke={color}
            strokeWidth={2}
          />
        )}
      </svg>

      <div className="absolute bottom-0 w-full px-0.5" onDoubleClick={start('name')}>
        {editing === 'name' ? (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            className="w-full bg-transparent text-center text-[10px] outline-none"
            value={data.label}
            aria-label="Interface name"
            onChange={(e) => updateShape(id, { label: e.target.value })}
            {...commitProps}
          />
        ) : (
          <p className="truncate text-center text-[10px] text-slate-600">{data.label}</p>
        )}
      </div>
    </div>
  )
}

export const InterfaceShapeNode = memo(InterfaceShapeNodeBase)
