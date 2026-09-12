'use client'

import {
  memo, useState, useRef, useCallback, useEffect, type CSSProperties,
} from 'react'
import {
  NodeResizer, Handle, Position, useReactFlow, type NodeProps,
} from '@xyflow/react'
import type { Node } from '@xyflow/react'
import type { ShapeNodeData, ShapePoint } from '@/types/architecture'
import { useDiagramStore } from '@/store/diagramStore'

type ShapeNodeType = Node<ShapeNodeData, 'shape'>

// ─── helpers ─────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number) {
  if (!hex || hex === 'transparent') return 'none'
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function strokeDash(style: string, width: number) {
  if (style === 'dashed') return `${width * 3.5},${width * 2.5}`
  if (style === 'dotted') return `${width},${width * 1.75}`
  return undefined
}

function isLinear(type: string) {
  return type === 'line' || type === 'arrow'
}

function defaultEndpoints(w: number, h: number, pad: number) {
  return {
    start: { x: pad, y: h / 2 },
    end:   { x: w - pad, y: h / 2 },
  }
}

// ─── Linear stroke (line / arrow) ────────────────────────────────────────────

function LinearStroke({
  shapeType, start, end, stroke, strokeWidth, strokeStyle, selected,
}: {
  shapeType: 'line' | 'arrow'
  start: ShapePoint; end: ShapePoint
  stroke: string; strokeWidth: number; strokeStyle: string; selected: boolean
}) {
  const sw = strokeWidth
  const dash = strokeDash(strokeStyle, sw)
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len; const uy = dy / len
  const headLen = Math.max(12, sw * 4.2)
  const headW   = Math.max(9, sw * 3.2)
  const tipInset = shapeType === 'arrow' ? headLen * 0.72 : 0
  const lineEnd = { x: end.x - ux * tipInset, y: end.y - uy * tipInset }
  const px = -uy; const py = ux
  const baseX = end.x - ux * headLen; const baseY = end.y - uy * headLen
  const lp = { x: baseX + px * headW * 0.5, y: baseY + py * headW * 0.5 }
  const rp = { x: baseX - px * headW * 0.5, y: baseY - py * headW * 0.5 }

  return (
    <svg width="100%" height="100%"
      style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
      {selected && (
        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y}
          stroke="#3B82F6" strokeWidth={sw + 6} strokeLinecap="round" opacity={0.18} />
      )}
      <line x1={start.x} y1={start.y} x2={lineEnd.x} y2={lineEnd.y}
        stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeDasharray={dash} />
      {shapeType === 'arrow' && len > 6 && (
        <polygon points={`${end.x},${end.y} ${lp.x},${lp.y} ${rp.x},${rp.y}`}
          fill={stroke} stroke={stroke} strokeWidth={1} strokeLinejoin="round" />
      )}
      {selected && (
        <>
          <circle cx={start.x} cy={start.y} r={4} fill="#fff" stroke="#3B82F6" strokeWidth={1.5} />
          <circle cx={end.x}   cy={end.y}   r={4} fill="#fff" stroke="#3B82F6" strokeWidth={1.5} />
        </>
      )}
    </svg>
  )
}

// ─── Closed shape SVG ────────────────────────────────────────────────────────

function ClosedShapeSVG({
  shapeType, fill, fillOpacity, stroke, strokeWidth, strokeStyle, cornerRadius, w, h, selected,
}: {
  shapeType: ShapeNodeData['shapeType']
  fill: string; fillOpacity: number; stroke: string; strokeWidth: number
  strokeStyle: string; cornerRadius: number; w: number; h: number; selected: boolean
}) {
  const sw  = strokeWidth
  const dash = strokeDash(strokeStyle, sw)
  const fillColor = fill === 'transparent' ? 'none' : hexToRgba(fill, fillOpacity)
  const pad = sw / 2 + 0.5
  const iw  = Math.max(0, w - pad * 2)
  const ih  = Math.max(0, h - pad * 2)

  const shared = {
    fill: fillColor, stroke, strokeWidth: sw,
    strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const,
    ...(dash ? { strokeDasharray: dash } : {}),
  }

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>

      {shapeType === 'rectangle' && (
        <rect x={pad} y={pad} width={iw} height={ih}
          rx={Math.min(cornerRadius, iw / 2, ih / 2)} ry={Math.min(cornerRadius, iw / 2, ih / 2)}
          {...shared} />
      )}
      {shapeType === 'ellipse' && (
        <ellipse cx={w / 2} cy={h / 2} rx={iw / 2} ry={ih / 2} {...shared} />
      )}
      {shapeType === 'diamond' && (
        <polygon points={`${w/2},${pad} ${w-pad},${h/2} ${w/2},${h-pad} ${pad},${h/2}`} {...shared} />
      )}
      {shapeType === 'triangle' && (
        <polygon points={`${w/2},${pad} ${w-pad},${h-pad} ${pad},${h-pad}`} {...shared} />
      )}
      {shapeType === 'parallelogram' && (() => {
        const sk = Math.min(iw * 0.2, iw * 0.35)
        return <polygon points={`${pad+sk},${pad} ${w-pad},${pad} ${w-pad-sk},${h-pad} ${pad},${h-pad}`} {...shared} />
      })()}
      {shapeType === 'cylinder' && (() => {
        const ry = Math.min(Math.max(ih * 0.1, 8), 22)
        const top = pad + ry; const bot = h - pad - ry
        return (
          <>
            <path d={`M${pad} ${top} L${pad} ${bot} A${iw/2} ${ry} 0 0 0 ${w-pad} ${bot} L${w-pad} ${top} A${iw/2} ${ry} 0 0 0 ${pad} ${top} Z`} {...shared} />
            <ellipse cx={w/2} cy={top} rx={iw/2} ry={ry} {...shared} />
          </>
        )
      })()}
      {shapeType === 'hexagon' && (() => {
        const ix = Math.min(iw * 0.2, iw / 2)
        return (
          <polygon points={`${pad+ix},${pad} ${w-pad-ix},${pad} ${w-pad},${h/2} ${w-pad-ix},${h-pad} ${pad+ix},${h-pad} ${pad},${h/2}`} {...shared} />
        )
      })()}
      {shapeType === 'star' && <polygon points={starPoints(w, h, pad)} {...shared} />}
      {shapeType === 'terminator' && (
        <rect x={pad} y={pad} width={iw} height={ih}
          rx={Math.min(ih/2, iw/2)} ry={Math.min(ih/2, iw/2)} {...shared} />
      )}
      {shapeType === 'document' && (() => {
        const wv = Math.min(14, ih * 0.18)
        return <path d={`M${pad} ${pad} L${w-pad} ${pad} L${w-pad} ${h-pad-wv} Q${w*0.75} ${h-pad+wv*0.6} ${w/2} ${h-pad-wv*0.2} Q${w*0.25} ${h-pad-wv} ${pad} ${h-pad-wv*0.15} Z`} {...shared} />
      })()}
      {shapeType === 'preparation' && (() => {
        const ix = Math.min(iw * 0.18, 28)
        return <polygon points={`${pad+ix},${pad} ${w-pad-ix},${pad} ${w-pad},${h/2} ${w-pad-ix},${h-pad} ${pad+ix},${h-pad} ${pad},${h/2}`} {...shared} />
      })()}
      {shapeType === 'connector' && (
        <ellipse cx={w/2} cy={h/2} rx={Math.min(iw, ih)/2} ry={Math.min(iw, ih)/2} {...shared} />
      )}
      {shapeType === 'note' && (() => {
        const fold = Math.min(18, Math.min(iw, ih) * 0.22)
        return (
          <>
            <path d={`M${pad} ${pad} L${w-pad-fold} ${pad} L${w-pad} ${pad+fold} L${w-pad} ${h-pad} L${pad} ${h-pad} Z`} {...shared} />
            <path d={`M${w-pad-fold} ${pad} L${w-pad-fold} ${pad+fold} L${w-pad} ${pad+fold}`} fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
          </>
        )
      })()}
    </svg>
  )
}

function starPoints(w: number, h: number, pad: number) {
  const cx = w / 2; const cy = h / 2
  const outerR = Math.min(w, h) / 2 - pad
  const innerR = outerR * 0.4
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2
    const r = i % 2 === 0 ? outerR : innerR
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
  }
  return pts.join(' ')
}

// ─── Excalidraw-style inline text editor ─────────────────────────────────────

interface InlineTextEditorProps {
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  fontSize: number
  fontWeight: string
  textAlign: 'left' | 'center' | 'right'
  textColor: string
  width: number
  height: number
  /** Absolute position inside the node (shape labels) */
  x?: number
  y?: number
  freePlace?: boolean
}

function InlineTextEditor({
  value, onChange, onBlur, fontSize, fontWeight, textAlign, textColor, width, height,
  x = 8, y, freePlace = false,
}: InlineTextEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, fontSize * 1.4)}px`
  }, [fontSize])

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  const editorW = freePlace
    ? Math.max(56, Math.min(160, width * 0.55))
    : Math.max(24, width - 16)

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={handleInput}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); onBlur() }
        if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
          e.preventDefault(); onBlur()
        }
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className="nodrag nopan absolute resize-none outline-none border-none bg-transparent
        leading-snug overflow-hidden caret-blue-600 z-30"
      style={{
        ...(freePlace
          ? {
              left: x,
              top: y ?? height - fontSize * 1.6 - 4,
              transform: 'none',
              width: editorW,
              minHeight: fontSize * 1.35,
            }
          : {
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              width: editorW,
              minHeight: Math.max(fontSize * 1.4, height - 16),
            }),
        fontSize,
        fontWeight,
        textAlign: freePlace ? 'left' : textAlign,
        color: textColor,
        lineHeight: 1.35,
        padding: 0,
        margin: 0,
        background: 'transparent',
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
      } as CSSProperties}
    />
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const DEFAULT_W = 160
const DEFAULT_H = 100

function ShapeNode({ id, data, selected, width, height }: NodeProps<ShapeNodeType>) {
  // Deterministic handle visibility. `group-hover:` depends on an ancestor
  // carrying `group`, which is easy to break from outside this file.
  const [hovered, setHovered] = useState(false)
  const handlesVisible = hovered || !!selected
  const { updateNode } = useDiagramStore()
  const { getZoom } = useReactFlow()
  const [editing, setEditing] = useState(false)
  const labelDrag = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)
  const textNodeDrag = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    originX: number
    originY: number
  } | null>(null)

  const w = width  ?? DEFAULT_W
  const h = height ?? DEFAULT_H

  const fill         = (data.fill         as string)  ?? 'transparent'
  const fillOpacity  = (data.fillOpacity  as number)  ?? 1
  const stroke       = (data.stroke       as string)  ?? '#334155'
  const strokeWidth  = (data.strokeWidth  as number)  ?? 2
  const strokeStyle  = (data.strokeStyle  as string)  ?? 'solid'
  const opacity      = (data.opacity      as number)  ?? 100
  const cornerRadius = (data.cornerRadius as number)  ?? 8
  const label        = (data.label        as string)  ?? ''
  const shapeType    = data.shapeType

  const normalizedType =
    typeof shapeType === 'string' && shapeType.startsWith('arrow') ? 'arrow' : shapeType

  const linear = isLinear(normalizedType)
  const isText = normalizedType === 'text'
  const hasFreeLabel = !linear && !isText

  const fontSize     = (data.fontSize     as number)  ?? (isText ? 14 : 10)
  const fontWeight   = (data.fontWeight   as string)  ?? 'normal'
  const textAlign    = (data.textAlign    as 'left' | 'center' | 'right')
    ?? (isText ? 'left' : 'left')
  const textColor    = (data.textColor    as string)  ?? '#0f172a'
  const labelFontSize = hasFreeLabel ? Math.min(fontSize, 10) : fontSize
  const pad    = Math.max(14, strokeWidth * 4)
  const endpoints = data.start && data.end
    ? { start: data.start as ShapePoint, end: data.end as ShapePoint }
    : defaultEndpoints(w, h, pad)

  // Default label anchor: bottom area, slightly inset (user can drag anywhere)
  const defaultLabelX = Math.max(6, w * 0.35)
  const defaultLabelY = Math.max(6, h - labelFontSize * 1.6 - 6)
  const labelX = typeof data.textX === 'number' ? data.textX : defaultLabelX
  const labelY = typeof data.textY === 'number' ? data.textY : defaultLabelY

  const stopEdit = useCallback(() => {
    setEditing(false)
    if (!isText) return
    const text = String(
      (useDiagramStore.getState().nodes.find((n) => n.id === id)?.data as ShapeNodeData)?.label ?? ''
    )
    const lines = (text || ' ').split('\n')
    const maxLen = Math.max(...lines.map((l) => l.length), 1)
    const nextW = Math.max(36, Math.min(420, Math.ceil(maxLen * fontSize * 0.62) + 10))
    const nextH = Math.max(fontSize + 8, Math.ceil(lines.length * fontSize * 1.35) + 6)
    const { nodes: current, setNodes } = useDiagramStore.getState()
    setNodes(
      current.map((n) =>
        n.id === id
          ? { ...n, width: nextW, height: nextH, style: { ...n.style, width: nextW, height: nextH } }
          : n
      ) as typeof current
    )
  }, [id, isText, fontSize])

  const startEdit = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    // Seed a position on first edit so drag has an anchor
    if (hasFreeLabel && (typeof data.textX !== 'number' || typeof data.textY !== 'number')) {
      updateNode(id, { textX: defaultLabelX, textY: defaultLabelY } as Partial<ShapeNodeData>)
    }
    setEditing(true)
  }, [hasFreeLabel, data.textX, data.textY, id, updateNode, defaultLabelX, defaultLabelY])

  // Auto-enter edit after spawn (double-click canvas / text tool)
  useEffect(() => {
    if (!data.autoEdit) return
    setEditing(true)
    updateNode(id, { autoEdit: false } as Partial<ShapeNodeData>)
  }, [data.autoEdit, id, updateNode])

  useEffect(() => {
    if (!editing) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditing(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editing])

  const clampLabel = useCallback(
    (x: number, y: number) => ({
      x: Math.max(-20, Math.min(w - 24, x)),
      y: Math.max(-8, Math.min(h - 12, y)),
    }),
    [w, h]
  )

  const onLabelPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || editing) return
      e.stopPropagation()
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      labelDrag.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        originX: labelX,
        originY: labelY,
        moved: false,
      }
    },
    [editing, labelX, labelY]
  )

  const onLabelPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = labelDrag.current
      if (!drag || drag.pointerId !== e.pointerId) return
      e.stopPropagation()
      const zoom = getZoom() || 1
      const dx = (e.clientX - drag.startClientX) / zoom
      const dy = (e.clientY - drag.startClientY) / zoom
      if (Math.hypot(dx, dy) > 3) drag.moved = true
      const next = clampLabel(drag.originX + dx, drag.originY + dy)
      updateNode(id, { textX: next.x, textY: next.y } as Partial<ShapeNodeData>)
    },
    [clampLabel, getZoom, id, updateNode]
  )

  const onLabelPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = labelDrag.current
      if (!drag || drag.pointerId !== e.pointerId) return
      e.stopPropagation()
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch { /* already released */ }
      labelDrag.current = null
    },
    []
  )

  // Smooth text-node drag — same pointer feel as shape labels (no grid snap)
  const onTextNodePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isText || e.button !== 0 || editing) return
      e.stopPropagation()
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      const node = useDiagramStore.getState().nodes.find((n) => n.id === id)
      if (!node) return
      textNodeDrag.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        originX: node.position.x,
        originY: node.position.y,
      }
    },
    [editing, id, isText]
  )

  const onTextNodePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = textNodeDrag.current
      if (!drag || drag.pointerId !== e.pointerId) return
      e.stopPropagation()
      const zoom = getZoom() || 1
      const dx = (e.clientX - drag.startClientX) / zoom
      const dy = (e.clientY - drag.startClientY) / zoom
      const { nodes: current, setNodes } = useDiagramStore.getState()
      setNodes(
        current.map((n) =>
          n.id === id
            ? { ...n, position: { x: drag.originX + dx, y: drag.originY + dy } }
            : n
        ) as typeof current
      )
    },
    [getZoom, id]
  )

  const onTextNodePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = textNodeDrag.current
      if (!drag || drag.pointerId !== e.pointerId) return
      e.stopPropagation()
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch { /* already released */ }
      textNodeDrag.current = null
    },
    []
  )

  const midPoint = linear
    ? { x: (endpoints.start.x + endpoints.end.x) / 2, y: (endpoints.start.y + endpoints.end.y) / 2 }
    : null

  return (
    <div
      className={isText ? 'group nodrag nopan' : 'group'}
      style={{
        width: w, height: h,
        opacity: opacity / 100,
        position: 'relative',
        cursor: isText && !editing ? 'grab' : editing ? 'text' : undefined,
      }}
      onDoubleClick={startEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...(isText
        ? {
            onPointerDown: onTextNodePointerDown,
            onPointerMove: onTextNodePointerMove,
            onPointerUp: onTextNodePointerUp,
            onPointerCancel: onTextNodePointerUp,
          }
        : {})}
    >
      {selected && !linear && !isText && (
        <NodeResizer
          minWidth={80}
          minHeight={28}
          isVisible
          lineClassName="!border-blue-400/50"
          handleClassName="!bg-white !border-2 !border-blue-500 !rounded-full !w-2.5 !h-2.5 !shadow-sm"
        />
      )}

      {/*
        Connection points, four per side.

        The ids matter: React Flow cannot tell same-type handles apart without
        them, so eight unnamed handles all resolved to the first one and every
        edge left from the top no matter which dot you dragged.
      */}
      {!linear && !isText && (
        <>
          {(
            [
              [Position.Top, 't'],
              [Position.Right, 'r'],
              [Position.Bottom, 'b'],
              [Position.Left, 'l'],
            ] as const
          ).map(([position, hid]) => (
            <div key={hid}>
              <Handle
                type="target"
                id={`${hid}-in`}
                position={position}
                className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white !transition-opacity"
                style={{ opacity: handlesVisible ? 1 : 0, zIndex: 20 }}
              />
              <Handle
                type="source"
                id={hid}
                position={position}
                title="Drag to connect"
                className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white !transition-opacity"
                style={{ opacity: handlesVisible ? 1 : 0, zIndex: 21 }}
              />
            </div>
          ))}
        </>
      )}

      {linear && (
        <LinearStroke
          shapeType={normalizedType as 'line' | 'arrow'}
          start={endpoints.start} end={endpoints.end}
          stroke={stroke} strokeWidth={strokeWidth}
          strokeStyle={strokeStyle} selected={!!selected}
        />
      )}

      {!isText && !linear && (
        <ClosedShapeSVG
          shapeType={normalizedType}
          fill={fill} fillOpacity={editing ? Math.min(fillOpacity, 0.35) : fillOpacity}
          stroke={selected ? '#3B82F6' : stroke}
          strokeWidth={selected ? strokeWidth + 0.5 : strokeWidth}
          strokeStyle={strokeStyle}
          cornerRadius={cornerRadius}
          w={w} h={h} selected={false}
        />
      )}

      {/* Shape label editor — at free position */}
      {editing && hasFreeLabel && (
        <InlineTextEditor
          value={label}
          onChange={(v) => updateNode(id, { label: v } as Partial<ShapeNodeData>)}
          onBlur={stopEdit}
          fontSize={labelFontSize}
          fontWeight={fontWeight}
          textAlign="left"
          textColor={textColor}
          width={w}
          height={h}
          x={labelX}
          y={labelY}
          freePlace
        />
      )}

      {/* Standalone text — light editor like labels */}
      {editing && isText && (
        <InlineTextEditor
          value={label}
          onChange={(v) => updateNode(id, { label: v } as Partial<ShapeNodeData>)}
          onBlur={stopEdit}
          fontSize={fontSize}
          fontWeight={fontWeight}
          textAlign="left"
          textColor={textColor}
          width={w}
          height={h}
          x={2}
          y={2}
          freePlace
        />
      )}

      {/* Draggable shape label — drag to place anywhere; double-click to edit */}
      {!editing && hasFreeLabel && (label || selected) && (
        <div
          className="nodrag nopan absolute z-20 select-none"
          style={{
            left: labelX,
            top: labelY,
            maxWidth: Math.max(48, w * 0.7),
            fontSize: labelFontSize,
            fontWeight,
            textAlign: 'left',
            color: label ? textColor : '#94a3b8',
            lineHeight: 1.25,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            cursor: 'grab',
            padding: '1px 2px',
            borderRadius: 3,
            outline: selected ? '1px dashed rgba(59,130,246,0.45)' : undefined,
            background: selected && label ? 'rgba(255,255,255,0.72)' : undefined,
          }}
          onPointerDown={onLabelPointerDown}
          onPointerMove={onLabelPointerMove}
          onPointerUp={onLabelPointerUp}
          onPointerCancel={onLabelPointerUp}
          onDoubleClick={startEdit}
          title="Drag to move · Double-click to edit"
        >
          {label || 'Aa'}
        </div>
      )}

      {/* Standalone text display — same light look as shape labels */}
      {!editing && isText && (
        <div
          className="absolute inset-0 select-none"
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '2px 4px',
            fontSize,
            fontWeight,
            textAlign: 'left',
            color: label ? textColor : '#94a3b8',
            lineHeight: 1.3,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            borderRadius: 4,
            outline: selected ? '1px dashed rgba(59,130,246,0.5)' : '1px dashed transparent',
            background: selected ? 'rgba(255,255,255,0.75)' : 'transparent',
            pointerEvents: 'none',
          }}
        >
          {label || 'Type…'}
        </div>
      )}

      {/* Arrow / line: mid-stroke label ONLY (Excalidraw-style) */}
      {linear && midPoint && (
        <div
          className="nodrag nopan absolute z-20"
          style={{
            left: midPoint.x,
            top: midPoint.y,
            transform: 'translate(-50%, -130%)',
            pointerEvents: 'auto',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={startEdit}
        >
          {editing ? (
            <input
              autoFocus
              value={label}
              onChange={(e) => updateNode(id, { label: e.target.value } as Partial<ShapeNodeData>)}
              onBlur={stopEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); stopEdit() }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              placeholder="Label…"
              className="nodrag nopan outline-none rounded-lg px-2.5 py-1 text-center shadow-md bg-white border border-blue-300"
              style={{
                fontSize: Math.max(11, Math.min(fontSize, 13)),
                fontWeight, color: textColor,
                minWidth: 60, maxWidth: Math.max(80, w - 16),
              }}
            />
          ) : label ? (
            <span
              className="inline-block rounded-lg border border-slate-200 bg-white px-2.5 py-0.5 text-center shadow-sm cursor-text hover:border-blue-300 transition-colors"
              style={{
                fontSize: Math.max(11, Math.min(fontSize, 13)),
                fontWeight, color: textColor, lineHeight: 1.3,
              }}
            >
              {label}
            </span>
          ) : selected ? (
            <button
              type="button"
              className="inline-block rounded-lg border border-dashed border-blue-300 bg-white/95 px-2 py-0.5 text-[10px] text-blue-400 cursor-text select-none"
              onClick={(e) => startEdit(e)}
            >
              + label
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default memo(ShapeNode)
