'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Key, Link2, Eye, Table2 } from 'lucide-react'
import LldNodeFrame from '../LldNodeFrame'
import { useInlineEdit } from '../useInlineEdit'
import { useLldActions } from '../LldDiagramContext'
import { formatColumns, parseColumns } from '@/lib/lld/members'
import type { ErTableShape } from '@/types/lld'

const HEADER_H = 34
const ROW_H = 22
const PADDING = 12
const MIN_W = 180
const MIN_H = 90

/**
 * ER table with one connectable handle per column.
 *
 * Column handle ids are `col:{column.id}` — anchored to the column's own stable
 * id, so FK lines survive reordering, insertion and renaming.
 */
function ErTableShapeNode({ id, data, selected, width, height }: NodeProps<ErTableShape>) {
  const { updateShape } = useLldActions()
  const { editing, start, stop, ref, commitProps } = useInlineEdit<'name' | 'columns'>()

  const naturalH = HEADER_H + data.columns.length * ROW_H + PADDING
  const w = Math.max(width ?? 0, MIN_W)
  const h = Math.max(height ?? 0, naturalH, MIN_H)

  const isView = data.tableKind === 'view'
  const stroke = data.stroke ?? '#334155'

  return (
    <div className="group">
      <LldNodeFrame
        selected={selected}
        width={w}
        height={h}
        minWidth={MIN_W}
        minHeight={MIN_H}
        fill={data.fill}
        stroke={stroke}
        dashed={isView}
      >
        <div
          className="flex items-center gap-1.5 border-b px-2 py-1.5"
          style={{ borderColor: stroke, background: isView ? '#F8FAFC' : '#F1F5F9' }}
          onDoubleClick={start('name')}
        >
          {isView ? (
            <Eye className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          ) : (
            <Table2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          )}
          {editing === 'name' ? (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              className="w-full bg-transparent font-mono text-[12px] font-semibold outline-none"
              value={data.label}
              aria-label="Table name"
              onChange={(e) => updateShape(id, { label: e.target.value })}
              {...commitProps}
            />
          ) : (
            <p className="truncate font-mono text-[12px] font-semibold" title={data.label}>
              {data.label}
            </p>
          )}
        </div>

        <div className="relative flex-1 overflow-hidden" onDoubleClick={start('columns')}>
          {editing === 'columns' ? (
            <textarea
              ref={ref as React.Ref<HTMLTextAreaElement>}
              className="h-full w-full resize-none bg-transparent p-2 font-mono text-[11px] outline-none"
              value={formatColumns(data.columns)}
              aria-label="Columns"
              placeholder="pk id: uuid"
              onChange={(e) => updateShape(id, { columns: parseColumns(e.target.value) })}
              onBlur={stop}
            />
          ) : (
            <ul>
              {data.columns.map((col, i) => (
                <li
                  key={col.id}
                  className="flex items-center gap-1.5 px-2 font-mono text-[11px] text-slate-700"
                  style={{ height: ROW_H }}
                >
                  {col.isPk ? (
                    <Key className="h-3 w-3 shrink-0 text-amber-500" aria-label="primary key" />
                  ) : col.isFk ? (
                    <Link2 className="h-3 w-3 shrink-0 text-sky-500" aria-label="foreign key" />
                  ) : (
                    <span className="w-3 shrink-0" />
                  )}
                  <span className={`truncate ${col.isPk ? 'font-semibold' : ''}`}>{col.name}</span>
                  <span className="ml-auto shrink-0 text-slate-400">{col.type}</span>
                  {col.isUnique && !col.isPk && (
                    <span className="shrink-0 text-[9px] text-violet-500">U</span>
                  )}
                  {col.isNullable && <span className="shrink-0 text-[9px] text-slate-300">?</span>}

                  {/* Column-level FK anchors. */}
                  <Handle
                    type="source"
                    id={`col:${col.id}`}
                    position={Position.Right}
                    className="!h-1.5 !w-1.5 !border-white !bg-sky-400 !opacity-0 group-hover:!opacity-100"
                    style={{ top: HEADER_H + i * ROW_H + ROW_H / 2 }}
                  />
                  <Handle
                    type="target"
                    id={`col:${col.id}-in`}
                    position={Position.Left}
                    className="!h-1.5 !w-1.5 !border-white !bg-sky-400 !opacity-0 group-hover:!opacity-100"
                    style={{ top: HEADER_H + i * ROW_H + ROW_H / 2 }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {data.indexes.length > 0 && (
          <div
            className="border-t px-2 py-1 text-[10px] text-slate-500"
            style={{ borderColor: stroke }}
          >
            {data.indexes.map((idx) => (
              <p key={idx.id} className="truncate font-mono">
                {idx.isUnique ? 'unique ' : ''}idx {idx.name}
              </p>
            ))}
          </div>
        )}
      </LldNodeFrame>
    </div>
  )
}

export default memo(ErTableShapeNode)
