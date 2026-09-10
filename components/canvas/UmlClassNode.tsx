'use client'

import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { NodeResizer, Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { UmlClassNodeData } from '@/types/lld'
import { useDiagramStore } from '@/store/diagramStore'

type UmlClassNodeType = Node<UmlClassNodeData, 'umlClass'>

function UmlClassNode({ id, data, selected, width, height }: NodeProps<UmlClassNodeType>) {
  const { updateNode } = useDiagramStore()
  const [editing, setEditing] = useState<'name' | 'attrs' | 'methods' | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const attrsRef = useRef<HTMLTextAreaElement>(null)
  const methodsRef = useRef<HTMLTextAreaElement>(null)

  const w = width ?? 200
  const h = height ?? 160
  const name = data.name ?? 'ClassName'
  const stereotype = data.stereotype ?? 'class'
  const attributes = data.attributes ?? []
  const methods = data.methods ?? []
  const fill = data.fill ?? '#ffffff'
  const stroke = data.stroke ?? '#334155'

  const stereotypeLabel =
    stereotype === 'class'
      ? null
      : stereotype === 'abstract'
        ? 'abstract'
        : stereotype

  useEffect(() => {
    if (editing === 'name') nameRef.current?.focus()
    if (editing === 'attrs') attrsRef.current?.focus()
    if (editing === 'methods') methodsRef.current?.focus()
  }, [editing])

  const stop = useCallback(() => setEditing(null), [])

  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, stop])

  return (
    <div
      className="relative h-full w-full select-none"
      style={{ width: w, height: h, minWidth: 140, minHeight: 100 }}
    >
      <NodeResizer
        isVisible={!!selected}
        minWidth={140}
        minHeight={100}
        color="#3B82F6"
        handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
      />
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-slate-400 !border-white" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-slate-400 !border-white" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-slate-400 !border-white" />
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-white text-slate-900"
        style={{
          border: `${stereotype === 'package' ? 1.5 : 1.5}px solid ${selected ? '#3B82F6' : stroke}`,
          background: fill,
          boxShadow: selected ? '0 0 0 1px #93C5FD' : undefined,
        }}
      >
        <div
          className="border-b px-2 py-1.5 text-center"
          style={{ borderColor: stroke }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setEditing('name')
          }}
        >
          {stereotypeLabel && (
            <p className="text-[10px] text-slate-500 italic leading-tight">
              «{stereotypeLabel}»
            </p>
          )}
          {editing === 'name' ? (
            <input
              ref={nameRef}
              className="w-full bg-transparent text-center text-sm font-semibold outline-none"
              value={name}
              onChange={(e) => updateNode(id, { name: e.target.value })}
              onBlur={stop}
              onKeyDown={(e) => {
                if (e.key === 'Enter') stop()
              }}
            />
          ) : (
            <p
              className={[
                'text-sm font-semibold truncate',
                stereotype === 'abstract' || data.isAbstract ? 'italic' : '',
              ].join(' ')}
            >
              {name}
            </p>
          )}
        </div>

        <div
          className="flex-1 border-b px-2 py-1 min-h-[36px] overflow-hidden"
          style={{ borderColor: stroke }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setEditing('attrs')
          }}
        >
          {editing === 'attrs' ? (
            <textarea
              ref={attrsRef}
              className="w-full h-full resize-none bg-transparent text-[11px] font-mono outline-none leading-relaxed"
              value={attributes.join('\n')}
              onChange={(e) =>
                updateNode(id, {
                  attributes: e.target.value.split('\n'),
                })
              }
              onBlur={stop}
              placeholder="+ field: Type"
            />
          ) : attributes.length === 0 ? (
            <p className="text-[10px] text-slate-300">attributes</p>
          ) : (
            attributes.map((a, i) => (
              <p key={i} className="text-[11px] font-mono leading-relaxed truncate text-slate-700">
                {a || ' '}
              </p>
            ))
          )}
        </div>

        <div
          className="flex-1 px-2 py-1 min-h-[36px] overflow-hidden"
          onDoubleClick={(e) => {
            e.stopPropagation()
            setEditing('methods')
          }}
        >
          {editing === 'methods' ? (
            <textarea
              ref={methodsRef}
              className="w-full h-full resize-none bg-transparent text-[11px] font-mono outline-none leading-relaxed"
              value={methods.join('\n')}
              onChange={(e) =>
                updateNode(id, {
                  methods: e.target.value.split('\n'),
                })
              }
              onBlur={stop}
              placeholder="+ method(): void"
            />
          ) : methods.length === 0 ? (
            <p className="text-[10px] text-slate-300">methods</p>
          ) : (
            methods.map((m, i) => (
              <p key={i} className="text-[11px] font-mono leading-relaxed truncate text-slate-700">
                {m || ' '}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(UmlClassNode)
