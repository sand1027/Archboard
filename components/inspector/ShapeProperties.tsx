'use client'

import { useCallback } from 'react'
import { Trash2, Copy } from 'lucide-react'
import { useDiagramStore } from '@/store/diagramStore'
import { useHistoryStore } from '@/store/historyStore'
import type { ShapeNodeData, StrokeStyle, FontWeight, TextAlign } from '@/types/architecture'
import type { Node } from '@xyflow/react'

type ShapeNodeFull = Node<ShapeNodeData, 'shape'>

const PRESET_FILLS = [
  'transparent','#ffffff','#F1F5F9','#EFF6FF','#F0FDF4',
  '#FEFCE8','#FFF1F2','#F5F3FF','#BFDBFE','#A7F3D0',
  '#FDE68A','#FECDD3','#C7D2FE','#3B82F6','#10B981',
  '#F59E0B','#EF4444','#8B5CF6','#1F2937','#000000',
]

const PRESET_STROKES = [
  '#374151','#9CA3AF','#3B82F6','#10B981','#F59E0B',
  '#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316','#000000','#ffffff',
]

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

  return (
    <div className="divide-y divide-slate-100 text-sm">

      {/* ── Shape header ── */}
      <div className="px-4 py-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
          <ShapeIcon type={d.shapeType} stroke={(d.stroke as string) ?? '#334155'} />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Shape</p>
          <p className="text-sm font-semibold text-slate-800 capitalize">
            {d.shapeType.replace(/-/g, ' ')}
          </p>
        </div>
      </div>

      {/* ── Text ── */}
      <Section title="Text">
        <input
          type="text"
          value={(d.label as string) ?? ''}
          onChange={(e) => set({ label: e.target.value })}
          placeholder="Double-click shape to type…"
          className="field-input"
        />
      </Section>

      {/* ── Fill ── */}
      {d.shapeType !== 'line' && d.shapeType !== 'arrow' && !String(d.shapeType).startsWith('arrow-') && (
      <Section title="Fill">
        <ColorSwatches
          presets={PRESET_FILLS}
          value={(d.fill as string) ?? '#ffffff'}
          onChange={(v) => set({ fill: v })}
        />
        <div className="flex items-center gap-2 mt-2">
          <label className="text-xs text-gray-400 w-16">Custom</label>
          <input
            type="color"
            value={(d.fill as string) === 'transparent' ? '#ffffff' : (d.fill as string) ?? '#ffffff'}
            onChange={(e) => set({ fill: e.target.value })}
            className="w-8 h-7 rounded cursor-pointer border border-gray-200"
          />
          <label className="text-xs text-gray-400 ml-2">Opacity</label>
          <input
            type="range" min={0} max={1} step={0.05}
            value={(d.fillOpacity as number) ?? 1}
            onChange={(e) => set({ fillOpacity: parseFloat(e.target.value) })}
            className="flex-1"
          />
          <span className="text-xs text-gray-500 w-8 text-right">
            {Math.round(((d.fillOpacity as number) ?? 1) * 100)}%
          </span>
        </div>
      </Section>
      )}

      {/* ── Stroke ── */}
      <Section title="Stroke">
        <ColorSwatches
          presets={PRESET_STROKES}
          value={(d.stroke as string) ?? '#374151'}
          onChange={(v) => set({ stroke: v })}
        />
        <div className="flex items-center gap-2 mt-2">
          <label className="text-xs text-gray-400 w-16">Custom</label>
          <input
            type="color"
            value={(d.stroke as string) ?? '#374151'}
            onChange={(e) => set({ stroke: e.target.value })}
            className="w-8 h-7 rounded cursor-pointer border border-gray-200"
          />
        </div>

        {/* Stroke width */}
        <div className="flex items-center gap-2 mt-2">
          <label className="text-xs text-gray-400 w-16">Width</label>
          <input
            type="range" min={0.5} max={12} step={0.5}
            value={(d.strokeWidth as number) ?? 1.5}
            onChange={(e) => set({ strokeWidth: parseFloat(e.target.value) })}
            className="flex-1"
          />
          <span className="text-xs text-gray-500 w-8 text-right">
            {(d.strokeWidth as number) ?? 1.5}px
          </span>
        </div>

        {/* Stroke style */}
        <div className="flex gap-1 mt-2">
          {(['solid','dashed','dotted'] as StrokeStyle[]).map((s) => (
            <button
              key={s}
              onClick={() => set({ strokeStyle: s })}
              className={[
                'flex-1 py-1.5 rounded-lg text-xs font-mono border transition-colors capitalize',
                (d.strokeStyle as string ?? 'solid') === s
                  ? 'bg-blue-50 border-blue-400 text-blue-700 font-semibold'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300',
              ].join(' ')}
            >
              {s === 'solid' ? '—' : s === 'dashed' ? '- -' : '···'}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Geometry ── */}
      {d.shapeType !== 'line' && d.shapeType !== 'text' && (
        <Section title="Geometry">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-20">Corner r.</label>
            <input
              type="range" min={0} max={80} step={1}
              value={(d.cornerRadius as number) ?? 0}
              onChange={(e) => set({ cornerRadius: parseInt(e.target.value) })}
              className="flex-1"
            />
            <span className="text-xs text-gray-500 w-8 text-right">
              {(d.cornerRadius as number) ?? 0}px
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <label className="text-xs text-gray-400 w-20">Opacity</label>
            <input
              type="range" min={0} max={100} step={1}
              value={(d.opacity as number) ?? 100}
              onChange={(e) => set({ opacity: parseInt(e.target.value) })}
              className="flex-1"
            />
            <span className="text-xs text-gray-500 w-8 text-right">
              {(d.opacity as number) ?? 100}%
            </span>
          </div>
        </Section>
      )}

      {/* ── Typography ── */}
      <Section title="Text">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-16">Size</label>
            <input
              type="range" min={8} max={72} step={1}
              value={(d.fontSize as number) ?? 14}
              onChange={(e) => set({ fontSize: parseInt(e.target.value) })}
              className="flex-1"
            />
            <span className="text-xs text-gray-500 w-8 text-right">
              {(d.fontSize as number) ?? 14}px
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 w-16">Colour</label>
            <input
              type="color"
              value={(d.textColor as string) ?? '#111827'}
              onChange={(e) => set({ textColor: e.target.value })}
              className="w-8 h-7 rounded cursor-pointer border border-gray-200"
            />
          </div>

          <div className="flex gap-1">
            {(['normal','semibold','bold'] as FontWeight[]).map((w) => (
              <button
                key={w}
                onClick={() => set({ fontWeight: w })}
                className={[
                  'flex-1 py-1.5 rounded-lg text-xs border transition-colors capitalize',
                  (d.fontWeight as string ?? 'normal') === w
                    ? 'bg-blue-50 border-blue-400 text-blue-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300',
                ].join(' ')}
                style={{ fontWeight: w === 'semibold' ? 600 : w }}
              >
                {w}
              </button>
            ))}
          </div>

          <div className="flex gap-1">
            {(['left','center','right'] as TextAlign[]).map((a) => (
              <button
                key={a}
                onClick={() => set({ textAlign: a })}
                className={[
                  'flex-1 py-1.5 rounded-lg text-xs border transition-colors capitalize',
                  (d.textAlign as string ?? 'center') === a
                    ? 'bg-blue-50 border-blue-400 text-blue-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300',
                ].join(' ')}
              >
                {a === 'left' ? '⇤' : a === 'center' ? '⇔' : '⇥'}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Actions ── */}
      <Section title="Actions">
        <div className="flex flex-col gap-2">
          <button
            onClick={handleDuplicate}
            className="w-full flex items-center gap-2 py-2 px-3 text-sm text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors"
          >
            <Copy className="w-4 h-4" /> Duplicate
          </button>
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2 py-2 px-3 text-sm text-red-600 bg-red-50 hover:bg-red-100/80 border border-red-200 rounded-xl transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </Section>
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 space-y-2">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  )
}

function ColorSwatches({ presets, value, onChange }: {
  presets: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {presets.map((c) => (
        <button
          key={c}
          title={c}
          onClick={() => onChange(c)}
          className="w-6 h-6 rounded-md border transition-all flex-shrink-0 hover:scale-105"
          style={{
            backgroundColor: c === 'transparent' ? 'transparent' : c,
            borderColor: value === c ? '#0F172A' : '#E2E8F0',
            outline: value === c ? '2px solid #CBD5E1' : 'none',
            backgroundImage:
              c === 'transparent'
                ? 'repeating-conic-gradient(#CBD5E1 0% 25%, white 0% 50%) 0 0 / 6px 6px'
                : undefined,
            boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px #E2E8F0' : undefined,
          }}
        />
      ))}
    </div>
  )
}

function ShapeIcon({ type, stroke }: { type: string; stroke: string }) {
  const s = { stroke, strokeWidth: 1.5, fill: 'none' }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      {type === 'rectangle'    && <rect x="3" y="5" width="18" height="14" rx="1" {...s} />}
      {type === 'ellipse'      && <ellipse cx="12" cy="12" rx="9" ry="7" {...s} />}
      {type === 'diamond'      && <polygon points="12,3 21,12 12,21 3,12" {...s} />}
      {type === 'triangle'     && <polygon points="12,3 21,20 3,20" {...s} />}
      {type === 'parallelogram'&& <polygon points="6,5 21,5 18,19 3,19" {...s} />}
      {type === 'cylinder'     && <><rect x="4" y="7" width="16" height="12" {...s}/><ellipse cx="12" cy="7" rx="8" ry="3" {...s}/></>}
      {type === 'hexagon'      && <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" {...s} />}
      {type === 'star'         && <polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" {...s} />}
      {type.startsWith('arrow')&& <><line x1="3" y1="12" x2="21" y2="12" {...s}/><polyline points="15,6 21,12 15,18" {...s}/></>}
      {type === 'line'         && <line x1="3" y1="12" x2="21" y2="12" {...s} />}
      {type === 'text'         && <text x="4" y="17" fontSize="14" fontWeight="bold" fill={stroke} stroke="none">T</text>}
    </svg>
  )
}
