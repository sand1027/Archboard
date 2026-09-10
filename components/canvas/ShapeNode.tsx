'use client'

import { memo, useState, useRef, useCallback, useEffect, type CSSProperties } from 'react'
import { NodeResizer, useReactFlow, Handle, Position, type NodeProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import type { ShapeNodeData, ShapePoint } from '@/types/architecture'
import { useDiagramStore } from '@/store/diagramStore'

type ShapeNodeType = Node<ShapeNodeData, 'shape'>

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
    end: { x: w - pad, y: h / 2 },
  }
}

// ─── freehand line / arrow ────────────────────────────────────────────────────

function LinearStroke({
  shapeType,
  start,
  end,
  stroke,
  strokeWidth,
  strokeStyle,
  selected,
}: {
  shapeType: 'line' | 'arrow'
  start: ShapePoint
  end: ShapePoint
  stroke: string
  strokeWidth: number
  strokeStyle: string
  selected: boolean
}) {
  const color = stroke
  const sw = strokeWidth
  const dash = strokeDash(strokeStyle, sw)

  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len

  // Clean Excalidraw-ish arrowhead
  const headLen = Math.max(12, sw * 4.2)
  const headWidth = Math.max(9, sw * 3.2)
  const tipInset = shapeType === 'arrow' ? headLen * 0.72 : 0
  const lineEnd = { x: end.x - ux * tipInset, y: end.y - uy * tipInset }

  const px = -uy
  const py = ux
  const baseX = end.x - ux * headLen
  const baseY = end.y - uy * headLen
  const left = { x: baseX + px * headWidth * 0.5, y: baseY + py * headWidth * 0.5 }
  const right = { x: baseX - px * headWidth * 0.5, y: baseY - py * headWidth * 0.5 }

  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
    >
      {selected && (
        <line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke="#3B82F6"
          strokeWidth={sw + 6}
          strokeLinecap="round"
          opacity={0.18}
        />
      )}
      <line
        x1={start.x}
        y1={start.y}
        x2={lineEnd.x}
        y2={lineEnd.y}
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={dash}
      />
      {shapeType === 'arrow' && len > 6 && (
        <polygon
          points={`${end.x},${end.y} ${left.x},${left.y} ${right.x},${right.y}`}
          fill={color}
          stroke={color}
          strokeWidth={1}
          strokeLinejoin="round"
        />
      )}
      {selected && (
        <>
          <circle cx={start.x} cy={start.y} r={4} fill="#fff" stroke="#3B82F6" strokeWidth={1.5} />
          <circle cx={end.x} cy={end.y} r={4} fill="#fff" stroke="#3B82F6" strokeWidth={1.5} />
        </>
      )}
    </svg>
  )
}

// ─── closed shapes ────────────────────────────────────────────────────────────

function ClosedShapeSVG({
  shapeType,
  fill,
  fillOpacity,
  stroke,
  strokeWidth,
  strokeStyle,
  cornerRadius,
  w,
  h,
  selected,
}: {
  shapeType: ShapeNodeData['shapeType']
  fill: string
  fillOpacity: number
  stroke: string
  strokeWidth: number
  strokeStyle: string
  cornerRadius: number
  w: number
  h: number
  selected: boolean
}) {
  const sw = strokeWidth
  const dash = strokeDash(strokeStyle, sw)
  const fillColor = fill === 'transparent' ? 'none' : hexToRgba(fill, fillOpacity)
  const pad = sw / 2 + 0.5
  const iw = Math.max(0, w - pad * 2)
  const ih = Math.max(0, h - pad * 2)

  const shared = {
    fill: fillColor,
    stroke,
    strokeWidth: sw,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    ...(dash ? { strokeDasharray: dash } : {}),
  }

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
    >
      {selected && (
        <rect
          x={1}
          y={1}
          width={w - 2}
          height={h - 2}
          rx={Math.max(cornerRadius, 4)}
          fill="none"
          stroke="#3B82F6"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          opacity={0.85}
        />
      )}

      {shapeType === 'rectangle' && (
        <rect
          x={pad}
          y={pad}
          width={iw}
          height={ih}
          rx={Math.min(cornerRadius, iw / 2, ih / 2)}
          ry={Math.min(cornerRadius, iw / 2, ih / 2)}
          {...shared}
        />
      )}
      {shapeType === 'ellipse' && (
        <ellipse cx={w / 2} cy={h / 2} rx={iw / 2} ry={ih / 2} {...shared} />
      )}
      {shapeType === 'diamond' && (
        <polygon
          points={`${w / 2},${pad} ${w - pad},${h / 2} ${w / 2},${h - pad} ${pad},${h / 2}`}
          {...shared}
        />
      )}
      {shapeType === 'triangle' && (
        <polygon
          points={`${w / 2},${pad} ${w - pad},${h - pad} ${pad},${h - pad}`}
          {...shared}
        />
      )}
      {shapeType === 'parallelogram' && (() => {
        const skew = Math.min(iw * 0.2, iw * 0.35)
        return (
          <polygon
            points={[
              `${pad + skew},${pad}`,
              `${w - pad},${pad}`,
              `${w - pad - skew},${h - pad}`,
              `${pad},${h - pad}`,
            ].join(' ')}
            {...shared}
          />
        )
      })()}
      {shapeType === 'cylinder' && (() => {
        const ry = Math.min(Math.max(ih * 0.1, 8), 22)
        const top = pad + ry
        const bot = h - pad - ry
        return (
          <>
            <path
              d={`
                M ${pad} ${top}
                L ${pad} ${bot}
                A ${iw / 2} ${ry} 0 0 0 ${w - pad} ${bot}
                L ${w - pad} ${top}
                A ${iw / 2} ${ry} 0 0 0 ${pad} ${top}
                Z
              `}
              {...shared}
            />
            <ellipse cx={w / 2} cy={top} rx={iw / 2} ry={ry} {...shared} />
          </>
        )
      })()}
      {shapeType === 'hexagon' && (() => {
        const insetX = Math.min(iw * 0.2, iw / 2)
        return (
          <polygon
            points={[
              `${pad + insetX},${pad}`,
              `${w - pad - insetX},${pad}`,
              `${w - pad},${h / 2}`,
              `${w - pad - insetX},${h - pad}`,
              `${pad + insetX},${h - pad}`,
              `${pad},${h / 2}`,
            ].join(' ')}
            {...shared}
          />
        )
      })()}
      {shapeType === 'star' && <polygon points={starPoints(w, h, pad)} {...shared} />}
      {shapeType === 'terminator' && (
        <rect
          x={pad}
          y={pad}
          width={iw}
          height={ih}
          rx={Math.min(ih / 2, iw / 2)}
          ry={Math.min(ih / 2, iw / 2)}
          {...shared}
        />
      )}
      {shapeType === 'document' && (() => {
        const wave = Math.min(14, ih * 0.18)
        return (
          <path
            d={`
              M ${pad} ${pad}
              L ${w - pad} ${pad}
              L ${w - pad} ${h - pad - wave}
              Q ${w * 0.75} ${h - pad + wave * 0.6} ${w / 2} ${h - pad - wave * 0.2}
              Q ${w * 0.25} ${h - pad - wave} ${pad} ${h - pad - wave * 0.15}
              Z
            `}
            {...shared}
          />
        )
      })()}
      {shapeType === 'preparation' && (() => {
        const insetX = Math.min(iw * 0.18, 28)
        return (
          <polygon
            points={[
              `${pad + insetX},${pad}`,
              `${w - pad - insetX},${pad}`,
              `${w - pad},${h / 2}`,
              `${w - pad - insetX},${h - pad}`,
              `${pad + insetX},${h - pad}`,
              `${pad},${h / 2}`,
            ].join(' ')}
            {...shared}
          />
        )
      })()}
      {shapeType === 'connector' && (
        <ellipse cx={w / 2} cy={h / 2} rx={Math.min(iw, ih) / 2} ry={Math.min(iw, ih) / 2} {...shared} />
      )}
      {shapeType === 'note' && (() => {
        const fold = Math.min(18, Math.min(iw, ih) * 0.22)
        return (
          <>
            <path
              d={`
                M ${pad} ${pad}
                L ${w - pad - fold} ${pad}
                L ${w - pad} ${pad + fold}
                L ${w - pad} ${h - pad}
                L ${pad} ${h - pad}
                Z
              `}
              {...shared}
            />
            <path
              d={`
                M ${w - pad - fold} ${pad}
                L ${w - pad - fold} ${pad + fold}
                L ${w - pad} ${pad + fold}
              `}
              fill="none"
              stroke={stroke}
              strokeWidth={sw}
              strokeLinejoin="round"
            />
          </>
        )
      })()}
    </svg>
  )
}

function starPoints(w: number, h: number, pad: number) {
  const cx = w / 2
  const cy = h / 2
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

// ─── main ─────────────────────────────────────────────────────────────────────

const DEFAULT_W = 160
const DEFAULT_H = 100

function ShapeNode({
  id,
  data,
  selected,
  width,
  height,
  positionAbsoluteX,
  positionAbsoluteY,
}: NodeProps<ShapeNodeType>) {
  const { updateNode } = useDiagramStore()
  const { screenToFlowPosition } = useReactFlow()
  const [editing, setEditing] = useState(false)
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const w = width ?? DEFAULT_W
  const h = height ?? DEFAULT_H

  const fill = (data.fill as string) ?? 'transparent'
  const fillOpacity = (data.fillOpacity as number) ?? 1
  const stroke = (data.stroke as string) ?? '#334155'
  const strokeWidth = (data.strokeWidth as number) ?? 2
  const strokeStyle = (data.strokeStyle as string) ?? 'solid'
  const opacity = (data.opacity as number) ?? 100
  const cornerRadius = (data.cornerRadius as number) ?? 8
  const fontSize = (data.fontSize as number) ?? 14
  const fontWeight = (data.fontWeight as string) ?? 'normal'
  const textColor = (data.textColor as string) ?? '#0f172a'
  const label = (data.label as string) ?? ''
  const shapeType = data.shapeType
  const textX = typeof data.textX === 'number' ? data.textX : null
  const textY = typeof data.textY === 'number' ? data.textY : null

  const normalizedType =
    typeof shapeType === 'string' && shapeType.startsWith('arrow')
      ? 'arrow'
      : shapeType

  const linear = isLinear(normalizedType)
  const isText = normalizedType === 'text'
  const pad = Math.max(14, strokeWidth * 4)
  const endpoints =
    data.start && data.end
      ? { start: data.start, end: data.end }
      : defaultEndpoints(w, h, pad)

  const stopEdit = useCallback(() => {
    setEditing(false)
    setClickPos(null)
    textareaRef.current?.blur()
    inputRef.current?.blur()
  }, [])

  const startEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()

      if (linear) {
        setEditing(true)
        setTimeout(() => inputRef.current?.focus(), 0)
        return
      }

      const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      let x = flow.x - (positionAbsoluteX ?? 0)
      let y = flow.y - (positionAbsoluteY ?? 0)

      if (!Number.isFinite(positionAbsoluteX) || !Number.isFinite(positionAbsoluteY)) {
        const rect = rootRef.current?.getBoundingClientRect()
        if (rect && rect.width > 0 && rect.height > 0) {
          x = ((e.clientX - rect.left) / rect.width) * w
          y = ((e.clientY - rect.top) / rect.height) * h
        }
      }

      x = Math.max(2, Math.min(w - 2, x))
      y = Math.max(2, Math.min(h - 2, y))

      setClickPos({ x, y })
      updateNode(id, { textX: x, textY: y } as Partial<ShapeNodeData>)
      setEditing(true)
      setTimeout(() => textareaRef.current?.focus(), 0)
    },
    [screenToFlowPosition, positionAbsoluteX, positionAbsoluteY, w, h, linear, id, updateNode]
  )

  useEffect(() => {
    if (!editing) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') stopEdit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, stopEdit])

  const mid = linear
    ? {
        x: (endpoints.start.x + endpoints.end.x) / 2,
        y: (endpoints.start.y + endpoints.end.y) / 2,
      }
    : null

  const renderFillOpacity =
    !linear && !isText && editing ? Math.min(fillOpacity, 0.4) : fillOpacity

  const anchorX = linear && mid ? mid.x : (clickPos?.x ?? textX ?? w / 2)
  const anchorY = linear && mid ? mid.y : (clickPos?.y ?? textY ?? h / 2)
  const editorW = Math.max(48, Math.min(240, w - anchorX - 4))

  const textStyle: CSSProperties = {
    fontSize,
    fontWeight,
    textAlign: linear ? 'center' : 'left',
    color: textColor,
    lineHeight: 1.35,
  }

  return (
    <div
      ref={rootRef}
      className="group"
      style={{ width: w, height: h, opacity: opacity / 100, position: 'relative' }}
      onDoubleClick={startEdit}
    >
      {selected && !isText && !linear && (
        <NodeResizer
          minWidth={36}
          minHeight={28}
          isVisible
          lineClassName="!border-transparent"
          handleClassName="!bg-white !border-2 !border-blue-500 !rounded-full !w-2.5 !h-2.5 !shadow-sm"
        />
      )}

      {!linear && !isText && (
        <>
          <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5 !bg-slate-400 !border-white !opacity-0 group-hover:!opacity-100" />
          <Handle type="source" position={Position.Bottom} className="!w-1.5 !h-1.5 !bg-slate-400 !border-white !opacity-0 group-hover:!opacity-100" />
          <Handle type="target" position={Position.Left} id="left" className="!w-1.5 !h-1.5 !bg-slate-400 !border-white !opacity-0 group-hover:!opacity-100" />
          <Handle type="source" position={Position.Right} id="right" className="!w-1.5 !h-1.5 !bg-slate-400 !border-white !opacity-0 group-hover:!opacity-100" />
        </>
      )}

      {linear && (
        <LinearStroke
          shapeType={normalizedType as 'line' | 'arrow'}
          start={endpoints.start}
          end={endpoints.end}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeStyle={strokeStyle}
          selected={!!selected}
        />
      )}

      {!isText && !linear && (
        <ClosedShapeSVG
          shapeType={normalizedType}
          fill={fill}
          fillOpacity={renderFillOpacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeStyle={strokeStyle}
          cornerRadius={cornerRadius}
          w={w}
          h={h}
          selected={!!selected}
        />
      )}

      {isText && (
        <div
          style={{
            width: '100%',
            height: '100%',
            border: selected || editing ? '1.5px dashed #93C5FD' : '1.5px dashed transparent',
            borderRadius: 6,
            boxSizing: 'border-box',
          }}
        />
      )}

      {/* Mid-line / mid-arrow hanging label */}
      {linear && mid && (editing || !!label || selected) && (
        <div
          className="nodrag nopan absolute z-20"
          style={{
            left: mid.x,
            top: mid.y,
            transform: 'translate(-50%, -50%)',
            maxWidth: Math.max(72, Math.min(220, w - 16)),
            pointerEvents: 'auto',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={startEdit}
        >
          {editing ? (
            <input
              ref={inputRef}
              value={label}
              onChange={(e) => updateNode(id, { label: e.target.value } as Partial<ShapeNodeData>)}
              onBlur={stopEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  stopEdit()
                }
              }}
              autoFocus
              placeholder="Label…"
              className="nodrag nopan outline-none border border-blue-400 rounded-md px-2 py-0.5 text-center shadow-sm bg-white"
              style={{
                fontSize: Math.max(11, Math.min(fontSize, 13)),
                fontWeight,
                color: textColor,
                minWidth: 64,
                maxWidth: Math.max(72, Math.min(220, w - 16)),
              }}
            />
          ) : label ? (
            <span
              className="inline-block max-w-full truncate rounded-md border border-slate-200 bg-white px-2 py-0.5 text-center shadow-sm cursor-text"
              style={{
                fontSize: Math.max(11, Math.min(fontSize, 13)),
                fontWeight,
                color: textColor,
                lineHeight: 1.3,
              }}
              title="Double-click to edit"
            >
              {label}
            </span>
          ) : (
            <span
              className="inline-block rounded-md border border-dashed border-blue-300 bg-white/95 px-2 py-0.5 text-[10px] text-blue-400 cursor-text select-none"
              title="Double-click to add label"
              onClick={startEdit}
            >
              + label
            </span>
          )}
        </div>
      )}

      {/* Closed / text shape text at click point */}
      {!linear && (editing || !!label) && (
        <div
          className="nodrag nopan absolute z-20"
          style={{
            left: anchorX,
            top: anchorY,
            transform: 'translate(0, -0.15em)',
            width: editorW,
            pointerEvents: editing ? 'auto' : 'none',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {editing ? (
            <textarea
              ref={textareaRef}
              value={label}
              onChange={(e) => updateNode(id, { label: e.target.value } as Partial<ShapeNodeData>)}
              onBlur={stopEdit}
              rows={1}
              autoFocus
              className="nodrag nopan w-full resize-none bg-transparent outline-none border-none p-0 m-0 caret-blue-600"
              style={
                {
                  ...textStyle,
                  overflow: 'hidden',
                  minHeight: fontSize * 1.35,
                  height: fontSize * 1.35,
                  fieldSizing: 'content',
                } as CSSProperties
              }
            />
          ) : (
            <div className="whitespace-pre-wrap" style={{ ...textStyle, wordBreak: 'break-word' }}>
              {label}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(ShapeNode)
