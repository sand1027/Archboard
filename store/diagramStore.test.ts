import { describe, it, expect, beforeEach } from 'vitest'
import { useDiagramStore } from './diagramStore'
import type { ArchitectureNode } from '@/types/diagram'

/**
 * Exercises the exact sequence the inspector performs when someone types into a component
 * configuration field, so a loss in the store shows up here rather than only in the UI.
 */
function archNode(id: string): ArchitectureNode {
  return {
    id,
    type: 'architecture',
    position: { x: 0, y: 0 },
    data: {
      componentId: 'postgresql',
      label: 'Orders DB',
      category: 'databases',
      icon: '/x.svg',
    },
  } as ArchitectureNode
}

const nodeById = (id: string) => useDiagramStore.getState().nodes.find((n) => n.id === id)

describe('updateNode with a component config bag', () => {
  beforeEach(() => {
    useDiagramStore.setState({ nodes: [archNode('n1')], edges: [] })
  })

  it('stores a config value', () => {
    useDiagramStore.getState().updateNode('n1', { config: { connectionPool: 20 } })
    expect(nodeById('n1')?.data.config).toEqual({ connectionPool: 20 })
  })

  /**
   * The inspector rebuilds the bag from the current node on every keystroke, so typing a
   * second field must not drop the first.
   */
  it('accumulates fields typed one after another', () => {
    const { updateNode } = useDiagramStore.getState()

    updateNode('n1', { config: { connectionPool: 20 } })
    const afterFirst = nodeById('n1')!.data.config ?? {}

    updateNode('n1', { config: { ...afterFirst, engine: 'postgres' } })

    expect(nodeById('n1')?.data.config).toEqual({ connectionPool: 20, engine: 'postgres' })
  })

  it('keeps other data fields when config changes', () => {
    const { updateNode } = useDiagramStore.getState()
    updateNode('n1', { serviceMs: 25 })
    updateNode('n1', { config: { engine: 'postgres' } })

    expect(nodeById('n1')?.data).toMatchObject({
      label: 'Orders DB',
      serviceMs: 25,
      config: { engine: 'postgres' },
    })
  })

  it('keeps config when an unrelated field changes', () => {
    const { updateNode } = useDiagramStore.getState()
    updateNode('n1', { config: { engine: 'postgres' } })
    updateNode('n1', { label: 'Renamed' })

    expect(nodeById('n1')?.data.config).toEqual({ engine: 'postgres' })
  })

  /**
   * updateNode only writes `nodes`. If it left `boards` stale, switching HLD↔LLD and back
   * would restore an older snapshot and silently discard everything typed since.
   */
  it('survives a board switch and back', () => {
    const { updateNode, switchBoard } = useDiagramStore.getState()
    updateNode('n1', { config: { connectionPool: 20 } })

    switchBoard('lld')
    switchBoard('hld')

    expect(nodeById('n1')?.data.config).toEqual({ connectionPool: 20 })
  })
})
