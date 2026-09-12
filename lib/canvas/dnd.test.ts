import { describe, it, expect } from 'vitest'
import { DND_MIME, readDragPayload, setDragPayload } from './dnd'
import { spawnShape } from '@/lib/lld/spawnShape'
import { findPaletteShape, paletteShapesFor } from '@/lib/lld/specs'
import { LLD_DIAGRAM_TYPES } from '@/types/lld'

/**
 * Minimal DataTransfer stand-in — jsdom is not needed to exercise the payload
 * contract, only a get/set store keyed by MIME type.
 */
function fakeDragEvent() {
  const store = new Map<string, string>()
  return {
    dataTransfer: {
      effectAllowed: '',
      dropEffect: '',
      setData: (mime: string, value: string) => store.set(mime, value),
      getData: (mime: string) => store.get(mime) ?? '',
    },
  } as unknown as React.DragEvent
}

describe('drag payload contract', () => {
  it('round-trips an id through the LLD shape channel', () => {
    const e = fakeDragEvent()
    setDragPayload(e, DND_MIME.lldShape, 'cls-class')
    expect(readDragPayload(e, DND_MIME.lldShape)).toBe('cls-class')
  })

  it('sets copy as the allowed effect, matching the HLD palette', () => {
    const e = fakeDragEvent()
    setDragPayload(e, DND_MIME.lldShape, 'cls-class')
    expect(e.dataTransfer.effectAllowed).toBe('copy')
  })

  it('keeps the three channels isolated so a payload cannot cross over', () => {
    const e = fakeDragEvent()
    setDragPayload(e, DND_MIME.lldShape, 'cls-class')
    expect(readDragPayload(e, DND_MIME.hldComponent)).toBeNull()
    expect(readDragPayload(e, DND_MIME.lldCatalog)).toBeNull()
  })
})

describe('palette → drop → shape', () => {
  // The full path a drop takes: dragged id resolves to a palette item, which
  // spawns a shape. A missing arm here is exactly the "drag does nothing" bug.
  it.each(LLD_DIAGRAM_TYPES)('every %s palette item spawns a shape', (type) => {
    const items = paletteShapesFor(type)
    expect(items.length).toBeGreaterThan(0)

    for (const item of items) {
      const e = fakeDragEvent()
      setDragPayload(e, DND_MIME.lldShape, item.id)
      const droppedId = readDragPayload(e, DND_MIME.lldShape)
      expect(droppedId, item.id).toBe(item.id)

      const resolved = findPaletteShape(type, droppedId!)
      expect(resolved, `${type}/${item.id} not resolvable`).toBeDefined()

      const shape = spawnShape(resolved!.spawn, { x: 500, y: 300 })
      expect(shape.type, item.id).toBe(item.spawn.shape)
      expect(shape.id).toBeTruthy()
      expect(Number.isFinite(shape.width)).toBe(true)
      expect(Number.isFinite(shape.height)).toBe(true)
    }
  })

  it('centres a dropped shape on the cursor', () => {
    const shape = spawnShape({ shape: 'lldClass', stereotype: 'class' }, { x: 500, y: 300 })
    expect(shape.position.x + shape.width! / 2).toBe(500)
    expect(shape.position.y + shape.height! / 2).toBe(300)
  })

  it('hangs a lifeline downward from the drop point instead of centring it', () => {
    const shape = spawnShape(
      { shape: 'lldLifeline', lifelineKind: 'participant' },
      { x: 500, y: 80 }
    )
    expect(shape.position.x + shape.width! / 2).toBe(500)
    expect(shape.position.y).toBe(80)
  })

  it('gives palette ids a per-type namespace so recents cannot collide', () => {
    const seen = new Map<string, string>()
    for (const type of LLD_DIAGRAM_TYPES) {
      for (const item of paletteShapesFor(type)) {
        const prior = seen.get(item.id)
        expect(prior, `${item.id} appears in both ${prior} and ${type}`).toBeUndefined()
        seen.set(item.id, type)
      }
    }
  })
})
