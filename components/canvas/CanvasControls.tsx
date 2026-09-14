'use client'

import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { Grid3x3, Magnet, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { useDiagramStore } from '@/store/diagramStore'

/**
 * Zoom, fit and grid, floating on the canvas.
 *
 * These lived in the top bar, which was trying to hold three unrelated things at once: what
 * the document is, how the canvas is being viewed, and what you can do to the diagram. Twenty
 * controls in one row does not fit a laptop screen at any sensible label size, and the bar
 * overflowed and clipped Export and the account menu off the right edge.
 *
 * View controls are the ones that do not belong up there — they change how you are looking at
 * the canvas, not the diagram — and putting them on the canvas is where every tool of this
 * kind puts them. Bottom-left, since the minimap owns bottom-right and the shapes toolbar
 * owns bottom-centre.
 */

export interface CanvasControlsProps {
  /**
   * Whether to offer the grid and snap toggles.
   *
   * The LLD canvas pins both on and always draws its background, so showing them there would
   * be two buttons that do nothing.
   */
  showGridToggles?: boolean
}

export default function CanvasControls({ showGridToggles = true }: CanvasControlsProps) {
  const reactFlow = useReactFlow()
  const snapToGrid = useDiagramStore((s) => s.snapToGrid)
  const setSnapToGrid = useDiagramStore((s) => s.setSnapToGrid)
  const showGrid = useDiagramStore((s) => s.showGrid)
  const setShowGrid = useDiagramStore((s) => s.setShowGrid)

  const zoomIn = useCallback(() => reactFlow.zoomIn({ duration: 200 }), [reactFlow])
  const zoomOut = useCallback(() => reactFlow.zoomOut({ duration: 200 }), [reactFlow])
  const fitView = useCallback(
    () => reactFlow.fitView({ padding: 0.1, duration: 400 }),
    [reactFlow]
  )

  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-gray-200 bg-white p-1 shadow-md">
      <ControlButton onClick={zoomOut} title="Zoom out" icon={<ZoomOut className="h-4 w-4" />} />
      <ControlButton onClick={zoomIn} title="Zoom in" icon={<ZoomIn className="h-4 w-4" />} />
      <ControlButton
        onClick={fitView}
        title="Fit to screen"
        icon={<Maximize2 className="h-4 w-4" />}
      />

      {showGridToggles && (
        <>
          <div className="mx-0.5 h-5 w-px bg-gray-200" />
          <ControlButton
            onClick={() => setShowGrid(!showGrid)}
            title={showGrid ? 'Hide grid' : 'Show grid'}
            active={showGrid}
            icon={<Grid3x3 className="h-4 w-4" />}
          />
          <ControlButton
            onClick={() => setSnapToGrid(!snapToGrid)}
            title={snapToGrid ? 'Disable snap' : 'Enable snap to grid'}
            active={snapToGrid}
            icon={<Magnet className="h-4 w-4" />}
          />
        </>
      )}
    </div>
  )
}

interface ControlButtonProps {
  onClick: () => void
  icon: React.ReactNode
  title: string
  active?: boolean
}

function ControlButton({ onClick, icon, title, active }: ControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={[
        'rounded-lg p-1.5 transition-colors',
        active
          ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      ].join(' ')}
    >
      {icon}
    </button>
  )
}
