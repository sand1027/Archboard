'use client'

import { useState } from 'react'
import {
  MousePointer2, Hand, Square, Circle, Diamond,
  Triangle, Type, Minus, ChevronDown,
  ArrowRight, Hexagon, Star, MoreHorizontal,
} from 'lucide-react'
import { useUiStore, type ActiveTool } from '@/store/uiStore'

const FILL_COLORS = [
  { label: 'Transparent', value: 'transparent' },
  { label: 'White', value: '#ffffff' },
  { label: 'Slate 50', value: '#F8FAFC' },
  { label: 'Blue 50', value: '#EFF6FF' },
  { label: 'Green 50', value: '#F0FDF4' },
  { label: 'Amber 50', value: '#FFFBEB' },
  { label: 'Rose 50', value: '#FFF1F2' },
  { label: 'Violet 50', value: '#F5F3FF' },
  { label: 'Sky', value: '#BAE6FD' },
  { label: 'Mint', value: '#A7F3D0' },
  { label: 'Sand', value: '#FDE68A' },
  { label: 'Blush', value: '#FECDD3' },
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Green', value: '#10B981' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Red', value: '#EF4444' },
  { label: 'Violet', value: '#8B5CF6' },
  { label: 'Slate', value: '#334155' },
  { label: 'Ink', value: '#0F172A' },
  { label: 'Black', value: '#000000' },
]

const STROKE_COLORS = [
  { label: 'Slate', value: '#334155' },
  { label: 'Gray', value: '#94A3B8' },
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Green', value: '#10B981' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Red', value: '#EF4444' },
  { label: 'Violet', value: '#8B5CF6' },
  { label: 'Teal', value: '#14B8A6' },
  { label: 'Orange', value: '#F97316' },
  { label: 'Pink', value: '#EC4899' },
  { label: 'Black', value: '#000000' },
  { label: 'White', value: '#ffffff' },
]

interface ToolDef {
  tool: ActiveTool
  icon: React.ReactNode
  label: string
  shortcut: string
}

const NAV_TOOLS: ToolDef[] = [
  { tool: 'select', icon: <MousePointer2 className="w-4 h-4" />, label: 'Select', shortcut: 'V' },
  { tool: 'hand', icon: <Hand className="w-4 h-4" />, label: 'Hand', shortcut: 'H' },
]

const PRIMARY_SHAPES: ToolDef[] = [
  { tool: 'rectangle', icon: <Square className="w-4 h-4" />, label: 'Rectangle', shortcut: 'R' },
  { tool: 'ellipse', icon: <Circle className="w-4 h-4" />, label: 'Ellipse', shortcut: 'O' },
  { tool: 'diamond', icon: <Diamond className="w-4 h-4" />, label: 'Diamond', shortcut: 'D' },
  { tool: 'triangle', icon: <Triangle className="w-4 h-4" />, label: 'Triangle', shortcut: 'T' },
  { tool: 'arrow', icon: <ArrowRight className="w-4 h-4" />, label: 'Arrow', shortcut: 'A' },
  { tool: 'line', icon: <Minus className="w-4 h-4" />, label: 'Line', shortcut: 'L' },
  { tool: 'text', icon: <Type className="w-4 h-4" />, label: 'Text', shortcut: 'X' },
]

const LLD_PRIMARY_SHAPES: ToolDef[] = [
  { tool: 'rectangle', icon: <Square className="w-4 h-4" />, label: 'Process', shortcut: 'R' },
  { tool: 'diamond', icon: <Diamond className="w-4 h-4" />, label: 'Decision', shortcut: 'D' },
  { tool: 'terminator', icon: <span className="text-[11px] font-semibold leading-none">⬭</span>, label: 'Start/End', shortcut: '' },
  { tool: 'parallelogram', icon: <span className="text-[12px] font-semibold leading-none">▱</span>, label: 'Data', shortcut: 'P' },
  { tool: 'document', icon: <span className="text-[11px] font-semibold leading-none">☰</span>, label: 'Document', shortcut: '' },
  { tool: 'arrow', icon: <ArrowRight className="w-4 h-4" />, label: 'Arrow', shortcut: 'A' },
  { tool: 'line', icon: <Minus className="w-4 h-4" />, label: 'Line', shortcut: 'L' },
  { tool: 'text', icon: <Type className="w-4 h-4" />, label: 'Text', shortcut: 'X' },
]

const MORE_SHAPES: ToolDef[] = [
  { tool: 'parallelogram', icon: <span className="text-[12px] font-semibold leading-none">▱</span>, label: 'Parallelogram', shortcut: 'P' },
  { tool: 'cylinder', icon: <span className="text-[12px] font-semibold leading-none">⌭</span>, label: 'Cylinder', shortcut: '' },
  { tool: 'hexagon', icon: <Hexagon className="w-4 h-4" />, label: 'Hexagon', shortcut: '' },
  { tool: 'star', icon: <Star className="w-4 h-4" />, label: 'Star', shortcut: '' },
]

const LLD_MORE_SHAPES: ToolDef[] = [
  { tool: 'preparation', icon: <Hexagon className="w-4 h-4" />, label: 'Preparation', shortcut: '' },
  { tool: 'connector', icon: <Circle className="w-4 h-4" />, label: 'Connector', shortcut: '' },
  { tool: 'note', icon: <span className="text-[11px] font-semibold leading-none">✎</span>, label: 'Note', shortcut: '' },
  { tool: 'ellipse', icon: <Circle className="w-4 h-4" />, label: 'Ellipse', shortcut: 'O' },
  { tool: 'cylinder', icon: <span className="text-[12px] font-semibold leading-none">⌭</span>, label: 'Cylinder', shortcut: '' },
  { tool: 'triangle', icon: <Triangle className="w-4 h-4" />, label: 'Triangle', shortcut: 'T' },
]

const STROKE_WIDTHS = [1, 1.5, 2, 3, 4, 6]
const STROKE_STYLES = [
  { value: 'solid' as const, title: 'Solid', preview: 'M2 8 H22' },
  { value: 'dashed' as const, title: 'Dashed', preview: 'M2 8 H22', dash: '4 3' },
  { value: 'dotted' as const, title: 'Dotted', preview: 'M2 8 H22', dash: '1.5 3' },
]

function Popover({ children, content }: { children: React.ReactNode; content: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <div onClick={() => setOpen((p) => !p)}>{children}</div>
      {open && (
        <div className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white border border-slate-200/80 rounded-xl shadow-xl shadow-slate-200/60 p-2.5 min-w-[188px]">
          {content}
        </div>
      )}
    </div>
  )
}

function ColorGrid({
  colors,
  selected,
  onSelect,
}: {
  colors: { value: string; label: string }[]
  selected: string
  onSelect: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {colors.map((c) => (
        <button
          key={c.value}
          title={c.label}
          onClick={() => onSelect(c.value)}
          className="w-7 h-7 rounded-md border transition-transform hover:scale-105"
          style={{
            backgroundColor: c.value === 'transparent' ? 'transparent' : c.value,
            borderColor: selected === c.value ? '#3B82F6' : '#E2E8F0',
            boxShadow:
              selected === c.value
                ? '0 0 0 2px #BFDBFE'
                : c.value === '#ffffff'
                  ? 'inset 0 0 0 1px #E2E8F0'
                  : undefined,
            backgroundImage:
              c.value === 'transparent'
                ? 'repeating-conic-gradient(#CBD5E1 0% 25%, white 0% 50%) 0 0 / 8px 8px'
                : undefined,
          }}
        />
      ))}
    </div>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-slate-200 mx-1 self-center" />
}

function ToolBtn({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={[
        'w-8 h-8 flex items-center justify-center rounded-lg transition-all',
        active
          ? 'bg-slate-900 text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export default function ShapesToolbar() {
  const {
    activeTool,
    setActiveTool,
    defaultFill,
    setDefaultFill,
    defaultStroke,
    setDefaultStroke,
    defaultStrokeWidth,
    setDefaultStrokeWidth,
    defaultStrokeStyle,
    setDefaultStrokeStyle,
    boardMode,
  } = useUiStore()

  const primary = boardMode === 'lld' ? LLD_PRIMARY_SHAPES : PRIMARY_SHAPES
  const more = boardMode === 'lld' ? LLD_MORE_SHAPES : MORE_SHAPES
  const isShapeTool = activeTool !== 'select' && activeTool !== 'hand'
  const moreActive = more.some((t) => t.tool === activeTool)

  return (
    <div
      className="flex items-center gap-0.5 px-2 py-1.5 bg-white/95 backdrop-blur-md
        rounded-2xl border border-slate-200/80 shadow-lg shadow-slate-200/50"
      style={{ userSelect: 'none' }}
    >
      {NAV_TOOLS.map((t) => (
        <ToolBtn
          key={t.tool}
          active={activeTool === t.tool}
          title={`${t.label} (${t.shortcut})`}
          onClick={() => setActiveTool(t.tool)}
        >
          {t.icon}
        </ToolBtn>
      ))}

      <Divider />

      {primary.map((t) => (
        <ToolBtn
          key={t.tool}
          active={activeTool === t.tool}
          title={`${t.label}${t.shortcut ? ` (${t.shortcut})` : ''}`}
          onClick={() => setActiveTool(t.tool)}
        >
          {t.icon}
        </ToolBtn>
      ))}

      <Popover
        content={
          <div className="grid grid-cols-2 gap-1 min-w-[160px]">
            {more.map((t) => (
              <button
                key={t.tool}
                onClick={() => setActiveTool(t.tool)}
                className={[
                  'flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors',
                  activeTool === t.tool
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100',
                ].join(' ')}
              >
                <span className="w-4 flex justify-center">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        }
      >
        <button
          title="More shapes"
          className={[
            'w-8 h-8 flex items-center justify-center rounded-lg transition-all',
            moreActive
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100',
          ].join(' ')}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </Popover>

      {isShapeTool && (
        <>
          <Divider />

          <Popover
            content={
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Fill
                </p>
                <ColorGrid colors={FILL_COLORS} selected={defaultFill} onSelect={setDefaultFill} />
              </div>
            }
          >
            <button
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              title="Fill"
            >
              <span
                className="w-4 h-4 rounded border border-slate-300"
                style={{
                  backgroundColor: defaultFill === 'transparent' ? 'transparent' : defaultFill,
                  backgroundImage:
                    defaultFill === 'transparent'
                      ? 'repeating-conic-gradient(#CBD5E1 0% 25%, white 0% 50%) 0 0 / 6px 6px'
                      : undefined,
                }}
              />
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          </Popover>

          <Popover
            content={
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Stroke
                </p>
                <ColorGrid
                  colors={STROKE_COLORS}
                  selected={defaultStroke}
                  onSelect={setDefaultStroke}
                />
              </div>
            }
          >
            <button
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              title="Stroke"
            >
              <span className="relative w-4 h-4 rounded border-2 border-slate-200 bg-white flex items-center justify-center">
                <span
                  className="absolute inset-[3px] rounded-sm border-2"
                  style={{ borderColor: defaultStroke }}
                />
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          </Popover>

          <Popover
            content={
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Width
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {STROKE_WIDTHS.map((width) => (
                    <button
                      key={width}
                      onClick={() => setDefaultStrokeWidth(width)}
                      className={[
                        'w-8 h-8 rounded-lg border flex items-center justify-center transition-colors',
                        defaultStrokeWidth === width
                          ? 'border-slate-900 bg-slate-50'
                          : 'border-slate-200 hover:border-slate-300',
                      ].join(' ')}
                      title={`${width}px`}
                    >
                      <span
                        className="block w-5 rounded-full"
                        style={{ height: Math.max(1, width), backgroundColor: defaultStroke }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            <button
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              title="Stroke width"
            >
              <span
                className="block w-5 rounded-full"
                style={{
                  height: Math.max(1.5, defaultStrokeWidth),
                  backgroundColor: defaultStroke,
                }}
              />
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          </Popover>

          <div className="flex items-center gap-0.5">
            {STROKE_STYLES.map((s) => (
              <button
                key={s.value}
                title={s.title}
                onClick={() => setDefaultStrokeStyle(s.value)}
                className={[
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                  defaultStrokeStyle === s.value
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-100',
                ].join(' ')}
              >
                <svg width="18" height="10" viewBox="0 0 24 16">
                  <path
                    d={s.preview}
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={s.dash}
                  />
                </svg>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
