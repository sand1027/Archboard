import { describe, it, expect } from 'vitest'
import type { ArchitectureEdge, ArchitectureNode } from '@/types/diagram'
import type { ArchitectureNodeData, FrameNodeData, ShapeNodeData } from '@/types/architecture'
import { DEFAULT_WORKLOAD } from '@/lib/estimate/workload'
import { compileSource } from './compile'
import { print } from './print'

/** A positioned component node, as the canvas would hold it. */
function node(
  id: string,
  data: Partial<ArchitectureNodeData> & { componentId: string; label: string },
  position = { x: 0, y: 0 }
): ArchitectureNode {
  return {
    id,
    type: 'architecture',
    position,
    width: 72,
    height: 88,
    style: { width: 72, height: 88 },
    data: { category: 'compute', icon: '/x.svg', ...data } as ArchitectureNodeData,
  }
}

function frame(
  id: string,
  data: FrameNodeData,
  position: { x: number; y: number },
  size: { width: number; height: number }
): ArchitectureNode {
  return {
    id,
    type: 'frame',
    position,
    width: size.width,
    height: size.height,
    style: size,
    data,
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

/** An LLD node, which has no HLD text form and so must be reported rather than guessed at. */
function umlNode(id: string): ArchitectureNode {
  return {
    id,
    type: 'umlClass',
    position: { x: 0, y: 0 },
    data: { name: 'Order', attributes: [], methods: [] },
  }
}

const textOf = (nodes: ArchitectureNode[], edges: ArchitectureEdge[] = []) =>
  print({ nodes, edges }).text.trim()

/** Compile text, print it back, compile again — the results must agree. */
function roundTrip(source: string) {
  const first = compileSource(source)
  expect(first.diagnostics).toEqual([])

  const printed = print(
    { nodes: first.nodes, edges: first.edges },
    { name: first.name, workload: first.workload, hierarchy: first.hierarchy }
  )
  const second = compileSource(printed.text)

  return { first, second, text: printed.text, skipped: printed.skipped }
}

describe('components', () => {
  it('prints type and a derived name', () => {
    expect(textOf([node('1', { componentId: 'load-balancer', label: 'Load Balancer' })])).toBe(
      'load-balancer load-balancer'
    )
  })

  /** The registry name is the default, so repeating it would be noise. */
  it('omits a label that matches the registry name', () => {
    expect(textOf([node('1', { componentId: 'postgresql', label: 'PostgreSQL' })])).toBe(
      'postgresql postgresql'
    )
  })

  it('prints a label that differs', () => {
    expect(textOf([node('1', { componentId: 'server', label: 'Orders API' })])).toBe(
      'server orders-api "Orders API"'
    )
  })

  it('derives a readable name from the label', () => {
    expect(textOf([node('1', { componentId: 'server', label: 'API Server #2' })])).toContain(
      'api-server-2'
    )
  })

  it('makes duplicate names unique', () => {
    const text = textOf([
      node('1', { componentId: 'server', label: 'Worker' }),
      node('2', { componentId: 'server', label: 'Worker' }),
    ])
    expect(text).toContain('server worker ')
    expect(text).toContain('server worker-2 ')
  })

  it('prints a short block inline and a long one across lines', () => {
    const short = textOf([node('1', { componentId: 'server', label: 'API', instances: 3 })])
    expect(short).toBe('server api "API" { instances 3 }')

    const long = textOf([
      node('1', {
        componentId: 'server',
        label: 'API',
        instances: 3,
        vcpu: 4,
        memoryGb: 8,
        serviceMs: 25,
        concurrency: 64,
      }),
    ])
    expect(long.split('\n')).toHaveLength(7)
  })

  /** Absent sizing means "derive it", so printing a value there would change the meaning. */
  it('prints nothing for unset sizing', () => {
    expect(textOf([node('1', { componentId: 'server', label: 'API' })])).toBe('server api "API"')
  })

  /**
   * An instance type sets vCPU and RAM. Printing them alongside would pin them and stop
   * the type driving them on the next compile.
   */
  it('prints an instance type instead of the vCPU and RAM it implies', () => {
    const text = textOf([
      node('1', {
        componentId: 'server',
        label: 'API',
        vcpu: 2,
        memoryGb: 8,
        config: { instanceType: 'm5.large' },
      }),
    ])
    expect(text).toBe('server api "API" { type m5.large }')
  })

  it('prints config values, with flags bare', () => {
    const text = textOf([
      node('1', {
        componentId: 'postgresql',
        label: 'DB',
        category: 'databases',
        config: { connectionPool: 20, engine: 'postgres', multiAz: true },
      }),
    ])
    expect(text).toContain('connectionPool 20')
    expect(text).toContain('engine postgres')
    expect(text).toContain('multiAz')
    expect(text).not.toContain('multiAz true')
  })

  it('quotes a config value that would not lex as one word', () => {
    const text = textOf([
      node('1', { componentId: 'server', label: 'API', config: { region: 'us east 1' } }),
    ])
    expect(text).toContain('region "us east 1"')
  })
})

describe('groups', () => {
  const dc = frame('f1', { label: 'Data Center', frameType: 'data-center' }, { x: 0, y: 0 }, { width: 400, height: 300 })
  const api = node('1', { componentId: 'server', label: 'API' }, { x: 50, y: 50 })
  const db = node('2', { componentId: 'postgresql', label: 'DB', category: 'databases' }, { x: 200, y: 50 })

  it('prints a frame as a group with its members nested', () => {
    const text = textOf([dc, api, db])
    expect(text).toBe(
      ['group data-center "Data Center" : data-center {', '  server api "API"', '  postgresql db "DB"', '}'].join('\n')
    )
  })

  it('omits a frame type of custom', () => {
    const plain = frame('f1', { label: 'Client', frameType: 'custom' }, { x: 0, y: 0 }, { width: 200, height: 200 })
    expect(textOf([plain, node('1', { componentId: 'server', label: 'API' }, { x: 20, y: 20 })])).toContain(
      'group client "Client" {'
    )
  })

  it('prints an empty frame', () => {
    expect(textOf([frame('f1', { label: 'Empty', frameType: 'custom' }, { x: 0, y: 0 }, { width: 100, height: 100 })])).toBe(
      'group empty "Empty" {}'
    )
  })

  /**
   * Containment is not stored — it is recovered with the same geometric rule group-drag
   * and the simulation use, so what looks inside the box prints inside the group.
   */
  it('recovers membership from geometry', () => {
    const outside = node('3', { componentId: 'redis', label: 'Cache', category: 'caching' }, { x: 900, y: 900 })
    const text = textOf([dc, api, outside])
    expect(text).toContain('  server api "API"')
    expect(text).toMatch(/^redis cache "Cache"$/m)
  })

  it('nests, with the smallest enclosing frame winning', () => {
    const outer = frame('f1', { label: 'DC', frameType: 'data-center' }, { x: 0, y: 0 }, { width: 600, height: 400 })
    const inner = frame('f2', { label: 'Services', frameType: 'cluster' }, { x: 40, y: 40 }, { width: 200, height: 200 })
    const inside = node('1', { componentId: 'server', label: 'API' }, { x: 60, y: 60 })

    const lines = textOf([outer, inner, inside]).split('\n')
    expect(lines[0]).toBe('group dc "DC" : data-center {')
    expect(lines[1]).toBe('  group services "Services" : cluster {')
    expect(lines[2]).toBe('    server api "API"')
  })

  /** A compiled diagram has no geometry yet, so the caller's hierarchy has to win. */
  it('uses an explicit hierarchy over geometry', () => {
    const flat = [
      frame('f1', { label: 'DC', frameType: 'custom' }, { x: 0, y: 0 }, { width: 10, height: 10 }),
      node('1', { componentId: 'server', label: 'API' }, { x: 999, y: 999 }),
    ]
    const result = print({ nodes: flat, edges: [] }, { hierarchy: { '1': 'f1' } })
    expect(result.text.trim()).toBe(['group dc "DC" {', '  server api "API"', '}'].join('\n'))
  })
})

describe('connections', () => {
  const api = node('1', { componentId: 'server', label: 'API' })
  const db = node('2', { componentId: 'postgresql', label: 'DB', category: 'databases' })
  const mq = node('3', { componentId: 'kafka', label: 'MQ', category: 'messaging' })

  it('prints an arrow between the two names', () => {
    expect(textOf([api, db], [edge('e1', '1', '2')])).toContain('api -> db')
  })

  it('uses the async arrow for an asynchronous edge', () => {
    expect(textOf([api, mq], [edge('e1', '1', '3', { connectionType: 'asynchronous' })])).toContain(
      'api ~> mq'
    )
  })

  it('uses the bidirectional arrow', () => {
    expect(textOf([api, db], [edge('e1', '1', '2', { connectionType: 'bidirectional' })])).toContain(
      'api <-> db'
    )
  })

  /** The arrow spells out three of the seven types; the rest have to be said. */
  it('prints a connection type the arrow cannot express', () => {
    expect(textOf([api, db], [edge('e1', '1', '2', { connectionType: 'replication' })])).toContain(
      '{ type replication }'
    )
  })

  it('prints a protocol and label that differ from what would be inferred', () => {
    const text = textOf([api, db], [edge('e1', '1', '2', { protocol: 'gRPC', label: 'lookup' })])
    expect(text).toContain('api -> db : gRPC "lookup"')
  })

  /** The point of the short form: nothing is printed that the compiler can work out. */
  it('omits a protocol and label that inference would recover', () => {
    const compiled = compileSource('server api "API"\npostgresql db "DB"\napi -> db')
    const printed = print({ nodes: compiled.nodes, edges: compiled.edges })
    expect(printed.text.trim().split('\n').at(-1)).toBe('api -> db')
  })

  it('prints a label with no colon when the protocol is the default', () => {
    const inferredProtocol = compileSource('server api "API"\npostgresql db "DB"\napi -> db')
      .edges[0].data?.protocol
    const text = textOf([api, db], [edge('e1', '1', '2', { protocol: inferredProtocol, label: 'note' })])
    expect(text).toContain('api -> db "note"')
  })

  it('prints a line style and extra annotations', () => {
    const text = textOf([
      api, db,
    ], [edge('e1', '1', '2', { edgeLineStyle: 'step', metadata: { timeout: 2000, retries: 3 } })])
    expect(text).toContain('style step')
    expect(text).toContain('timeout 2000')
    expect(text).toContain('retries 3')
  })
})

describe('workload', () => {
  it('prints every input in readable units', () => {
    const text = print({ nodes: [], edges: [] }, { workload: DEFAULT_WORKLOAD }).text
    expect(text).toContain('dau 100M')
    expect(text).toContain('perUser 10')
    expect(text).toContain('peak 3x')
    expect(text).toContain('reads 9:1')
    expect(text).toContain('cache 80%')
    expect(text).toContain('retention 365d')
    expect(text).toContain('replicas 3')
  })

  it('omits the block when there is no workload', () => {
    expect(print({ nodes: [], edges: [] }).text).not.toContain('workload')
  })
})

describe('the diagram wrapper', () => {
  it('wraps and indents when a name is given', () => {
    const text = print(
      { nodes: [node('1', { componentId: 'server', label: 'API' })], edges: [] },
      { name: 'Photos' }
    ).text
    expect(text).toContain('diagram "Photos" {')
    expect(text).toContain('  server api "API"')
    expect(text.trim().endsWith('}')).toBe(true)
  })

  it('escapes a quote in a name or label', () => {
    const text = print({ nodes: [], edges: [] }, { name: 'The "Big" One' }).text
    expect(text).toContain('diagram "The \\"Big\\" One"')
  })
})

describe('reported names', () => {
  /**
   * Generating code from an existing canvas must not rearrange it, which means carrying every
   * current position over as a pin — and that needs to know which declaration became which
   * node, not a guess based on ordering.
   */
  it('reports the DSL name given to each node id', () => {
    const nodes = [
      node('n1', { componentId: 'server', label: 'API Server' }),
      node('n2', { componentId: 'postgresql', label: 'Orders', category: 'databases' }),
    ]
    expect(print({ nodes, edges: [] }).names).toEqual({ n1: 'api-server', n2: 'orders' })
  })

  it('reports the deduplicated name, not the base', () => {
    const nodes = [
      node('n1', { componentId: 'server', label: 'Worker' }),
      node('n2', { componentId: 'server', label: 'Worker' }),
    ]
    expect(print({ nodes, edges: [] }).names).toEqual({ n1: 'worker', n2: 'worker-2' })
  })

  it('names frames too, so a frame can be pinned', () => {
    const nodes = [
      frame('f1', { label: 'Data Center', frameType: 'custom' }, { x: 0, y: 0 }, { width: 300, height: 200 }),
    ]
    expect(print({ nodes, edges: [] }).names.f1).toBe('data-center')
  })

  it('omits nodes with no text form', () => {
    expect(print({ nodes: [umlNode('u1')], edges: [] }).names).toEqual({})
  })

  /** Reused so the author's own names survive a round trip instead of being re-derived. */
  it('prefers a name the node already carries', () => {
    const carried = node('n1', { componentId: 'server', label: 'API Server', dslName: 'api' })
    expect(print({ nodes: [carried], edges: [] }).names).toEqual({ n1: 'api' })
  })

  /** Every reported name has to resolve when the printed text is compiled back. */
  it('reports names the compiler agrees with', () => {
    const nodes = [
      node('n1', { componentId: 'server', label: 'API Server' }),
      node('n2', { componentId: 'redis', label: 'Cache', category: 'caching' }),
    ]
    const printed = print({ nodes, edges: [] })
    const compiled = compileSource(printed.text)

    for (const name of Object.values(printed.names)) {
      expect(compiled.nodeIdsByName[name]).toBeDefined()
    }
  })
})

describe('shapes', () => {
  const shapeNode = (
    id: string,
    data: Partial<ShapeNodeData> & { shapeType: ShapeNodeData['shapeType'] },
    size = { width: 160, height: 100 }
  ): ArchitectureNode => ({
    id,
    type: 'shape',
    position: { x: 0, y: 0 },
    width: size.width,
    height: size.height,
    style: size,
    data: data as ShapeNodeData,
  })

  it('prints a shape with its label', () => {
    expect(textOf([shapeNode('s1', { shapeType: 'rectangle', label: 'Legend' })])).toBe(
      'shape legend "Legend"'
    )
  })

  /** A rectangle is the default, so naming it would add nothing. */
  it('omits a rectangle type but prints any other', () => {
    expect(textOf([shapeNode('s1', { shapeType: 'rectangle', label: 'Box' })])).not.toContain(':')
    expect(
      textOf([shapeNode('s1', { shapeType: 'note', label: 'Remember' }, { width: 140, height: 100 })])
    ).toBe('shape remember "Remember" : note')
  })

  it('prints styling that was set', () => {
    const text = textOf([
      shapeNode('s1', { shapeType: 'rectangle', label: 'B', fill: '#eef', strokeWidth: 3 }),
    ])
    expect(text).toContain('fill "#eef"')
    expect(text).toContain('strokeWidth 3')
  })

  /** The canvas stamps a full style bag onto every shape; echoing it back is pure noise. */
  it('omits the canvas defaults', () => {
    const text = textOf([
      shapeNode('s1', {
        shapeType: 'rectangle',
        label: 'B',
        fill: 'transparent',
        fillOpacity: 1,
        strokeWidth: 1.5,
        strokeStyle: 'solid',
        opacity: 100,
        cornerRadius: 0,
        fontSize: 10,
        textAlign: 'left',
      }),
    ])
    expect(text).toBe('shape b "B"')
  })

  it('prints a size only when it differs from the shape default', () => {
    expect(textOf([shapeNode('s1', { shapeType: 'rectangle', label: 'B' })])).not.toContain('width')
    expect(
      textOf([shapeNode('s1', { shapeType: 'rectangle', label: 'B' }, { width: 400, height: 220 })])
    ).toContain('width 400')
  })

  it('falls back to the shape type when there is no label', () => {
    expect(textOf([shapeNode('s1', { shapeType: 'ellipse' }, { width: 160, height: 100 })])).toBe(
      'shape ellipse : ellipse'
    )
  })

  it('round-trips through the compiler', () => {
    const { first, second, text } = roundTrip(
      'shape hint "Add rate limiting" : note\nshape box "Legend" { fill "#eef", strokeWidth 3 }'
    )
    expect(second.diagnostics).toEqual([])
    expect(text).toContain(': note')
    expect(second.nodes.map((n) => n.data)).toEqual(first.nodes.map((n) => n.data))
  })

  it('lets a shape be an endpoint, as the canvas does', () => {
    const { second } = roundTrip('server api "API"\nshape box "Legend"\nbox -> api')
    expect(second.diagnostics).toEqual([])
    expect(second.edges).toHaveLength(1)
  })
})

describe('components inside a drawn shape', () => {
  /**
   * Drawing a big rectangle round a cluster of components is a normal way to work, and
   * `isContainerNode` counts a closed shape as a container. That made every component inside
   * one vanish from the output while its arrows were still printed, so the text referred to
   * names it never declared.
   */
  const bigBox = (id: string): ArchitectureNode => ({
    id,
    type: 'shape',
    position: { x: 0, y: 0 },
    width: 500,
    height: 400,
    style: { width: 500, height: 400 },
    data: { shapeType: 'rectangle', label: 'Data Center 1' } as ShapeNodeData,
  })

  const inside = (id: string, label: string, x: number) =>
    node('n' + id, { componentId: 'server', label }, { x, y: 100 })

  it('declares the components, not just their arrows', () => {
    const nodes = [bigBox('s1'), inside('1', 'API', 60), inside('2', 'Worker', 260)]
    const text = textOf(nodes, [edge('e1', 'n1', 'n2')])

    expect(text).toContain('server api "API"')
    expect(text).toContain('server worker "Worker"')
    expect(text).toContain('api -> worker')
  })

  /** The bug as the user hit it: a document full of undeclared names. */
  it('produces text that compiles with no undeclared names', () => {
    const nodes = [bigBox('s1'), inside('1', 'API', 60), inside('2', 'Worker', 260)]
    const printed = print({ nodes, edges: [edge('e1', 'n1', 'n2')] })
    const compiled = compileSource(printed.text)

    expect(compiled.diagnostics).toEqual([])
    expect(compiled.edges).toHaveLength(1)
  })

  it('prints them at top level rather than nested in the shape', () => {
    const nodes = [bigBox('s1'), inside('1', 'API', 60)]
    // No indentation: a shape has no body to nest anything in.
    expect(textOf(nodes)).toMatch(/^server api "API"$/m)
  })

  /** A frame is the language's container, and must still nest. */
  it('still nests inside a real frame', () => {
    const nodes = [
      frame('f1', { label: 'DC', frameType: 'data-center' }, { x: 0, y: 0 }, { width: 500, height: 400 }),
      inside('1', 'API', 60),
    ]
    expect(textOf(nodes)).toContain('  server api "API"')
  })

  it('handles a shape drawn inside a frame', () => {
    const nodes = [
      frame('f1', { label: 'DC', frameType: 'data-center' }, { x: 0, y: 0 }, { width: 600, height: 500 }),
      bigBox('s1'),
      inside('1', 'API', 60),
    ]
    const compiled = compileSource(print({ nodes, edges: [] }).text)
    expect(compiled.diagnostics).toEqual([])
    // Both the shape and the component belong to the frame, not to each other.
    expect(Object.keys(compiled.hierarchy)).toHaveLength(2)
  })
})

describe('what cannot be printed', () => {
  it('reports a UML node rather than dropping it silently', () => {
    const result = print({ nodes: [umlNode('u1')], edges: [] })
    expect(result.text.trim()).toBe('')
    expect(result.skipped).toEqual([
      { id: 'u1', kind: 'node', type: 'umlClass', reason: expect.stringContaining('text form') },
    ])
  })

  it('reports an edge whose endpoint has no text form', () => {
    const api = node('1', { componentId: 'server', label: 'API' })
    const result = print({ nodes: [api, umlNode('u1')], edges: [edge('e1', '1', 'u1')] })
    expect(result.skipped.filter((s) => s.kind === 'edge')).toHaveLength(1)
  })
})

describe('round trip', () => {
  /** The contract that makes the printer safe: text in, same diagram out. */
  it('survives a flat diagram', () => {
    const { first, second } = roundTrip('server api "API"\npostgresql db "Orders"\napi -> db : TCP "query"')
    expect(second.diagnostics).toEqual([])
    expect(second.nodes.map((n) => n.data)).toEqual(first.nodes.map((n) => n.data))
    expect(second.edges.map((e) => e.data)).toEqual(first.edges.map((e) => e.data))
  })

  it('survives sizing and config', () => {
    const { first, second } = roundTrip(
      'server api "API" { instances 3, type m5.large, service 25ms }\n' +
        'postgresql db "Orders" { connectionPool 20, engine postgres, multiAz }'
    )
    expect(second.diagnostics).toEqual([])
    expect(second.nodes.map((n) => n.data)).toEqual(first.nodes.map((n) => n.data))
  })

  it('survives nested groups', () => {
    const { first, second, text } = roundTrip(
      'group dc "Data Center" : data-center {\n' +
        '  group svc "Services" : cluster {\n' +
        '    server api "API"\n' +
        '  }\n' +
        '  postgresql db "Orders"\n' +
        '}'
    )
    expect(second.diagnostics).toEqual([])
    expect(second.nodes).toHaveLength(first.nodes.length)
    // `svc`, the name the source used — not `services` re-derived from the label.
    expect(text).toContain('group svc "Services" : cluster {')
    // Membership survives, which is the part that is easy to lose.
    expect(Object.keys(second.hierarchy)).toHaveLength(Object.keys(first.hierarchy).length)
  })

  it('survives every arrow kind', () => {
    const { first, second } = roundTrip(
      'server api "API"\nredis cache "Cache"\nkafka mq "Events"\npostgresql db "DB"\n' +
        'api -> cache\napi ~> mq\napi <-> db\n'
    )
    expect(second.diagnostics).toEqual([])
    expect(second.edges.map((e) => e.data?.connectionType)).toEqual(
      first.edges.map((e) => e.data?.connectionType)
    )
  })

  it('survives a workload', () => {
    const { first, second } = roundTrip('workload { dau 250M, peak 5x, reads 4:1, cache 90% }')
    expect(second.diagnostics).toEqual([])
    expect(second.workload).toEqual(first.workload)
  })

  it('survives the diagram name', () => {
    expect(roundTrip('diagram "Photos" {\n  server api "API"\n}').second.name).toBe('Photos')
  })

  /** Printing twice must not keep changing the text, or a save loop would never settle. */
  it('is stable when applied twice', () => {
    const source = `diagram "Photos" {
  workload { dau 100M, peak 3x }

  group dc "Data Center" : data-center {
    server api "API Server" { instances 3, type m5.large, service 25ms }
    postgresql db "Orders DB" { connectionPool 20, multiAz }
  }

  redis cache "Redis"

  api -> cache : TCP "cache lookup"
  api -> db : TCP "query"
}`
    const once = roundTrip(source)
    const twice = print(
      { nodes: once.second.nodes, edges: once.second.edges },
      { name: once.second.name, workload: once.second.workload, hierarchy: once.second.hierarchy }
    )
    expect(twice.text).toBe(once.text)
  })

  it('produces text a human would accept', () => {
    const { text } = roundTrip(
      'diagram "Photos" {\n' +
        '  group dc "Data Center" : data-center {\n' +
        '    server api "API Server" { instances 3, type m5.large }\n' +
        '  }\n' +
        '  api -> api2\n' +
        '  server api2 "Worker"\n' +
        '}'
    )
    // No stray blank lines inside blocks, no trailing whitespace.
    expect(text).not.toMatch(/\{\n\s*\n/)
    expect(text).not.toMatch(/\n\s*\n\s*\}/)
    expect(text.split('\n').every((line) => line === line.trimEnd())).toBe(true)
  })
})
