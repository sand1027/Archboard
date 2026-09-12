'use client'

import type { LldMarkerId } from '@/types/lld'

/**
 * Custom SVG notation glyphs.
 *
 * @xyflow/react's MarkerType only provides `Arrow` and `ArrowClosed`, so UML
 * hollow triangles, composition/aggregation diamonds and ER crow's-foot
 * cardinality are impossible with the built-ins. These are our own <marker>
 * defs, referenced by url(#id) from BaseEdge.
 *
 * Two rules matter for correctness:
 *  - Hollow glyphs are filled #fff, never "none". With no fill the edge stroke
 *    shows straight through the interior of an inheritance triangle.
 *  - markerUnits="userSpaceOnUse", so glyph size stays constant instead of
 *    scaling with strokeWidth (UML notation does not scale).
 */

export interface MarkerGlyph {
  /** Square viewBox extent. */
  size: number
  /** Where the path meets the line end. */
  refX: number
  render: (color: string) => React.ReactNode
}

const SW = 1.4

export const MARKER_GLYPHS: Record<Exclude<LldMarkerId, 'none'>, MarkerGlyph> = {
  'arrow-open': {
    size: 12,
    refX: 11,
    render: (c) => (
      <path d="M 2,1 L 11,6 L 2,11" fill="none" stroke={c} strokeWidth={SW} strokeLinecap="round" />
    ),
  },
  'arrow-filled': {
    size: 12,
    refX: 11,
    render: (c) => <path d="M 1,1 L 11,6 L 1,11 z" fill={c} stroke={c} strokeWidth={0.6} />,
  },
  'triangle-hollow': {
    size: 14,
    refX: 13,
    render: (c) => <path d="M 1,1 L 13,7 L 1,13 z" fill="#ffffff" stroke={c} strokeWidth={SW} />,
  },
  'diamond-filled': {
    size: 16,
    refX: 15,
    render: (c) => <path d="M 1,7 L 8,1 L 15,7 L 8,13 z" fill={c} stroke={c} strokeWidth={1} />,
  },
  'diamond-hollow': {
    size: 16,
    refX: 15,
    render: (c) => (
      <path d="M 1,7 L 8,1 L 15,7 L 8,13 z" fill="#ffffff" stroke={c} strokeWidth={SW} />
    ),
  },
  // ER cardinality is composite: an optional "zero" ring plus either a
  // "one" tick or a "many" fork.
  'crowsfoot-one': {
    size: 14,
    refX: 13,
    render: (c) => <path d="M 7,1 L 7,13" fill="none" stroke={c} strokeWidth={SW} />,
  },
  'crowsfoot-zero-one': {
    size: 20,
    refX: 19,
    render: (c) => (
      <>
        <circle cx={5} cy={7} r={3.5} fill="#ffffff" stroke={c} strokeWidth={SW} />
        <path d="M 14,1 L 14,13" fill="none" stroke={c} strokeWidth={SW} />
      </>
    ),
  },
  'crowsfoot-one-many': {
    size: 20,
    refX: 19,
    render: (c) => (
      <>
        <path d="M 6,1 L 6,13" fill="none" stroke={c} strokeWidth={SW} />
        <path
          d="M 19,7 L 8,1 M 19,7 L 8,7 M 19,7 L 8,13"
          fill="none"
          stroke={c}
          strokeWidth={SW}
        />
      </>
    ),
  },
  'crowsfoot-zero-many': {
    size: 22,
    refX: 21,
    render: (c) => (
      <>
        <circle cx={4} cy={7} r={3.5} fill="#ffffff" stroke={c} strokeWidth={SW} />
        <path
          d="M 21,7 L 10,1 M 21,7 L 10,7 M 21,7 L 10,13"
          fill="none"
          stroke={c}
          strokeWidth={SW}
        />
      </>
    ),
  },
  // UML package containment: a circle enclosing a plus at the parent end.
  'circle-plus': {
    size: 16,
    refX: 15,
    render: (c) => (
      <>
        <circle cx={8} cy={8} r={6.5} fill="#ffffff" stroke={c} strokeWidth={SW} />
        <path d="M 8,3.5 V 12.5 M 3.5,8 H 12.5" stroke={c} strokeWidth={SW} />
      </>
    ),
  },
  'cross-destroy': {
    size: 14,
    refX: 7,
    render: (c) => (
      <path
        d="M 1,1 L 13,13 M 13,1 L 1,13"
        fill="none"
        stroke={c}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    ),
  },
  'port-provided': {
    size: 12,
    refX: 11,
    render: (c) => <circle cx={6} cy={6} r={4} fill={c} />,
  },
  'port-required': {
    size: 12,
    refX: 11,
    render: (c) => <path d="M 10,1 A 5 5 0 0 0 10,11" fill="none" stroke={c} strokeWidth={1.6} />,
  },
}

export const ALL_MARKER_IDS = Object.keys(MARKER_GLYPHS) as Array<Exclude<LldMarkerId, 'none'>>

/** DOM-safe deterministic id for a (glyph, colour) pair. */
export function markerDomId(id: Exclude<LldMarkerId, 'none'>, color: string): string {
  return `lld-${id}-${color.replace(/[^a-zA-Z0-9]/g, '')}`
}

/** `url(#…)` reference, or undefined for 'none' so the attribute is omitted. */
export function markerUrl(id: LldMarkerId, color: string): string | undefined {
  return id === 'none' ? undefined : `url(#${markerDomId(id, color)})`
}

export interface MarkerPair {
  id: Exclude<LldMarkerId, 'none'>
  color: string
}

/** Deduplicate a list of (glyph, colour) pairs by their DOM id. */
export function uniqueMarkerPairs(pairs: MarkerPair[]): MarkerPair[] {
  const seen = new Map<string, MarkerPair>()
  for (const p of pairs) {
    seen.set(markerDomId(p.id, p.color), p)
  }
  return [...seen.values()]
}

/**
 * Emits <defs> for exactly the pairs in use.
 *
 * Must render inside the React Flow subtree: PNG export captures
 * `.react-flow__renderer`, and defs outside it would leave exported images
 * with no arrowheads.
 */
export function LldMarkerDefs({ pairs }: { pairs: MarkerPair[] }) {
  return (
    <svg
      className="pointer-events-none absolute h-0 w-0 overflow-hidden"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {uniqueMarkerPairs(pairs).map(({ id, color }) => {
          const glyph = MARKER_GLYPHS[id]
          return (
            <marker
              key={markerDomId(id, color)}
              id={markerDomId(id, color)}
              viewBox={`0 0 ${glyph.size} ${glyph.size}`}
              markerWidth={glyph.size}
              markerHeight={glyph.size}
              refX={glyph.refX}
              refY={glyph.size / 2}
              // auto-start-reverse lets one definition serve both ends, so a
              // markerStart diamond points back along the line without a
              // mirrored duplicate def.
              orient="auto-start-reverse"
              markerUnits="userSpaceOnUse"
            >
              {glyph.render(color)}
            </marker>
          )
        })}
      </defs>
    </svg>
  )
}
