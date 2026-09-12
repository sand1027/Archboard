import { describe, it, expect } from 'vitest'
import { NOTATION, cardinalityMarker, cardinalityLabel, EDGE_KIND_LABEL } from './notation'
import { MARKER_GLYPHS, markerDomId, markerUrl, uniqueMarkerPairs } from './markers'
import { dashArray, type LldEdgeKind, type ErCardinality } from '@/types/lld'

const CLASS_KINDS: LldEdgeKind[] = [
  'inheritance',
  'realization',
  'composition',
  'aggregation',
  'association',
  'dependency',
]

describe('NOTATION', () => {
  it('references only markers that actually exist', () => {
    for (const [kind, style] of Object.entries(NOTATION)) {
      for (const marker of [style.startMarker, style.endMarker]) {
        if (marker === 'none') continue
        expect(MARKER_GLYPHS, `${kind} → ${marker}`).toHaveProperty(marker)
      }
    }
  })

  it('gives every edge kind a label', () => {
    for (const kind of Object.keys(NOTATION) as LldEdgeKind[]) {
      expect(EDGE_KIND_LABEL[kind]).toBeTruthy()
    }
  })

  // This is the machine-readable form of "not a single generic arrow reused
  // everywhere" — the six UML class relations must be visually distinguishable.
  it('renders the six class relations distinctly', () => {
    const signatures = CLASS_KINDS.map((k) => {
      const s = NOTATION[k]
      return `${s.line}|${s.startMarker}|${s.endMarker}`
    })
    expect(new Set(signatures).size).toBe(CLASS_KINDS.length)
  })

  it('distinguishes inheritance from realization only by line style', () => {
    expect(NOTATION.inheritance.endMarker).toBe('triangle-hollow')
    expect(NOTATION.realization.endMarker).toBe('triangle-hollow')
    expect(NOTATION.inheritance.line).toBe('solid')
    expect(NOTATION.realization.line).toBe('dashed')
  })

  it('puts composition/aggregation diamonds at the owner end', () => {
    expect(NOTATION.composition.startMarker).toBe('diamond-filled')
    expect(NOTATION.aggregation.startMarker).toBe('diamond-hollow')
    expect(NOTATION.composition.endMarker).toBe('none')
    expect(NOTATION.aggregation.endMarker).toBe('none')
  })

  it('draws sequence messages as straight lines', () => {
    for (const k of ['msg-sync', 'msg-async', 'msg-return'] as LldEdgeKind[]) {
      expect(NOTATION[k].path).toBe('straight')
    }
  })
})

describe('markers', () => {
  it('produces DOM-safe ids', () => {
    for (const id of Object.keys(MARKER_GLYPHS) as Array<keyof typeof MARKER_GLYPHS>) {
      const dom = markerDomId(id, '#334155')
      expect(dom).toMatch(/^[A-Za-z][A-Za-z0-9-]*$/)
    }
  })

  it('separates ids by colour so two colours cannot collide', () => {
    expect(markerDomId('arrow-open', '#334155')).not.toBe(markerDomId('arrow-open', '#3B82F6'))
  })

  it('omits the attribute for "none"', () => {
    expect(markerUrl('none', '#000')).toBeUndefined()
    expect(markerUrl('arrow-open', '#000')).toBe('url(#lld-arrow-open-000)')
  })

  it('deduplicates pairs by DOM id', () => {
    const pairs = uniqueMarkerPairs([
      { id: 'arrow-open', color: '#334155' },
      { id: 'arrow-open', color: '#334155' },
      { id: 'arrow-open', color: '#3B82F6' },
    ])
    expect(pairs).toHaveLength(2)
  })

  it('keeps hollow glyph interiors opaque so the line cannot show through', () => {
    // Regression guard: fill="none" here would let the edge stroke render
    // inside an inheritance triangle or aggregation diamond.
    for (const id of ['triangle-hollow', 'diamond-hollow'] as const) {
      const json = JSON.stringify(MARKER_GLYPHS[id].render('#334155'))
      expect(json).toContain('#ffffff')
    }
  })

  it('anchors refX at the glyph tip for directional markers', () => {
    for (const id of ['arrow-open', 'arrow-filled', 'triangle-hollow'] as const) {
      const g = MARKER_GLYPHS[id]
      expect(g.refX).toBeGreaterThanOrEqual(g.size - 1)
    }
  })
})

describe('ER cardinality', () => {
  const all: ErCardinality[] = ['one', 'zero-or-one', 'one-or-many', 'zero-or-many']

  it('maps each cardinality to a distinct glyph', () => {
    const markers = all.map(cardinalityMarker)
    expect(new Set(markers).size).toBe(all.length)
  })

  it('offers UML multiplicity text as the alternate notation', () => {
    expect(all.map(cardinalityLabel)).toEqual(['1', '0..1', '1..*', '0..*'])
  })
})

describe('dashArray', () => {
  it('returns undefined for solid so the attribute is omitted', () => {
    expect(dashArray('solid', 1.5)).toBeUndefined()
  })

  it('scales the pattern with stroke width', () => {
    expect(dashArray('dashed', 1)).not.toBe(dashArray('dashed', 2))
  })

  it('makes dotted denser than dashed', () => {
    const dashOn = Number(dashArray('dashed', 2)!.split(',')[0])
    const dotOn = Number(dashArray('dotted', 2)!.split(',')[0])
    expect(dotOn).toBeLessThan(dashOn)
  })
})
