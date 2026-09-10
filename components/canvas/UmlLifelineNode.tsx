'use client'

import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { NodeResizer, Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { UmlLifelineNodeData } from '@/types/lld'
import { useDiagramStore } from '@/store/diagramStore'

type UmlLifelineNodeType = Node<UmlLifelineNodeData, 'umlLifeline'>

function ActorHead({ stroke }: { stroke: string }) {
  return (
    <svg width="40" height="56" viewBox="0 0 40 56" className="mx-auto">
      <circle cx="20" cy="10" r="8" fill="none" stroke={stroke} strokeWidth="1.75" />
      <line x1="20" y1="18" x2="20" y2="36" stroke={stroke} strokeWidth="1.75" />
      <line x1="8" y1="26" x2="32" y2="26" stroke={stroke} strokeWidth="1.75" />
      <line x1="20" y1="36" x2="10" y2="52" stroke={stroke} strokeWidth="1.75" />
      <line x1="20" y1="36" x2="30" y2="52" stroke={stroke} strokeWidth="1.75" />
    </svg>
  )
}

function UmlLifelineNode({ id, data, selected, width, height }: NodeProps<UmlLifelineNodeType>) {
  const { updateNode } = useDiagramStore()
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const w = width ?? 120
  const h = height ?? 360
  const label = data.label ?? 'Object'
  const kind = data.kind ?? 'object'
  const stroke = data.stroke ?? '#334155'
  const fill = data.fill ?? '#ffffff'
  const activations = data.activations ?? [{ start: 90, end: 220 }]
  const headH = kind === 'actor' ? 72 : 44
  const lifeX = w / 2

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const stop = useCallback(() => setEditing(false), [])

  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, stop])

  return (
    <div className="relative select-none" style={{ width: w, height: h }}>
      <NodeResizer
        isVisible={!!selected}
        minWidth={80}
        minHeight={200}
        color="#3B82F6"
        handleStyle={{ width: 7, height: 7, borderRadius: 2 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ top: '40%' }}
        className="!w-2 !h-2 !bg-slate-400 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ top: '40%' }}
        className="!w-2 !h-2 !bg-slate-400 !border-white"
      />

      {/* Head */}
      <div
        className="absolute left-1/2 -translate-x-1/2 text-center"
        style={{ top: 0, width: kind === 'actor' ? 80 : Math.min(w, 140) }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          setEditing(true)
        }}
      >
        {kind === 'actor' ? (
          <ActorHead stroke={selected ? '#3B82F6' : stroke} />
        ) : (
          <div
            className="px-2 py-1.5 text-xs font-semibold truncate"
            style={{
              border: `1.5px solid ${selected ? '#3B82F6' : stroke}`,
              background: fill,
              borderRadius: kind === 'control' ? 999 : 4,
            }}
          >
            {kind !== 'object' && (
              <span className="block text-[9px] font-normal text-slate-500 italic">
                «{kind}»
              </span>
            )}
            {editing ? (
              <input
                ref={inputRef}
                className="w-full bg-transparent text-center outline-none"
                value={label}
                onChange={(e) => updateNode(id, { label: e.target.value })}
                onBlur={stop}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') stop()
                }}
              />
            ) : (
              label
            )}
          </div>
        )}
        {kind === 'actor' &&
          (editing ? (
            <input
              ref={inputRef}
              className="mt-1 w-full bg-transparent text-center text-xs outline-none"
              value={label}
              onChange={(e) => updateNode(id, { label: e.target.value })}
              onBlur={stop}
              onKeyDown={(e) => {
                if (e.key === 'Enter') stop()
              }}
            />
          ) : (
            <p className="mt-1 text-xs font-medium text-slate-700 truncate">{label}</p>
          ))}
      </div>

      {/* Lifeline + activations */}
      <svg
        width={w}
        height={h}
        className="absolute inset-0 pointer-events-none overflow-visible"
      >
        <line
          x1={lifeX}
          y1={headH}
          x2={lifeX}
          y2={h - 8}
          stroke={selected ? '#3B82F6' : stroke}
          strokeWidth={1.25}
          strokeDasharray="5 4"
        />
        {activations.map((a, i) => (
          <rect
            key={i}
            x={lifeX - 6}
            y={a.start}
            width={12}
            height={Math.max(8, a.end - a.start)}
            fill={fill}
            stroke={selected ? '#3B82F6' : stroke}
            strokeWidth={1.5}
          />
        ))}
      </svg>
    </div>
  )
}

export default memo(UmlLifelineNode)
