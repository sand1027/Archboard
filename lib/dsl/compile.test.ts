import { describe, it, expect } from 'vitest'
import type { ArchitectureNodeData, FrameNodeData } from '@/types/architecture'
import { nodeCapacity } from '@/lib/simulation/capacity'
import { instanceProfile } from '@/lib/simulation/instances'
import { compileSource } from './compile'

/** The architecture node compiled from a given DSL name. */
function nodeFor(source: string, name: string) {
  const compiled = compileSource(source)
  const id = compiled.nodeIdsByName[name]
  return compiled.nodes.find((n) => n.id === id)
}

function dataFor(source: string, name: string): ArchitectureNodeData {
  const node = nodeFor(source, name)
  if (!node || node.type !== 'architecture') throw new Error(`no architecture node "${name}"`)
  return node.data
}

const messages = (source: string) => compileSource(source).diagnostics.map((d) => d.message)
const errorsOf = (source: string) =>
  compileSource(source).diagnostics.filter((d) => d.severity === 'error')

describe('components', () => {
  it('resolves the registry entry, not just the name typed', () => {
    const data = dataFor('load-balancer lb', 'lb')
    expect(data).toMatchObject({
      componentId: 'load-balancer',
      label: 'Load Balancer',
      category: 'networking',
      icon: '/components/networking/load-balancer.svg',
    })
  })

  it('prefers an explicit label over the registry name', () => {
    expect(dataFor('server api "Orders API"', 'api').label).toBe('Orders API')
  })

  /** Matches the drop handler in Whiteboard, so a compiled node measures the same. */
  it('emits the same node shape the canvas builds on drop', () => {
    const node = nodeFor('postgresql db', 'db')
    expect(node).toMatchObject({
      type: 'architecture',
      width: 72,
      height: 88,
      style: { width: 72, height: 88 },
      connectable: true,
      zIndex: 10,
    })
  })

  it('reports an unknown component on the type word alone', () => {
    const [error] = errorsOf('notathing api')
    expect(error.message).toContain('Unknown component')
    expect(error.span.start.offset).toBe(0)
    expect(error.span.end.offset).toBe('notathing'.length)
  })

  it('suggests a near miss', () => {
    expect(messages('postgresqll db').join(' ')).toContain('Unknown component')
    expect(compileSource('postgresqll db').diagnostics[0].hint).toContain('postgresql')
  })

  /** Names are how connections refer to components, so a duplicate is ambiguous. */
  it('rejects a duplicate name', () => {
    expect(messages('server api\nredis api').join(' ')).toContain('already declared')
  })

  it('leaves positions at the origin for layout to assign', () => {
    const compiled = compileSource('server api\nredis cache')
    expect(compiled.nodes.every((n) => n.position.x === 0 && n.position.y === 0)).toBe(true)
  })

  /**
   * Ids must not move between compiles or the canvas remounts every node on each keystroke
   * and any saved position pin is orphaned.
   */
  it('generates the same ids for the same text', () => {
    const source = 'server api\nredis cache\napi -> cache'
    const first = compileSource(source)
    const second = compileSource(source)
    expect(first.nodes.map((n) => n.id)).toEqual(second.nodes.map((n) => n.id))
    expect(first.edges.map((e) => e.id)).toEqual(second.edges.map((e) => e.id))
  })
})

describe('sizing properties', () => {
  it('maps instance sizing onto the fields the simulation reads', () => {
    const data = dataFor('server api { instances 4, vcpu 8, memory 16, concurrencyPerVcpu 2 }', 'api')
    expect(data).toMatchObject({ instances: 4, vcpu: 8, memoryGb: 16, concurrencyPerVcpu: 2 })
  })

  it('converts a byte-unit memory value to GB', () => {
    expect(dataFor('server api { memory 8gb }', 'api').memoryGb).toBe(8)
  })

  it('maps service time and a direct concurrency override', () => {
    const data = dataFor('server api { service 40ms, concurrency 64 }', 'api')
    expect(data).toMatchObject({ serviceMs: 40, concurrency: 64 })
  })

  /** `type m5.large` is how people actually size a tier. */
  it('reads an instance type into config', () => {
    expect(dataFor('server api { type m5.large }', 'api').config).toEqual({
      instanceType: 'm5.large',
    })
  })

  it('rejects an unknown instance type', () => {
    expect(messages('server api { type m9.enormous }').join(' ')).toContain('Unknown instance type')
  })

  it('requires a number where a number belongs', () => {
    expect(messages('server api { instances lots }').join(' ')).toContain('needs a number')
  })

  /** The whole point of the sizing keys: they must reach the simulation. */
  it('produces capacity the simulation can read straight off', () => {
    const data = dataFor('server api { instances 4, vcpu 8, concurrencyPerVcpu 2 }', 'api')
    expect(instanceProfile(data)).toMatchObject({ instances: 4, vcpu: 8, concurrencyPerVcpu: 2 })
    // 8 vCPU × 2 per vCPU × 4 instances = 64
    expect(nodeCapacity(data).concurrency).toBe(64)
  })

  it('gives an unconfigured component sensible capacity anyway', () => {
    const capacity = nodeCapacity(dataFor('postgresql db', 'db'))
    expect(capacity.serviceMs).toBeGreaterThan(0)
    expect(capacity.concurrency).toBeGreaterThan(0)
  })
})

describe('config properties', () => {
  it('writes known settings into the config bag', () => {
    expect(dataFor('postgresql db { connectionPool 20, engine postgres }', 'db').config).toEqual({
      connectionPool: 20,
      engine: 'postgres',
    })
  })

  it('reads a bare flag as true', () => {
    expect(dataFor('postgresql db { multiAz }', 'db').config).toEqual({ multiAz: true })
  })

  it('validates a select against its options', () => {
    expect(messages('postgresql db { engine oracle }')).toEqual([])
    expect(messages('postgresql db { engine banana }').join(' ')).toContain('not a valid engine')
  })

  it('honours component-specific fields over category ones', () => {
    expect(dataFor('aws-ec2 web { ami ami-0abc123, ebsType gp3 }', 'web').config).toEqual({
      ami: 'ami-0abc123',
      ebsType: 'gp3',
    })
  })

  /** A connection pool is the real concurrency ceiling for a database. */
  it('lets a pool cap the derived concurrency', () => {
    const data = dataFor('postgresql db { connectionPool 20, instances 2, vcpu 32 }', 'db')
    expect(nodeCapacity(data).concurrency).toBe(20)
  })

  it('warns on an unknown key but keeps the value', () => {
    const compiled = compileSource('postgresql db { connectionPoool 20 }')
    const [warning] = compiled.diagnostics
    expect(warning.severity).toBe('warning')
    expect(warning.hint).toContain('connectionPool')

    const node = compiled.nodes[0]
    if (node.type !== 'architecture') throw new Error('expected an architecture node')
    expect(node.data.config).toEqual({ connectionPoool: 20 })
  })

  it('warns when a number is out of range', () => {
    expect(messages('postgresql db { connectionPool 0 }').join(' ')).toContain('minimum')
  })
})

describe('groups', () => {
  it('compiles a group to a frame node', () => {
    const compiled = compileSource('group dc "Data Center" {\n  server api\n}')
    const frame = compiled.nodes.find((n) => n.type === 'frame')
    expect(frame?.data).toMatchObject({ label: 'Data Center', frameType: 'custom' })
  })

  it('falls back to the group name as its label', () => {
    const compiled = compileSource('group dc {\n  server api\n}')
    const frame = compiled.nodes.find((n) => n.type === 'frame')
    expect((frame?.data as FrameNodeData).label).toBe('dc')
  })

  /** Written after a `:` because a group body holds declarations, not properties. */
  it('reads the frame type from the header', () => {
    const compiled = compileSource('group net "Network" : vpc {\n  server api\n}')
    const frame = compiled.nodes.find((n) => n.type === 'frame')
    expect((frame?.data as FrameNodeData).frameType).toBe('vpc')
  })

  it('rejects an unknown frame type', () => {
    expect(messages('group net "N" : submarine {\n}').join(' ')).toContain('Unknown frame type')
  })

  /**
   * Containment is geometric in this codebase, so it rides beside the nodes and layout is
   * what makes it true.
   */
  it('records membership in the hierarchy rather than on the node', () => {
    const compiled = compileSource('group dc "DC" {\n  server api\n}')
    const frame = compiled.nodes.find((n) => n.type === 'frame')
    const child = compiled.nodes.find((n) => n.type === 'architecture')
    expect(compiled.hierarchy[child!.id]).toBe(frame!.id)
    expect(child).not.toHaveProperty('parentId')
  })

  it('nests', () => {
    const compiled = compileSource(
      'group dc "DC" {\n  group svc "Services" {\n    server api\n  }\n}'
    )
    const frames = compiled.nodes.filter((n) => n.type === 'frame')
    const child = compiled.nodes.find((n) => n.type === 'architecture')
    expect(frames).toHaveLength(2)
    // api inside svc, svc inside dc
    expect(compiled.hierarchy[child!.id]).toBe(frames[1].id)
    expect(compiled.hierarchy[frames[1].id]).toBe(frames[0].id)
  })

  it('leaves frame size to layout, which is what knows the contents', () => {
    const frame = compileSource('group dc "DC" {\n  server api\n}').nodes.find(
      (n) => n.type === 'frame'
    )
    expect(frame?.width).toBeUndefined()
    expect(frame?.style).toBeUndefined()
  })
})

describe('connections', () => {
  it('wires an edge between the two named components', () => {
    const compiled = compileSource('server api\npostgresql db\napi -> db')
    const [edge] = compiled.edges
    expect(edge.source).toBe(compiled.nodeIdsByName.api)
    expect(edge.target).toBe(compiled.nodeIdsByName.db)
  })

  it('takes an explicit protocol and label', () => {
    const compiled = compileSource('server api\npostgresql db\napi -> db : gRPC "query"')
    expect(compiled.edges[0].data).toMatchObject({ protocol: 'gRPC', label: 'query' })
  })

  it('matches a protocol case-insensitively', () => {
    const compiled = compileSource('server api\npostgresql db\napi -> db : https')
    expect(compiled.edges[0].data?.protocol).toBe('HTTPS')
  })

  it('rejects an unknown protocol', () => {
    expect(messages('server api\npostgresql db\napi -> db : SMOKE').join(' ')).toContain(
      'Unknown protocol'
    )
  })

  it('maps the async arrow to an asynchronous, animated edge', () => {
    const compiled = compileSource('server api\nkafka mq\napi ~> mq')
    expect(compiled.edges[0].data).toMatchObject({ connectionType: 'asynchronous', animated: true })
    expect(compiled.edges[0].animated).toBe(true)
  })

  it('maps the bidirectional arrow', () => {
    const compiled = compileSource('server api\nredis cache\napi <-> cache')
    expect(compiled.edges[0].data?.connectionType).toBe('bidirectional')
  })

  /**
   * A plain `->` defers to inference, so a DSL edge gets the same connection type a user
   * would have got by dragging — flattening everything to synchronous would lose that.
   */
  it('lets inference classify a plain arrow', () => {
    const compiled = compileSource('server api\npostgresql db\napi -> db')
    expect(compiled.edges[0].data?.connectionType).toBeDefined()
    expect(compiled.edges[0].data?.label).not.toBe('')
  })

  it('lets an explicit type beat the arrow', () => {
    const compiled = compileSource('postgresql a\npostgresql b\na -> b { type replication }')
    expect(compiled.edges[0].data?.connectionType).toBe('replication')
  })

  it('rejects an unknown connection type', () => {
    expect(messages('server a\nserver b\na -> b { type telepathy }').join(' ')).toContain(
      'Unknown connection type'
    )
  })

  it('reads a line style', () => {
    const compiled = compileSource('server a\nserver b\na -> b { style step }')
    expect(compiled.edges[0].data?.edgeLineStyle).toBe('step')
  })

  /** An architecture document carries more than this tool models. */
  it('keeps unrecognised annotations as metadata', () => {
    const compiled = compileSource('server a\nserver b\na -> b { timeout 2s, retries 3 }')
    expect(compiled.edges[0].data?.metadata).toEqual({ timeout: 2000, retries: 3 })
  })

  it('reports an undeclared endpoint on the name itself', () => {
    const [error] = errorsOf('server api\napi -> ghost')
    expect(error.message).toContain('"ghost" is not declared')
    expect(error.span.start.line).toBe(2)
  })

  it('suggests a near miss on an endpoint', () => {
    const compiled = compileSource('server api\npostgresql db\napi -> dbb')
    expect(compiled.diagnostics[0].hint).toContain('db')
  })

  it('rejects a self-connection, as the canvas does', () => {
    expect(messages('server api\napi -> api').join(' ')).toContain('cannot connect to itself')
  })

  /** Order should not matter; a connection may reference something declared later. */
  it('resolves a forward reference', () => {
    const compiled = compileSource('api -> db\nserver api\npostgresql db')
    expect(compiled.edges).toHaveLength(1)
    expect(compiled.diagnostics).toEqual([])
  })

  it('accepts a connection written inside a group', () => {
    const compiled = compileSource(
      'group dc "DC" {\n  server api\n  postgresql db\n  api -> db\n}'
    )
    expect(compiled.edges).toHaveLength(1)
    expect(compiled.diagnostics).toEqual([])
  })

  /** The declaration error is the real one; repeating it per arrow would bury it. */
  it('does not repeat an unknown-component error on every arrow touching it', () => {
    const compiled = compileSource('notathing api\npostgresql db\napi -> db')
    expect(compiled.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(1)
    expect(compiled.edges).toHaveLength(0)
  })
})

describe('workload', () => {
  it('maps the DSL keys onto the estimator inputs', () => {
    const compiled = compileSource(
      'workload {\n  dau 100M\n  perUser 20\n  peak 4x\n  retention 90d\n  replicas 3\n}'
    )
    expect(compiled.workload).toMatchObject({
      dau: 100_000_000,
      requestsPerUserPerDay: 20,
      peakFactor: 4,
      retentionDays: 90,
      replicationFactor: 3,
    })
  })

  it('reads a read/write split written as a ratio', () => {
    expect(compileSource('workload { reads 9:1 }').workload?.readsPerWrite).toBe(9)
    expect(compileSource('workload { reads 4:2 }').workload?.readsPerWrite).toBe(2)
  })

  it('reads a cache hit rate as a fraction', () => {
    expect(compileSource('workload { cache 80% }').workload?.cacheHitRate).toBe(0.8)
  })

  /** The estimator works in KB, so a byte-unit payload must be converted. */
  it('converts payload sizes to KB', () => {
    const compiled = compileSource('workload { request 2kb, response 8kb, stored 1mb }')
    expect(compiled.workload).toMatchObject({
      requestKb: 2,
      responseKb: 8,
      storedPerWriteKb: 1024,
    })
  })

  it('fills unspecified inputs from the defaults', () => {
    const compiled = compileSource('workload { dau 5M }')
    expect(compiled.workload?.secondsPerDay).toBe(86_400)
    expect(compiled.workload?.requestsPerUserPerDay).toBe(10)
  })

  /** Through the same clamp the panel uses, so text and UI cannot disagree. */
  it('clamps an out-of-range input', () => {
    expect(compileSource('workload { peak 0 }').workload?.peakFactor).toBe(1)
  })

  it('warns on an unknown input', () => {
    expect(messages('workload { dua 100M }').join(' ')).toContain('Unknown workload input')
  })

  it('requires a number', () => {
    expect(messages('workload { dau many }').join(' ')).toContain('needs a number')
  })

  it('warns about a duplicate block', () => {
    expect(messages('workload { dau 1M }\nworkload { dau 2M }').join(' ')).toContain('Duplicate')
  })

  it('omits the workload entirely when none was declared', () => {
    expect(compileSource('server api').workload).toBeUndefined()
  })
})

describe('a realistic document', () => {
  const source = `
# Photo sharing platform
diagram "Photos" {
  workload {
    dau 100M
    perUser 10
    peak 3x
    reads 9:1
    cache 80%
  }

  group client "Client" {
    web-browser web "Web Browser"
    mobile-app mobile "Mobile App"
  }

  load-balancer lb "Load Balancer" { instances 2, type m5.large }

  group dc "Data Center" : data-center {
    group svc "Services" : cluster {
      server api "API Server" { instances 3, type m5.large, service 25ms }
    }
    redis cache "Redis" { type r5.large, maxMemoryGb 16 }
    postgresql db "Orders DB" { connectionPool 20, multiAz, instances 2 }
  }

  kafka mq "Events"

  web    -> lb    : HTTPS "page load"
  mobile -> lb    : HTTPS "REST call"
  lb     -> api   : HTTP
  api    -> cache : TCP "cache lookup"
  api    -> db    : TCP "query"
  api    ~> mq    : Kafka "publish event"
}
`

  it('compiles with no diagnostics at all', () => {
    expect(compileSource(source).diagnostics).toEqual([])
  })

  it('produces the right counts', () => {
    const compiled = compileSource(source)
    expect(compiled.nodes.filter((n) => n.type === 'architecture')).toHaveLength(7)
    expect(compiled.nodes.filter((n) => n.type === 'frame')).toHaveLength(3)
    expect(compiled.edges).toHaveLength(6)
    expect(compiled.name).toBe('Photos')
  })

  it('carries the workload through', () => {
    expect(compileSource(source).workload).toMatchObject({
      dau: 100_000_000,
      peakFactor: 3,
      readsPerWrite: 9,
      cacheHitRate: 0.8,
    })
  })

  it('nests the services cluster inside the data centre', () => {
    const compiled = compileSource(source)
    const dc = compiled.nodes.find((n) => (n.data as FrameNodeData).label === 'Data Center')
    const svc = compiled.nodes.find((n) => (n.data as FrameNodeData).label === 'Services')
    expect(compiled.hierarchy[svc!.id]).toBe(dc!.id)
    expect(compiled.hierarchy[compiled.nodeIdsByName.api]).toBe(svc!.id)
  })

  /** The reason this DSL exists rather than adopting Mermaid: the text is runnable. */
  it('gives every node capacity the simulation can use', () => {
    const compiled = compileSource(source)
    for (const node of compiled.nodes) {
      if (node.type !== 'architecture') continue
      const capacity = nodeCapacity(node.data)
      expect(capacity.concurrency).toBeGreaterThan(0)
      expect(capacity.serviceMs).toBeGreaterThanOrEqual(0)
    }

    // The API tier's sizing came from the text: 3 × m5.large (2 vCPU) × 4 per vCPU.
    const api = compiled.nodes.find((n) => n.id === compiled.nodeIdsByName.api)
    expect(instanceProfile(api!.data)).toMatchObject({ instances: 3, vcpu: 2, memoryGb: 8 })
    expect(nodeCapacity(api!.data)).toMatchObject({ serviceMs: 25, concurrency: 24 })
  })

  it('still compiles the good parts when a line is broken', () => {
    const broken = source.replace('server api "API Server"', 'notathing api "API Server"')
    const compiled = compileSource(broken)
    expect(compiled.diagnostics.length).toBeGreaterThan(0)
    // The other six components survive. The four edges touching api drop out; the two
    // into the balancer remain.
    expect(compiled.nodes.filter((n) => n.type === 'architecture')).toHaveLength(6)
    expect(compiled.edges).toHaveLength(2)
  })
})

describe('shapes', () => {
  const shapeNode = (source: string, name: string) => {
    const compiled = compileSource(source)
    const node = compiled.nodes.find((n) => n.id === compiled.nodeIdsByName[name])
    if (!node || node.type !== 'shape') throw new Error(`no shape node "${name}"`)
    return node
  }

  it('compiles to a shape node the canvas can render', () => {
    const node = shapeNode('shape hint "Add rate limiting" : note', 'hint')
    expect(node.data).toMatchObject({ shapeType: 'note', label: 'Add rate limiting' })
    expect(node.width).toBe(140)
    expect(node.height).toBe(100)
  })

  it('defaults to a rectangle', () => {
    expect(shapeNode('shape box "Legend"', 'box').data.shapeType).toBe('rectangle')
  })

  it('rejects an unknown shape type', () => {
    expect(messages('shape box "B" : squircle').join(' ')).toContain('Unknown shape')
  })

  it('applies styling', () => {
    const node = shapeNode('shape box "B" { fill "#eef", strokeWidth 3, cornerRadius 8 }', 'box')
    expect(node.data).toMatchObject({ fill: '#eef', strokeWidth: 3, cornerRadius: 8 })
  })

  /** `opacity` is stored 0–100, so a percentage has to be scaled back up. */
  it('scales a percentage opacity to the 0-100 the canvas uses', () => {
    expect(shapeNode('shape box { opacity 60% }', 'box').data.opacity).toBe(60)
  })

  it('takes an explicit size over the shape default', () => {
    const node = shapeNode('shape box { width 400, height 220 }', 'box')
    expect(node.width).toBe(400)
    expect(node.height).toBe(220)
  })

  it('warns about an unknown styling key', () => {
    expect(messages('shape box { colour red }').join(' ')).toContain('not a known shape setting')
  })

  /** Lines, arrows and text are scenery on the canvas, and must stay scenery here. */
  it('leaves scenery unconnectable', () => {
    expect(shapeNode('shape l : line', 'l').connectable).toBe(false)
    expect(shapeNode('shape t : text', 't').connectable).toBe(false)
    expect(shapeNode('shape b : rectangle', 'b').connectable).toBe(true)
  })

  it('can be a connection endpoint', () => {
    const compiled = compileSource('server api "API"\nshape box "Legend"\nbox -> api')
    expect(compiled.diagnostics).toEqual([])
    expect(compiled.edges).toHaveLength(1)
  })

  it('can live inside a group', () => {
    const compiled = compileSource('group dc "DC" {\n  shape hint "Note" : note\n}')
    const frame = compiled.nodes.find((n) => n.type === 'frame')!
    expect(compiled.hierarchy[compiled.nodeIdsByName.hint]).toBe(frame.id)
  })

  it('clashes with a component of the same name', () => {
    expect(messages('server api\nshape api "Note"').join(' ')).toContain('already declared')
  })

  /** A sticky note is not a tier, so the simulation must never see it as one. */
  it('carries no component id', () => {
    expect(shapeNode('shape box "B"', 'box').data.componentId).toBeUndefined()
  })
})

describe('ownership markers', () => {
  /**
   * The marker that makes text and canvas able to coexist. Without it the sync layer cannot
   * tell a generated node from a hand-drawn one, so it would have to replace the whole canvas
   * and would delete every drawn shape on the next keystroke.
   */
  it('stamps the DSL name on every generated node', () => {
    const compiled = compileSource(
      'group dc "DC" {\n  server api "API"\n  shape hint "Note" : note\n}'
    )
    expect(compiled.nodes).toHaveLength(3)
    for (const node of compiled.nodes) {
      expect(typeof node.data.dslName).toBe('string')
      expect(node.data.dslName).not.toBe('')
    }
  })

  it('uses the declared name, not the label', () => {
    const compiled = compileSource('server api "API Server"')
    expect(compiled.nodes[0].data.dslName).toBe('api')
  })

  it('marks every generated edge as owned', () => {
    const compiled = compileSource('server api\npostgresql db\napi -> db')
    expect(compiled.edges[0].data?.dslOwned).toBe(true)
  })

  it('lets a node be found by its name through the marker alone', () => {
    const compiled = compileSource('server api "API"\nredis cache "Cache"')
    const byName = new Map(compiled.nodes.map((n) => [n.data.dslName, n.id]))
    expect(byName.get('api')).toBe(compiled.nodeIdsByName.api)
    expect(byName.get('cache')).toBe(compiled.nodeIdsByName.cache)
  })
})

describe('groups as named things', () => {
  /** So a frame can be pinned and referenced like anything else. */
  it('claims its name', () => {
    const compiled = compileSource('group dc "Data Center" {\n  server api\n}')
    expect(compiled.nodeIdsByName.dc).toBeDefined()
  })

  it('rejects two groups with the same name', () => {
    expect(
      messages('group dc "A" {\n}\ngroup dc "B" {\n}').join(' ')
    ).toContain('already declared')
  })

  it('rejects a group clashing with a component', () => {
    expect(messages('server api\ngroup api "A" {\n}').join(' ')).toContain('already declared')
  })

  it('still compiles the children of a clashing group', () => {
    const compiled = compileSource('group dc "A" {\n}\ngroup dc "B" {\n  redis cache\n}')
    expect(compiled.nodeIdsByName.cache).toBeDefined()
  })

  it('can be a connection endpoint', () => {
    const compiled = compileSource(
      'group client "Clients" {\n  web-browser web\n}\nserver api "API"\nclient -> api'
    )
    expect(compiled.diagnostics).toEqual([])
    expect(compiled.edges).toHaveLength(1)
  })
})
