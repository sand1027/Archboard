'use client'

import { MARKER_GLYPHS } from '@/lib/canvas/markers'
import { dashArray, type LldEdgeStyle, type LldMarkerId } from '@/types/lld'

/**
 * Draws a connector preset as the line it actually produces.
 *
 * Takes a resolved style rather than an edge kind so both boards can use it:
 * LLD passes NOTATION[kind], HLD passes HLD_NOTATION[connectionType]. The legend
 * reads from the same table the canvas renders from, so it cannot drift from
 * what gets drawn.
 */
export function ConnectorPreview({
  style,
  width = 56,
  height = 20,
}: {
  style: LldEdgeStyle
  width?: number
  height?: number
}) {
  const y = height / 2
  const startPad = markerPad(style.startMarker)
  const endPad = markerPad(style.endMarker)

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <line
        x1={startPad}
        y1={y}
        x2={width - endPad}
        y2={y}
        stroke={style.stroke}
        strokeWidth={style.strokeWidth}
        strokeDasharray={dashArray(style.line, style.strokeWidth)}
      />
      {style.startMarker !== 'none' && (
        <Glyph id={style.startMarker} x={startPad} y={y} color={style.stroke} flip />
      )}
      {style.endMarker !== 'none' && (
        <Glyph id={style.endMarker} x={width - endPad} y={y} color={style.stroke} />
      )}
    </svg>
  )
}

/** Leave room for the glyph so the line does not poke through it. */
function markerPad(id: LldMarkerId): number {
  return id === 'none' ? 1 : MARKER_GLYPHS[id].size * 0.75
}

function Glyph({
  id,
  x,
  y,
  color,
  flip,
}: {
  id: Exclude<LldMarkerId, 'none'>
  x: number
  y: number
  color: string
  flip?: boolean
}) {
  const glyph = MARKER_GLYPHS[id]
  const scale = 0.85
  // Translate so the glyph's refX lands on the line end, mirroring how the SVG
  // <marker> itself is anchored on the canvas.
  const tx = x - glyph.refX * scale * (flip ? -1 : 1)
  const ty = y - (glyph.size / 2) * scale

  return (
    <g transform={`translate(${tx} ${ty}) scale(${scale * (flip ? -1 : 1)} ${scale})`}>
      {glyph.render(color)}
    </g>
  )
}
