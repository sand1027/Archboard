// Shared edge-style vocabulary for every LLD diagram type.

export type LldLineStyle = 'solid' | 'dashed' | 'dotted'

export type LldPathStyle = 'straight' | 'bezier' | 'step' | 'smoothstep'

/**
 * Notation glyphs.
 *
 * @xyflow/react's MarkerType only offers `Arrow` and `ArrowClosed`, which
 * cannot express UML hollow triangles, composition/aggregation diamonds or
 * crow's-foot cardinality. These are rendered from our own <marker> defs.
 */
export type LldMarkerId =
  | 'none'
  | 'arrow-open'
  | 'arrow-filled'
  | 'triangle-hollow'
  | 'diamond-filled'
  | 'diamond-hollow'
  | 'crowsfoot-one'
  | 'crowsfoot-zero-one'
  | 'crowsfoot-one-many'
  | 'crowsfoot-zero-many'
  | 'cross-destroy'
  | 'circle-plus'
  | 'port-provided'
  | 'port-required'

export interface LldEdgeStyle {
  line: LldLineStyle
  path: LldPathStyle
  startMarker: LldMarkerId
  endMarker: LldMarkerId
  stroke: string
  strokeWidth: number
}

/** SVG dash pattern for a line style, scaled to stroke width. */
export function dashArray(line: LldLineStyle, strokeWidth: number): string | undefined {
  if (line === 'dashed') return `${strokeWidth * 4},${strokeWidth * 2.5}`
  if (line === 'dotted') return `${strokeWidth},${strokeWidth * 2}`
  return undefined
}
