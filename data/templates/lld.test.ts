import { describe, it, expect } from 'vitest'
import { LLD_DIAGRAM_SPECS, edgeTypeForKind } from '@/lib/lld/specs'
import { buildLldTemplate, getLldTemplateById, lldTemplates } from './lld'

/**
 * These starters were broken twice over before this file existed: written to the wrong store,
 * and built from node types the LLD canvas has no renderer for. Both failures were silent —
 * the modal closed and the canvas stayed empty — so the tests below assert the two things
 * nobody could see: that content lands, and that it lands as shapes the canvas can draw.
 */

/** Every node type LldCanvas can render, taken from the same specs the canvas uses. */
const RENDERABLE_SHAPES = new Set(
  Object.values(LLD_DIAGRAM_SPECS).flatMap((spec) =>
    spec.paletteGroups.flatMap((group) =>
      group.entries.flatMap((entry) => ('spawn' in entry ? [entry.spawn.shape] : []))
    )
  )
)

describe('the catalogue', () => {
  it('is not empty', () => {
    expect(lldTemplates.length).toBeGreaterThan(0)
  })

  it('has unique ids', () => {
    const ids = lldTemplates.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('targets diagram types that exist', () => {
    for (const template of lldTemplates) {
      expect(LLD_DIAGRAM_SPECS[template.type]).toBeDefined()
    }
  })

  it('gives every template the copy the modal renders', () => {
    for (const template of lldTemplates) {
      expect(template.name).not.toBe('')
      expect(template.description).not.toBe('')
      expect(template.preview).not.toBe('')
    }
  })

  it('finds a template by id', () => {
    expect(getLldTemplateById('lld-order-class')?.type).toBe('class')
    expect(getLldTemplateById('nope')).toBeUndefined()
  })
})

describe('building', () => {
  it('produces a shape per seed', () => {
    for (const template of lldTemplates) {
      expect(buildLldTemplate(template).shapes).toHaveLength(template.shapes.length)
    }
  })

  it('produces an edge per seed', () => {
    for (const template of lldTemplates) {
      expect(buildLldTemplate(template).edges).toHaveLength(template.edges.length)
    }
  })

  /**
   * The second half of the original bug: the old templates used umlClass / umlEntity /
   * umlLifeline / shape, none of which appear in LldCanvas's nodeTypes map, so even routed to
   * the right store they would have rendered nothing.
   */
  it('only uses shapes the LLD canvas can render', () => {
    for (const template of lldTemplates) {
      for (const shape of buildLldTemplate(template).shapes) {
        expect(RENDERABLE_SHAPES.has(shape.type)).toBe(true)
      }
    }
  })

  it('gives every edge the React Flow type its kind maps to', () => {
    for (const template of lldTemplates) {
      for (const edge of buildLldTemplate(template).edges) {
        expect(edge.type).toBe(edgeTypeForKind(edge.data!.kind))
      }
    }
  })

  /** An edge pointing at a shape that was never built would render as a line to nowhere. */
  it('wires every edge to shapes in the same template', () => {
    for (const template of lldTemplates) {
      const { shapes, edges } = buildLldTemplate(template)
      const ids = new Set(shapes.map((s) => s.id))

      for (const edge of edges) {
        expect(ids.has(edge.source)).toBe(true)
        expect(ids.has(edge.target)).toBe(true)
      }
    }
  })

  it('gives everything an id, a position and a box', () => {
    for (const template of lldTemplates) {
      for (const shape of buildLldTemplate(template).shapes) {
        expect(shape.id).toBeTruthy()
        expect(Number.isFinite(shape.position.x)).toBe(true)
        expect(Number.isFinite(shape.position.y)).toBe(true)
        expect(shape.width).toBeGreaterThan(0)
        expect(shape.height).toBeGreaterThan(0)
      }
    }
  })

  /** Ids are minted per build, so loading the same starter twice must not collide. */
  it('mints fresh ids on every build', () => {
    const template = lldTemplates[0]
    const first = buildLldTemplate(template)
    const second = buildLldTemplate(template)

    const overlap = first.shapes
      .map((s) => s.id)
      .filter((id) => second.shapes.some((s) => s.id === id))
    expect(overlap).toEqual([])
  })

  it('keeps ids unique within one build', () => {
    for (const template of lldTemplates) {
      const { shapes, edges } = buildLldTemplate(template)
      const ids = [...shapes.map((s) => s.id), ...edges.map((e) => e.id)]
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('applies the data overrides a template asks for', () => {
    const built = buildLldTemplate(getLldTemplateById('lld-order-class')!)
    const user = built.shapes[0]
    expect(user.data.label).toBe('User')
    // Overrides merge, so the spawned defaults it did not mention survive.
    expect(user.data).toHaveProperty('stereotype', 'class')
    expect(Array.isArray(user.data.fields)).toBe(true)
  })

  it('positions shapes apart from each other', () => {
    for (const template of lldTemplates) {
      const positions = buildLldTemplate(template).shapes.map(
        (s) => `${s.position.x},${s.position.y}`
      )
      expect(new Set(positions).size).toBe(positions.length)
    }
  })
})

describe('per-diagram requirements', () => {
  /** Sequence edges are ordered on a shared time axis; a missing order stacks them. */
  it('gives sequence messages distinct orders', () => {
    for (const template of lldTemplates.filter((t) => t.type === 'sequence')) {
      const orders = buildLldTemplate(template).edges.map((e) => e.data?.order)
      expect(orders.every((o) => typeof o === 'number')).toBe(true)
      expect(new Set(orders).size).toBe(orders.length)
    }
  })

  /** ER relations need both cardinalities, or the crow's-foot markers cannot be chosen. */
  it('gives ER relations both cardinalities', () => {
    for (const template of lldTemplates.filter((t) => t.type === 'er')) {
      for (const edge of buildLldTemplate(template).edges) {
        expect(edge.data).toHaveProperty('sourceCardinality')
        expect(edge.data).toHaveProperty('targetCardinality')
      }
    }
  })

  it('starts a state machine at an initial state', () => {
    for (const template of lldTemplates.filter((t) => t.type === 'state')) {
      const kinds = buildLldTemplate(template).shapes.map((s) => s.data.stateKind)
      expect(kinds).toContain('initial')
    }
  })
})
