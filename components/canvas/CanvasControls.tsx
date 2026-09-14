'use client'

import { useCallback } from 'react'
import { useReactFlow, useViewport } from '@xyflow/react'
import { Grid3x3, Magnet } from 'lucide-react'
import { useDiagramStore } from '@/store/diagramStore'

/**
 * How you are looking at the canvas — not how you draw on it.
 *
 * Lives with the minimap, not the shapes toolbar: two magnifying-glass buttons next to
 * Hand / Crop / Rectangle made one long crowded strip, especially with notes open. A
 * percent chip is the same control Figma uses; scroll and pinch still zoom.
 */

export interface CanvasControlsProps {
  showGridToggles?: boolean
}

export default function CanvasControls({ showGridToggles = true }: CanvasControlsProps) {
  const reactFlow = useReactFlow()
  const { zoom } = useViewport()
  const snapToGrid = useDiagramStore((s) => s.snapToGrid)
  const setSnapToGrid = useDiagramStore((s) => s.setSnapToGrid)
  const showGrid = useDiagramStore((s) => s.showGrid)
  const setShowGrid = useDiagramStore((s) => s.setShowGrid)

  const percent = Math.round(zoom * 100)
  const zoomIn = useCallback(() => reactFlow.zoomIn({ duration: 160 }), [reactFlow])
  const zoomOut = useCallback(() => reactFlow.zoomOut({ duration: 160 }), [reactFlow])
  const fitView = useCallback(
    () => reactFlow.fitView({ padding: 0.1, duration: 300 }),
    [reactFlow]
  )

  return (
    <div className="flex items-center gap-px rounded-lg border border-slate-200/80 bg-white/95 px-0.5 py-0.5 shadow-sm backdrop-blur-md">
      <button
        type="button"
        onClick={zoomOut}
        title="Zoom out"
        aria-label="Zoom out"
        className="flex h-6 w-6 items-center justify-center rounded-md text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      >
        −
      </button>
      <button
        type="button"
        onClick={fitView}
        title="Fit to screen"
        aria-label={`Zoom ${percent} percent. Click to fit.`}
        className="min-w-[2.35rem] rounded-md px-1 text-center text-[11px] font-medium tabular-nums text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      >
        {percent}%
      </button>
      <button
        type="button"
        onClick={zoomIn}
        title="Zoom in"
        aria-label="Zoom in"
        className="flex h-6 w-6 items-center justify-center rounded-md text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      >
        +
      </button>

      {showGridToggles && (
        <>
          <div className="mx-0.5 h-3.5 w-px bg-slate-200" />
          <TinyToggle
            onClick={() => setShowGrid(!showGrid)}
            title={showGrid ? 'Hide grid' : 'Show grid'}
            active={showGrid}
            icon={<Grid3x3 className="h-3 w-3" />}
          />
          <TinyToggle
            onClick={() => setSnapToGrid(!snapToGrid)}
            title={snapToGrid ? 'Disable snap' : 'Enable snap to grid'}
            active={snapToGrid}
            icon={<Magnet className="h-3 w-3" />}
          />
        </>
      )}
    </div>
  )
}

function TinyToggle({
  onClick,
  icon,
  title,
  active,
}: {
  onClick: () => void
  icon: React.ReactNode
  title: string
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={[
        'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
        active
          ? 'bg-blue-50 text-blue-600'
          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
      ].join(' ')}
    >
      {icon}
    </button>
  )
}
