'use client'

import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Lock, Gauge, Zap, Filter } from 'lucide-react'
import LldNodeFrame from '../LldNodeFrame'
import { useInlineEdit } from '../useInlineEdit'
import { useLldActions } from '../LldDiagramContext'
import { formatSchemaFields, parseSchemaFields } from '@/lib/lld/members'
import type {
  ApiAnnotationShape,
  ApiEndpointShape,
  ApiSchemaShape,
  HttpMethod,
} from '@/types/lld'

/** Method badge colours follow the convention most API tools use. */
const METHOD_COLOR: Record<HttpMethod, string> = {
  GET: '#059669',
  POST: '#2563EB',
  PUT: '#D97706',
  PATCH: '#7C3AED',
  DELETE: '#DC2626',
  HEAD: '#64748B',
  OPTIONS: '#64748B',
}

function ApiEndpointShapeNodeBase({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<ApiEndpointShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, ref, commitProps } = useInlineEdit<'path'>()

  const w = Math.max(width ?? 0, 200)
  const h = Math.max(height ?? 0, 64)

  return (
    <div className="group">
      <LldNodeFrame
        selected={selected}
        width={w}
        height={h}
        minWidth={200}
        minHeight={64}
        fill={data.fill}
        stroke={data.stroke}
        rounded={8}
      >
        <div className="flex flex-1 items-center gap-2 px-2">
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white"
            style={{ background: METHOD_COLOR[data.method] }}
          >
            {data.method}
          </span>
          {editing === 'path' ? (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              className="w-full bg-transparent font-mono text-[12px] outline-none"
              value={data.path}
              aria-label="Endpoint path"
              onChange={(e) => updateShape(id, { path: e.target.value })}
              {...commitProps}
            />
          ) : (
            <p
              className="truncate font-mono text-[12px] text-slate-800"
              title={data.path}
              onDoubleClick={start('path')}
            >
              {data.path}
            </p>
          )}
        </div>
        {data.summary && (
          <p className="truncate px-2 pb-1 text-[10px] text-slate-500">{data.summary}</p>
        )}
      </LldNodeFrame>
    </div>
  )
}

export const ApiEndpointShapeNode = memo(ApiEndpointShapeNodeBase)

const STATUS_COLOR = (code: number): string => {
  if (code < 300) return '#059669'
  if (code < 400) return '#0EA5E9'
  if (code < 500) return '#D97706'
  return '#DC2626'
}

const HEADER_H = 30
const ROW_H = 20

function ApiSchemaShapeNodeBase({ id, data, selected, width, height }: NodeProps<ApiSchemaShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, stop, ref, commitProps } = useInlineEdit<'name' | 'fields'>()

  const naturalH = HEADER_H + data.fields.length * ROW_H + 24
  const w = Math.max(width ?? 0, 180)
  const h = Math.max(height ?? 0, naturalH, 90)

  const stroke = data.stroke ?? '#334155'
  const isResponse = data.role === 'response'
  const accent = isResponse ? STATUS_COLOR(data.statusCode ?? 200) : '#2563EB'

  return (
    <div className="group">
      <LldNodeFrame
        selected={selected}
        width={w}
        height={h}
        minWidth={180}
        minHeight={90}
        fill={data.fill}
        stroke={stroke}
      >
        <div
          className="flex items-center gap-1.5 border-b px-2 py-1"
          style={{ borderColor: stroke, background: '#F8FAFC' }}
          onDoubleClick={start('name')}
        >
          {isResponse && (
            <span
              className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold text-white"
              style={{ background: accent }}
            >
              {data.statusCode ?? 200}
            </span>
          )}
          {editing === 'name' ? (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              className="w-full bg-transparent text-[11px] font-semibold outline-none"
              value={data.label}
              aria-label="Schema name"
              onChange={(e) => updateShape(id, { label: e.target.value })}
              {...commitProps}
            />
          ) : (
            <p className="truncate text-[11px] font-semibold">{data.label}</p>
          )}
        </div>

        <div className="flex-1 overflow-hidden" onDoubleClick={start('fields')}>
          {editing === 'fields' ? (
            <textarea
              ref={ref as React.Ref<HTMLTextAreaElement>}
              className="h-full w-full resize-none bg-transparent p-2 font-mono text-[11px] outline-none"
              value={formatSchemaFields(data.fields)}
              aria-label="Schema fields"
              placeholder="name: string / optional?: int"
              onChange={(e) => updateShape(id, { fields: parseSchemaFields(e.target.value) })}
              onBlur={stop}
            />
          ) : (
            <ul className="px-2 py-1">
              {data.fields.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-1 font-mono text-[11px] text-slate-700"
                  style={{ height: ROW_H }}
                >
                  <span className="truncate">
                    {f.name}
                    {!f.required && <span className="text-slate-400">?</span>}
                  </span>
                  <span className="ml-auto shrink-0 text-slate-400">{f.type}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          className="border-t px-2 py-0.5 text-[9px] text-slate-400"
          style={{ borderColor: stroke }}
        >
          {data.contentType}
        </div>
      </LldNodeFrame>
    </div>
  )
}

export const ApiSchemaShapeNode = memo(ApiSchemaShapeNodeBase)

const ANNOTATION_ICON = {
  auth: Lock,
  'rate-limit': Gauge,
  cache: Zap,
  middleware: Filter,
} as const

function ApiAnnotationShapeNodeBase({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<ApiAnnotationShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, ref, commitProps } = useInlineEdit<'detail'>()

  const w = Math.max(width ?? 0, 150)
  const h = Math.max(height ?? 0, 52)
  const Icon = ANNOTATION_ICON[data.annotationKind]

  return (
    <div className="group">
      <LldNodeFrame
        selected={selected}
        width={w}
        height={h}
        minWidth={150}
        minHeight={52}
        fill={data.fill}
        stroke={data.stroke}
        rounded={999}
      >
        <div className="flex flex-1 items-center gap-2 px-3">
          <Icon className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              {data.label}
            </p>
            {editing === 'detail' ? (
              <input
                ref={ref as React.Ref<HTMLInputElement>}
                className="w-full bg-transparent text-[11px] outline-none"
                value={data.detail}
                aria-label="Annotation detail"
                onChange={(e) => updateShape(id, { detail: e.target.value })}
                {...commitProps}
              />
            ) : (
              <p
                className="truncate text-[11px] text-slate-700"
                onDoubleClick={start('detail')}
                title={data.detail}
              >
                {data.detail}
              </p>
            )}
          </div>
        </div>
      </LldNodeFrame>
    </div>
  )
}

export const ApiAnnotationShapeNode = memo(ApiAnnotationShapeNodeBase)
