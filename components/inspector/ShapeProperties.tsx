'use client'

import { useCallback } from 'react'
import { Trash2, Copy, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { useDiagramStore } from '@/store/diagramStore'
import { useHistoryStore } from '@/store/historyStore'
import type { ShapeNodeData, StrokeStyle, FontWeight, TextAlign } from '@/types/architecture'
import type { Node } from '@xyflow/react'

type ShapeNodeFull = Node<ShapeNodeData, 'shape'>

// ─── Colour palette ────────────────────────────────────────────────────────────
// Matches Excalidraw's default palette

const FILL_COLORS = [
  { v: 'transparent',  check: 'dark' },
  { v: '#ffffff',      check: 'dark' },
  { v: '#f8f9fa',      check: 'dark' },
  { v: '#ffc9c9',      check: 'dark' },
  { v: '#ffa94d',      check: 'dark' },
  { v: '#ffec99',      check: 'dark' },
  { v: '#b2f2bb',      check: 'dark' },
  { v: '#a5d8ff',      check: 'dark' },
  { v: '#d0bfff',      check: 'dark' },
  { v: '#e599f7',      check: 'dark' },
  { v: '#ffa8a8',      check: 'dark' },
  { v: '#e64980',      check: 'light' },
  { v: '#f03e3e',      check: 'light' },
  { v: '#e67700',      check: 'light' },
  { v: '#2f9e44',      check: 'light' },
  { v: '#1971c2',      check: 'light' },
  { v: '#7048e8',      check: 'light' },
  { v: '#495057',      check: 'light' },
  { v: '#212529',      check: 'light' },
  { v: '#000000',      check: 'light' },
]

const STROKE_COLORS = [
  { v: '#000000' }, { v: '#343a40' }, { v: '#495057' }, { v: '#868e96' },
  { v: '#1971c2' }, { v: '#2f9e44' }, { v: '#e67700' }, { v: '#e64980' },
  { v: '#7048e8' }, { v: '#f03e3e' }, { v: '#ffffff' }, { v: '#ced4da' },
]

const STROKE_WIDTHS = [
  { v: 1,   label: 'S' },
  { v: 2,   label: 'M' },
  { v: 4,   label: 'L' },
  { v: 8,   label: 'XL' },
]

const STROKE_STYLES: { v: StrokeStyle; dash?: string; label: string }[] = [
  { v: 'solid',  label: '—' },
  { v: 'dashed', dash: '6,4', label: '- -' },
  { v: 'dotted', dash: '2,3', label: '···' },
]

const FONT_SIZES = [10, 12, 14, 16, 20, 24, 32, 40]

export default function ShapeProperties({ node }: { node: ShapeNodeFull }) {
  const { updateNode, deleteNode, duplicateNodes } = useDiagramStore()
  const { pushSnapshot } = useHistoryStore()
  const d = node.data

  const set = useCallback(
    (patch: Partial<ShapeNodeData>) => updateNode(node.id, patch as any),
    [node.id, updateNode]
  )

  const handleDelete = () => {
    const { nodes: n, edges: e } = useDiagramStore.getState()
    pushSnapshot({ nodes: n, edges: e })
    deleteNode(node.id)
  }

  const handleDuplicate = () => {
    const { nodes: n, edges: e } = useDiagramStore.getState()
    pushSnapshot({ nodes: n, edges: e })
    duplicateNodes([node.id])
  }

  const isLine = String(d.shapeType).startsWith('line') || String(d.shapeType).startsWith('arrow')
  const isText = d.shapeType === 'text'

  return (
    <div className="flex flex-col divide-y divide-slate-100">

      {/* ── Stroke colour ── */}
      {!isText && (
      <PropRow label="Stroke">
        <SwatchGrid
          colors={STROKE_COLORS.map((c) => c.v)}
          value={(d.stroke as string) ?? '#000000'}
          onSelect={(v) => set({ stroke: v })}
          cols={6}
        />
        <div className="flex items-center gap-1.5 mt-2">
          <label className="text-[10px] text-slate-400 w-10">Custom</label>
          <ColorInput
            value={(d.stroke as string) ?? '#000000'}
            onChange={(v) => set({ stroke: v })}
          />
        </div>
      </PropRow>
      )}

      {/* ── Fill colour — not for lines / text ── */}
      {!isLine && !isText && (
        <PropRow label="Fill">
          <SwatchGrid
            colors={FILL_COLORS.map((c) => c.v)}
            value={(d.fill as string) ?? 'transparent'}
            onSelect={(v) => set({ fill: v })}
            cols={5}
            showTransparent
          />
          <div className="flex items-center gap-1.5 mt-2">
            <label className="text-[10px] text-slate-400 w-10">Custom</label>
            <ColorInput
              value={(d.fill as string) === 'transparent' ? '#ffffff' : ((d.fill as string) ?? '#ffffff')}
              onChange={(v) => set({ fill: v })}
            />
            <label className="text-[10px] text-slate-400 ml-1">Opacity</label>
            <input type="range" min={0} max={1} step={0.05}
              value={(d.fillOpacity as number) ?? 1}
              onChange={(e) => set({ fillOpacity: parseFloat(e.target.value) })}
              className="flex-1 h-1.5 accent-slate-900"
            />
            <span className="text-[10px] text-slate-500 w-6 text-right tabular-nums">
              {Math.round(((d.fillOpacity as number) ?? 1) * 100)}%
            </span>
          </div>
        </PropRow>
      )}

      {/* ── Stroke width ── */}
      {!isText && (
      <PropRow label="Width">
        <div className="flex gap-1">
          {STROKE_WIDTHS.map(({ v, label }) => (
            <button key={v} onClick={() => set({ strokeWidth: v })}
              className={[
                'flex-1 py-1.5 rounded-lg border text-[11px] font-medium transition-colors',
                (d.strokeWidth as number ?? 2) === v
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'border-slate-200 text-slate-600 hover:border-slate-400',
              ].join(' ')}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 mt-1.5">
          {STROKE_STYLES.map(({ v, dash, label }) => (
            <button key={v} onClick={() => set({ strokeStyle: v })}
              title={v}
              className={[
                'flex-1 py-1.5 rounded-lg border flex items-center justify-center transition-colors',
                (d.strokeStyle as string ?? 'solid') === v
                  ? 'bg-slate-900 border-slate-900'
                  : 'border-slate-200 hover:border-slate-400',
              ].join(' ')}>
              <svg width="22" height="8" viewBox="0 0 22 8">
                <line x1="1" y1="4" x2="21" y2="4"
                  stroke={(d.strokeStyle as string ?? 'solid') === v ? '#fff' : '#475569'}
                  strokeWidth="2" strokeLinecap="round" strokeDasharray={dash} />
              </svg>
            </button>
          ))}
        </div>
      </PropRow>
      )}

      {/* ── Corner radius — rectangles only ── */}
      {d.shapeType === 'rectangle' && (
        <PropRow label="Corners">
          <div className="flex items-center gap-2">
            <input type="range" min={0} max={60} step={1}
              value={(d.cornerRadius as number) ?? 0}
              onChange={(e) => set({ cornerRadius: parseInt(e.target.value) })}
              className="flex-1 h-1.5 accent-slate-900"
            />
            <span className="text-[10px] text-slate-500 w-6 text-right tabular-nums">
              {(d.cornerRadius as number) ?? 0}
            </span>
          </div>
        </PropRow>
      )}

      {/* ── Opacity ── */}
      <PropRow label="Opacity">
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={100} step={1}
            value={(d.opacity as number) ?? 100}
            onChange={(e) => set({ opacity: parseInt(e.target.value) })}
            className="flex-1 h-1.5 accent-slate-900"
          />
          <span className="text-[10px] text-slate-500 w-8 text-right tabular-nums">
            {(d.opacity as number) ?? 100}%
          </span>
        </div>
      </PropRow>

      {/* ── Label (synced with canvas; not a separate draggable text object) ── */}
      <PropRow label={isLine ? 'Arrow label' : isText ? 'Text' : 'Label'}>
        {isLine || isText ? (
          <input
            type="text"
            value={(d.label as string) ?? ''}
            onChange={(e) => set({ label: e.target.value })}
            placeholder={isLine ? 'Mid-arrow label…' : 'Type here…'}
            className="field-input text-sm"
          />
        ) : (
          <textarea
            value={(d.label as string) ?? ''}
            onChange={(e) => set({ label: e.target.value })}
            placeholder="Double-click the shape to type…"
            rows={3}
            className="field-input text-sm resize-none"
          />
        )}
        <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
          {isLine
            ? 'Double-click the arrow to edit the hanging label.'
            : isText
              ? 'Double-click empty canvas or use the Text tool to place text.'
              : 'Drag the label to place it · Double-click to edit.'}
        </p>
      </PropRow>

      {/* ── Font ── */}
      <PropRow label="Font">
        <div className="space-y-2">
          {/* Size */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-slate-400 w-8">Size</label>
            <div className="flex flex-wrap gap-1 flex-1">
              {FONT_SIZES.map((s) => (
                <button key={s} onClick={() => set({ fontSize: s })}
                  className={[
                    'w-8 h-7 rounded-lg border text-[10px] font-medium tabular-nums transition-colors',
                    (d.fontSize as number ?? 14) === s
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'border-slate-200 text-slate-600 hover:border-slate-400',
                  ].join(' ')}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Weight */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-slate-400 w-8">Style</label>
            <div className="flex gap-1 flex-1">
              {([
                { v: 'normal',   display: 'A' },
                { v: 'semibold', display: 'A', fw: 600 },
                { v: 'bold',     display: 'A', fw: 700 },
              ] as { v: FontWeight; display: string; fw?: number }[]).map(({ v, display, fw }) => (
                <button key={v} onClick={() => set({ fontWeight: v })}
                  style={{ fontWeight: fw ?? 400 }}
                  className={[
                    'flex-1 py-1.5 rounded-lg border text-sm transition-colors',
                    (d.fontWeight as string ?? 'normal') === v
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'border-slate-200 text-slate-600 hover:border-slate-400',
                  ].join(' ')}>
                  {display}
                </button>
              ))}
            </div>
          </div>

          {/* Align */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-slate-400 w-8">Align</label>
            <div className="flex gap-1 flex-1">
              {([
                { v: 'left',   icon: <AlignLeft   className="w-3.5 h-3.5" /> },
                { v: 'center', icon: <AlignCenter className="w-3.5 h-3.5" /> },
                { v: 'right',  icon: <AlignRight  className="w-3.5 h-3.5" /> },
              ] as { v: TextAlign; icon: React.ReactNode }[]).map(({ v, icon }) => (
                <button key={v} onClick={() => set({ textAlign: v })}
                  className={[
                    'flex-1 py-1.5 rounded-lg border flex items-center justify-center transition-colors',
                    (d.textAlign as string ?? 'center') === v
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'border-slate-200 text-slate-600 hover:border-slate-400',
                  ].join(' ')}>
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Text colour */}
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-slate-400 w-8">Color</label>
            <ColorInput
              value={(d.textColor as string) ?? '#0f172a'}
              onChange={(v) => set({ textColor: v })}
            />
          </div>
        </div>
      </PropRow>

      {/* ── Actions ── */}
      <PropRow label="">
        <div className="flex gap-2">
          <button onClick={handleDuplicate}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors">
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>
          <button onClick={handleDelete}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100/80 border border-red-200 rounded-xl transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </PropRow>
    </div>
  )
}

// ─── sub-components ───────────────────────────────────────────────────────────

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 space-y-2">
      {label && (
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      )}
      {children}
    </div>
  )
}

function SwatchGrid({
  colors, value, onSelect, cols = 5, showTransparent = false,
}: {
  colors: string[]
  value: string
  onSelect: (v: string) => void
  cols?: number
  showTransparent?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => {
        const isTransparent = c === 'transparent'
        const active = value === c
        return (
          <button key={c} title={c} onClick={() => onSelect(c)}
            className="w-6 h-6 rounded-md border transition-all hover:scale-110 flex-shrink-0"
            style={{
              backgroundColor: isTransparent ? 'transparent' : c,
              borderColor: active ? '#0F172A' : '#E2E8F0',
              boxShadow: active
                ? '0 0 0 2px #CBD5E1'
                : c === '#ffffff' ? 'inset 0 0 0 1px #E2E8F0' : undefined,
              backgroundImage: isTransparent
                ? 'repeating-conic-gradient(#CBD5E1 0% 25%, white 0% 50%) 0 0 / 6px 6px'
                : undefined,
            }}
          />
        )
      })}
    </div>
  )
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative w-7 h-7 rounded-lg overflow-hidden border border-slate-200 cursor-pointer flex-shrink-0">
        <div className="absolute inset-0" style={{ backgroundColor: value }} />
        <input type="color" value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </div>
      <input
        type="text"
        value={value.toUpperCase()}
        onChange={(e) => {
          const v = e.target.value
          if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v)
        }}
        onBlur={(e) => {
          if (!/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) onChange(value)
        }}
        className="flex-1 min-w-0 px-2 py-1 text-[11px] font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 text-slate-800 bg-white"
        maxLength={7}
      />
    </div>
  )
}
