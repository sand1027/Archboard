'use client'

import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { NodeResizer, type NodeProps, type Node } from '@xyflow/react'
import {
  User, Users, Lock, Key, Database, Server, Mail, Webhook, FileText, Folder,
  Cloud, Smartphone, Globe, Settings, Bell, ShoppingCart, CreditCard,
  ListOrdered, Zap, Shield, Box,
} from 'lucide-react'
import type { IconNodeData } from '@/types/lld'
import { useDiagramStore } from '@/store/diagramStore'

type IconNodeType = Node<IconNodeData, 'icon'>

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  User,
  Users,
  Lock,
  Key,
  Database,
  Server,
  Mail,
  Webhook,
  FileText,
  Folder,
  Cloud,
  Smartphone,
  Globe,
  Settings,
  Bell,
  ShoppingCart,
  CreditCard,
  ListOrdered,
  Zap,
  Shield,
}

function IconNode({ id, data, selected, width, height }: NodeProps<IconNodeType>) {
  const { updateNode } = useDiagramStore()
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const w = width ?? 72
  const h = height ?? 80
  const label = data.label ?? 'Icon'
  const iconName = data.iconName ?? 'Box'
  const color = data.color ?? '#334155'
  const Icon = ICON_MAP[iconName] ?? Box

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const stop = useCallback(() => setEditing(false), [])

  return (
    <div
      className="flex flex-col items-center justify-center gap-1 select-none"
      style={{ width: w, height: h }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
    >
      <NodeResizer
        isVisible={!!selected}
        minWidth={56}
        minHeight={64}
        color="#3B82F6"
        handleStyle={{ width: 6, height: 6, borderRadius: 2 }}
      />
      <div
        className="flex items-center justify-center rounded-xl"
        style={{
          width: 44,
          height: 44,
          background: data.fill ?? '#F8FAFC',
          border: `1.5px solid ${selected ? '#3B82F6' : data.stroke ?? '#E2E8F0'}`,
          boxShadow: selected ? '0 0 0 1px #93C5FD' : undefined,
        }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      {editing ? (
        <input
          ref={inputRef}
          className="w-full bg-transparent text-center text-[11px] font-medium outline-none"
          value={label}
          onChange={(e) => updateNode(id, { label: e.target.value })}
          onBlur={stop}
          onKeyDown={(e) => {
            if (e.key === 'Enter') stop()
          }}
        />
      ) : (
        <p className="text-[11px] font-medium text-slate-700 text-center truncate max-w-full px-0.5">
          {label}
        </p>
      )}
    </div>
  )
}

export default memo(IconNode)
