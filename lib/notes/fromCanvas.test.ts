import { describe, it, expect } from 'vitest'
import type { ArchitectureEdge, ArchitectureNode } from '@/types/diagram'
import type { ArchitectureNodeData, FrameNodeData, ShapeNodeData } from '@/types/architecture'
import { describeSelection, imagesFromSelection } from './fromCanvas'

function component(id: string, label: string, componentId = 'server'): ArchitectureNode {
  return {
    id,
    type: 'architecture',
    position: { x: 0, y: 0 },
    data: { componentId, label, category: 'compute', icon: '/x.svg' } as ArchitectureNodeData,
  }
}

function edge(
  id: string,
  source: string,
  target: string,
  data: ArchitectureEdge['data'] = {}
): ArchitectureEdge {
  return { id, type: 'architecture', source, target, data }
}

const texts = (nodes: ArchitectureNode[], edges: ArchitectureEdge[], ids: string[]) =>
  describeSelection(nodes, edges, ids).map((b) => b.text)

describe('nothing selected', () => {
  it('returns no blocks', () => {
    expect(describeSelection([component('1', 'API')], [], [])).toEqual([])
  })

  it('returns no blocks when the ids match nothing', () => {
    expect(describeSelection([component('1', 'API')], [], ['gone'])).toEqual([])
  })
})

describe('one component', () => {
  const nodes = [component('1', 'API Server')]

  it('names it in the heading rather than counting it', () => {
    expect(texts(nodes, [], ['1'])[0]).toBe('API Server — from the diagram')
  })

  it('opens with a subheading and closes with a line to write on', () => {
    const blocks = describeSelection(nodes, [], ['1'])
    expect(blocks[0].type).toBe('subheading')
    expect(blocks.at(-1)).toEqual({ type: 'body', text: '' })
  })

  it('notes what kind of component it is', () => {
    expect(texts(nodes, [], ['1'])).toContain('API Server (server)')
  })
})

describe('several components', () => {
  const nodes = [
    component('1', 'API', 'server'),
    component('2', 'Cache', 'redis'),
    component('3', 'Orders', 'postgresql'),
  ]

  it('counts them in the heading', () => {
    expect(texts(nodes, [], ['1', '2', '3'])[0]).toBe('3 components from the diagram')
  })

  it('lists each one as a bullet', () => {
    const blocks = describeSelection(nodes, [], ['1', '2', '3'])
    const bullets = blocks.filter((b) => b.type === 'bullet').map((b) => b.text)
    expect(bullets).toEqual(['API (server)', 'Cache (redis)', 'Orders (postgresql)'])
  })

  it('includes only what was selected', () => {
    expect(texts(nodes, [], ['1'])).not.toContain('Cache (redis)')
  })
})

describe('connections', () => {
  const nodes = [component('1', 'API'), component('2', 'Orders', 'postgresql')]

  it('describes an edge between two selected components', () => {
    expect(texts(nodes, [edge('e1', '1', '2')], ['1', '2'])).toContain('API → Orders')
  })

  /** An arrow to something outside the selection would name a component the note never introduced. */
  it('omits an edge whose other end is not selected', () => {
    const withThird = [...nodes, component('3', 'Elsewhere')]
    const result = texts(withThird, [edge('e1', '1', '3')], ['1', '2'])
    expect(result.some((t) => t.includes('Elsewhere'))).toBe(false)
  })

  it('adds the protocol and label when there are any', () => {
    const result = texts(nodes, [edge('e1', '1', '2', { protocol: 'TCP', label: 'query' })], ['1', '2'])
    expect(result).toContain('API → Orders (TCP, query)')
  })

  /** A label that merely repeats the protocol is noise. */
  it('does not repeat a label identical to the protocol', () => {
    const result = texts(nodes, [edge('e1', '1', '2', { protocol: 'HTTPS', label: 'HTTPS' })], ['1', '2'])
    expect(result).toContain('API → Orders (HTTPS)')
  })

  it('ignores an empty label', () => {
    const result = texts(nodes, [edge('e1', '1', '2', { protocol: 'TCP', label: '' })], ['1', '2'])
    expect(result).toContain('API → Orders (TCP)')
  })
})

describe('other node types', () => {
  it('describes a frame as a group', () => {
    const frame: ArchitectureNode = {
      id: 'f1',
      type: 'frame',
      position: { x: 0, y: 0 },
      data: { label: 'Data Center', frameType: 'data-center' } as FrameNodeData,
    }
    expect(texts([frame], [], ['f1'])).toContain('Data Center (group)')
  })

  it('describes a shape by its shape type', () => {
    const shape: ArchitectureNode = {
      id: 's1',
      type: 'shape',
      position: { x: 0, y: 0 },
      data: { shapeType: 'note', label: 'Remember' } as ShapeNodeData,
    }
    expect(texts([shape], [], ['s1'])).toContain('Remember (note)')
  })

  /** An unnamed box should still read as something rather than as a blank bullet. */
  it('falls back to what it is when there is no label', () => {
    const unnamed = component('1', '', 'redis')
    expect(texts([unnamed], [], ['1'])).toContain('redis')
  })

  it('does not repeat the kind when it is already the label', () => {
    const bullets = describeSelection([component('1', 'redis', 'redis')], [], ['1'])
      .filter((b) => b.type === 'bullet')
      .map((b) => b.text)
    expect(bullets).toEqual(['redis'])
  })
})

describe('imagesFromSelection', () => {
  it('imports the icon of a selected component', () => {
    const nodes = [component('1', 'API')]
    expect(imagesFromSelection(nodes, ['1'])).toEqual([
      { type: 'image', text: 'API', src: '/x.svg' },
    ])
  })

  it('skips a component with no icon', () => {
    const bare: ArchitectureNode = {
      id: '1',
      type: 'architecture',
      position: { x: 0, y: 0 },
      data: {
        componentId: 'server',
        label: 'API',
        category: 'compute',
        icon: '',
      } as ArchitectureNodeData,
    }
    expect(imagesFromSelection([bare], ['1'])).toEqual([])
  })

  it('skips frames and shapes', () => {
    const shape: ArchitectureNode = {
      id: 's1',
      type: 'shape',
      position: { x: 0, y: 0 },
      data: { shapeType: 'note', label: 'Remember' } as ShapeNodeData,
    }
    expect(imagesFromSelection([shape], ['s1'])).toEqual([])
  })
})
