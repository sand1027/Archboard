'use client'

import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { NodeResizer, Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { UmlEntityNodeData, EntityAttribute } from '@/types/lld'
import { useDiagramStore } from '@/store/diagramStore'

type UmlEntityNodeType = Node<UmlEntityNodeData, 'umlEntity'>

function formatAttr(a: EntityAttribute) {
  const prefix = a.kind === 'pk' ? '🔑 ' : a.kind === 'fk' ? '🔗 ' : ''
  return `${prefix}${a.name}${a.type ? `: ${a.type}` : ''}`
}

function parseAttrs(text: string): EntityAttribute[] {
  return text.split('\n').map((line) => {
    const raw = line.trim()
    if (!raw) return { name: '', kind: 'attr' as const }
    let kind: EntityAttribute['kind'] = 'attr'
    let rest = raw
    if (rest.startsWith('🔑') || rest.toLowerCase().startsWith('pk ')) {
      kind = 'pk'
      rest = rest.replace(/^🔑\s*/, '').replace(/^pk\s+/i, '')
    } else if (rest.startsWith('🔗') || rest.toLowerCase().startsWith('fk ')) {
      kind = 'fk'
      rest = rest.replace(/^🔗\s*/, '').replace(/^fk\s+/i, '')
    }
    const [name, ...typeParts] = rest.split(':')
    return {
      name: name.trim(),
      type: typeParts.join(':').trim() || undefined,
      kind,
    }
  })
}

function UmlEntityNode({ id, data, selected, width, height }: NodeProps<UmlEntityNodeType>) {
  const { updateNode } = useDiagramStore()
  const [editing, setEditing] = useState<'name' | 'attrs' | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const attrsRef = useRef<HTMLTextAreaElement>(null)

  const w = width ?? 180
  const h = height ?? 140
  const name = data.name ?? 'Entity'
  const weak = !!data.weak
  const attributes = data.attributes ?? []
  const fill = data.fill ?? '#ffffff'
  const stroke = data.stroke ?? '#334155'

  useEffect(() => {
    if (editing === 'name') nameRef.current?.focus()
    if (editing === 'attrs') attrsRef.current?.focus()
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
    <div className="relative h-full w-full select-none" style={{ width: w, height: h }}>
      <NodeResizer
        isVisible={!!selected}
        minWidth={140}
        minHeight={90}
        color="#3B82F6"
        handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
      />
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-slate-400 !border-white" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-slate-400 !border-white" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-slate-400 !border-white" />
      <div
        className="flex h-full w-full flex-col overflow-hidden"
        style={{
          border: `${weak ? 3 : 1.5}px solid ${selected ? '#3B82F6' : stroke}`,
          outline: weak ? `1px solid ${stroke}` : undefined,
          outlineOffset: weak ? -6 : undefined,
          background: fill,
          boxShadow: selected ? '0 0 0 1px #93C5FD' : undefined,
        }}
      >
        <div
          className="border-b px-2 py-1.5 text-center font-semibold"
          style={{ borderColor: stroke, background: '#F8FAFC' }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setEditing('name')
          }}
        >
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
            <p className="text-sm truncate">{name}</p>
          )}
        </div>
        <div
          className="flex-1 px-2 py-1.5 overflow-hidden"
          onDoubleClick={(e) => {
            e.stopPropagation()
            setEditing('attrs')
          }}
        >
          {editing === 'attrs' ? (
            <textarea
              ref={attrsRef}
              className="w-full h-full resize-none bg-transparent text-[11px] font-mono outline-none leading-relaxed"
              value={attributes.map(formatAttr).join('\n')}
              onChange={(e) => updateNode(id, { attributes: parseAttrs(e.target.value) })}
              onBlur={stop}
              placeholder={'pk id: uuid\nfk user_id: uuid\nname: string'}
            />
          ) : attributes.length === 0 ? (
            <p className="text-[10px] text-slate-300">attributes</p>
          ) : (
            attributes.map((a, i) => (
              <p key={i} className="text-[11px] font-mono leading-relaxed truncate text-slate-700">
                {formatAttr(a) || ' '}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(UmlEntityNode)
