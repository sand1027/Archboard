'use client'

import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import LldNodeFrame from '../LldNodeFrame'
import { useInlineEdit } from '../useInlineEdit'
import { useLldActions } from '../LldDiagramContext'
import {
  formatFields,
  formatMethods,
  parseFields,
  parseMethods,
} from '@/lib/lld/members'
import { VISIBILITY_SIGIL, type ClassShape } from '@/types/lld'

const HEADER_H = 44
const ROW_H = 18
const PADDING = 20
const MIN_W = 160
const MIN_H = 110

/** UML three-compartment class box with inline-editable compartments. */
function ClassShapeNode({ id, data, selected, width, height }: NodeProps<ClassShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, stop, ref, commitProps } = useInlineEdit<
    'name' | 'fields' | 'methods'
  >()

  const isEnum = data.stereotype === 'enum'
  const rows = isEnum
    ? data.enumValues.length
    : data.fields.length + data.methods.length

  // Grow with content so members are never clipped; the resizer can still make
  // the box larger.
  const naturalH = HEADER_H + rows * ROW_H + PADDING + (isEnum ? 0 : ROW_H)
  const w = Math.max(width ?? 0, MIN_W)
  const h = Math.max(height ?? 0, naturalH, MIN_H)

  // 'class' has no keyword; everything else shows its guillemets.
  const stereotypeLabel =
    data.stereotype === 'class'
      ? null
      : data.stereotype === 'struct'
        ? 'record'
        : data.stereotype === 'template'
          ? null
          : data.stereotype

  const italicName = data.stereotype === 'abstract'

  return (
    <div className="group">
      {/* A template class carries a dashed parameter box on its top-right. */}
      {data.stereotype === 'template' && (
        <div
          className="absolute -top-3 right-2 z-10 rounded-sm border border-dashed bg-white px-1.5 text-[9px] text-slate-500"
          style={{ borderColor: data.stroke ?? '#334155' }}
        >
          {data.generics?.replace(/[<>]/g, '') || 'T'}
        </div>
      )}
      <LldNodeFrame
        selected={selected}
        width={w}
        height={h}
        minWidth={MIN_W}
        minHeight={MIN_H}
        fill={data.fill}
        stroke={data.stroke}
        dashed={data.stereotype === 'abstract'}
      >
        {/* name */}
        <div
          className="border-b px-2 py-1.5 text-center"
          style={{ borderColor: data.stroke ?? '#334155' }}
          onDoubleClick={start('name')}
        >
          {stereotypeLabel && (
            <p className="text-[10px] italic leading-tight text-slate-500">«{stereotypeLabel}»</p>
          )}
          {editing === 'name' ? (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              className="w-full bg-transparent text-center text-sm font-semibold outline-none"
              value={data.label}
              aria-label="Class name"
              onChange={(e) => updateShape(id, { label: e.target.value })}
              {...commitProps}
            />
          ) : (
            <p
              className={`truncate text-sm font-semibold ${italicName ? 'italic' : ''}`}
              title={data.label}
            >
              {data.label}
              {data.generics ? <span className="text-slate-400">{data.generics}</span> : null}
            </p>
          )}
        </div>

        {isEnum ? (
          <div className="flex-1 overflow-hidden px-2 py-1" onDoubleClick={start('fields')}>
            {editing === 'fields' ? (
              <textarea
                ref={ref as React.Ref<HTMLTextAreaElement>}
                className="h-full w-full resize-none bg-transparent font-mono text-[11px] outline-none"
                value={data.enumValues.join('\n')}
                aria-label="Enum values"
                onChange={(e) =>
                  updateShape(id, {
                    enumValues: e.target.value.split('\n').filter((v) => v.trim() !== ''),
                  })
                }
                onBlur={stop}
              />
            ) : (
              <ul className="space-y-0.5">
                {data.enumValues.map((v, i) => (
                  <li key={`${v}-${i}`} className="truncate font-mono text-[11px] text-slate-700">
                    {v}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            {/* fields */}
            <div
              className="min-h-[26px] flex-1 overflow-hidden border-b px-2 py-1"
              style={{ borderColor: data.stroke ?? '#334155' }}
              onDoubleClick={start('fields')}
            >
              {editing === 'fields' ? (
                <textarea
                  ref={ref as React.Ref<HTMLTextAreaElement>}
                  className="h-full w-full resize-none bg-transparent font-mono text-[11px] outline-none"
                  value={formatFields(data.fields)}
                  aria-label="Fields"
                  placeholder="+ name: Type"
                  onChange={(e) => updateShape(id, { fields: parseFields(e.target.value) })}
                  onBlur={stop}
                />
              ) : (
                <ul className="space-y-0.5">
                  {data.fields.map((f) => (
                    <li
                      key={f.id}
                      className={`truncate font-mono text-[11px] text-slate-700 ${f.isStatic ? 'underline' : ''}`}
                    >
                      <span className="text-slate-400">{VISIBILITY_SIGIL[f.visibility]}</span>{' '}
                      {f.name}
                      {f.type ? <span className="text-slate-500">: {f.type}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* methods */}
            <div
              className="min-h-[26px] flex-1 overflow-hidden px-2 py-1"
              onDoubleClick={start('methods')}
            >
              {editing === 'methods' ? (
                <textarea
                  ref={ref as React.Ref<HTMLTextAreaElement>}
                  className="h-full w-full resize-none bg-transparent font-mono text-[11px] outline-none"
                  value={formatMethods(data.methods)}
                  aria-label="Methods"
                  placeholder="+ run(arg: Type): Result"
                  onChange={(e) => updateShape(id, { methods: parseMethods(e.target.value) })}
                  onBlur={stop}
                />
              ) : (
                <ul className="space-y-0.5">
                  {data.methods.map((m) => (
                    <li
                      key={m.id}
                      className={[
                        'truncate font-mono text-[11px] text-slate-700',
                        m.isStatic ? 'underline' : '',
                        m.isAbstract ? 'italic' : '',
                      ].join(' ')}
                    >
                      <span className="text-slate-400">{VISIBILITY_SIGIL[m.visibility]}</span>{' '}
                      {m.name}(
                      {m.params.map((p) => (p.type ? `${p.name}: ${p.type}` : p.name)).join(', ')})
                      {m.returnType ? <span className="text-slate-500">: {m.returnType}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </LldNodeFrame>
    </div>
  )
}

export default memo(ClassShapeNode)
