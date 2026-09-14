import { describe, it, expect } from 'vitest'
import type {
  ComponentDeclNode,
  ConnectionNode,
  GroupDeclNode,
  ShapeDeclNode,
  WorkloadNode,
} from '@/types/dsl'
import { parse } from './parser'

const body = (source: string) => parse(source).diagram?.body ?? []
const errors = (source: string) => parse(source).diagnostics.map((d) => d.message)

describe('document shape', () => {
  /** Requiring the wrapper would make the smallest useful document three lines instead of one. */
  it('accepts a bare list of declarations', () => {
    const result = parse('server api "API"')
    expect(result.diagnostics).toEqual([])
    expect(result.diagram?.body).toHaveLength(1)
  })

  it('accepts a named diagram wrapper', () => {
    const result = parse('diagram "Photos" {\n  server api\n}')
    expect(result.diagnostics).toEqual([])
    expect(result.diagram?.name).toBe('Photos')
    expect(result.diagram?.body).toHaveLength(1)
  })

  it('parses an empty document', () => {
    expect(parse('').diagram?.body).toEqual([])
    expect(parse('\n\n# just a comment\n').diagnostics).toEqual([])
  })
})

describe('components', () => {
  it('reads type, name and label', () => {
    const [decl] = body('server api "API Server"') as ComponentDeclNode[]
    expect(decl).toMatchObject({
      kind: 'component',
      componentType: 'server',
      name: 'api',
      label: 'API Server',
    })
  })

  it('makes the label optional', () => {
    const [decl] = body('redis cache') as ComponentDeclNode[]
    expect(decl).toMatchObject({ componentType: 'redis', name: 'cache', label: undefined })
  })

  it('reads an inline config block', () => {
    const [decl] = body('server api { instances 3, type m5.large, service 25ms }') as ComponentDeclNode[]
    expect(decl.properties).toEqual([
      expect.objectContaining({ key: 'instances', value: 3 }),
      expect.objectContaining({ key: 'type', value: 'm5.large' }),
      expect.objectContaining({ key: 'service', value: 25, unit: 'ms' }),
    ])
  })

  it('reads a multi-line config block', () => {
    const [decl] = body('postgresql db "Orders" {\n  pool 20\n  multiAz true\n}') as ComponentDeclNode[]
    expect(decl.properties).toEqual([
      expect.objectContaining({ key: 'pool', value: 20 }),
      expect.objectContaining({ key: 'multiAz', value: true }),
    ])
  })

  /** `multiAz` alone reads better than `multiAz true`. */
  it('treats a bare key as a flag', () => {
    const [decl] = body('postgresql db {\n  multiAz\n}') as ComponentDeclNode[]
    expect(decl.properties[0]).toMatchObject({ key: 'multiAz', value: true })
  })

  it('records the type span separately, so an unknown component underlines precisely', () => {
    const [decl] = body('notathing api') as ComponentDeclNode[]
    expect(decl.typeSpan.start.offset).toBe(0)
    // Covers exactly the type word, not the name after it.
    expect(decl.typeSpan.end.offset).toBe('notathing'.length)
  })
})

describe('groups', () => {
  it('reads name, label and children', () => {
    const [decl] = body('group dc "Data Center" {\n  server api\n  redis cache\n}') as GroupDeclNode[]
    expect(decl).toMatchObject({ kind: 'group', name: 'dc', label: 'Data Center' })
    expect(decl.children).toHaveLength(2)
  })

  /** Frames really do contain sub-frames, so the grammar has to nest. */
  it('nests', () => {
    const [outer] = body(
      'group dc "DC" {\n  group svc "Services" {\n    server api\n  }\n  postgresql db\n}'
    ) as GroupDeclNode[]

    expect(outer.children).toHaveLength(2)
    const inner = outer.children[0] as GroupDeclNode
    expect(inner.kind).toBe('group')
    expect(inner.children).toHaveLength(1)
  })

  it('accepts an empty group', () => {
    const [decl] = body('group empty "Nothing" {\n}') as GroupDeclNode[]
    expect(decl.children).toEqual([])
  })
})

describe('connections', () => {
  it('reads a plain connection', () => {
    const [decl] = body('api -> db') as ConnectionNode[]
    expect(decl).toMatchObject({ kind: 'connection', from: 'api', to: 'db', style: 'sync' })
  })

  it('distinguishes the three arrows', () => {
    expect((body('a -> b')[0] as ConnectionNode).style).toBe('sync')
    expect((body('a ~> b')[0] as ConnectionNode).style).toBe('async')
    expect((body('a <-> b')[0] as ConnectionNode).style).toBe('both')
  })

  it('reads protocol and label', () => {
    const [decl] = body('api -> db : HTTP "query"') as ConnectionNode[]
    expect(decl).toMatchObject({ protocol: 'HTTP', label: 'query' })
  })

  it('allows either part alone', () => {
    expect((body('api -> db : HTTP')[0] as ConnectionNode)).toMatchObject({
      protocol: 'HTTP',
      label: undefined,
    })
    expect((body('api -> db : "query"')[0] as ConnectionNode)).toMatchObject({
      protocol: undefined,
      label: 'query',
    })
  })

  /** A label with no protocol is common enough not to require the colon. */
  it('allows a bare label with no colon', () => {
    expect((body('api -> db "query"')[0] as ConnectionNode).label).toBe('query')
  })

  it('reads connection properties', () => {
    const [decl] = body('api -> db { timeout 2s }') as ConnectionNode[]
    expect(decl.properties[0]).toMatchObject({ key: 'timeout', value: 2000 })
  })

  it('records endpoint spans, so an unknown name underlines the name', () => {
    const [decl] = body('api -> db') as ConnectionNode[]
    expect(decl.fromSpan.start.offset).toBe(0)
    expect(decl.toSpan.start.offset).toBe(7)
  })
})

describe('workload', () => {
  it('reads the capacity inputs', () => {
    const [decl] = body('workload {\n  dau 100M\n  peak 3x\n  reads 9:1\n  cache 80%\n}') as WorkloadNode[]
    expect(decl.kind).toBe('workload')
    expect(decl.properties).toEqual([
      expect.objectContaining({ key: 'dau', value: 100_000_000, unit: 'count' }),
      expect.objectContaining({ key: 'peak', value: 3, unit: 'multiplier' }),
      expect.objectContaining({ key: 'reads', value: 9, unit: 'ratio', ratioDenominator: 1 }),
      expect.objectContaining({ key: 'cache', value: 0.8, unit: 'percent' }),
    ])
  })
})

describe('error recovery', () => {
  /**
   * The property the whole parser is shaped around: a live editor is almost always looking at
   * an unfinished document, so one bad line must not blank the preview.
   */
  it('keeps the good declarations around a bad one', () => {
    const result = parse('server api\nserver\nredis cache')
    expect(result.diagnostics.length).toBeGreaterThan(0)

    const names = (result.diagram?.body ?? [])
      .filter((d): d is ComponentDeclNode => d.kind === 'component')
      .map((d) => d.name)
    expect(names).toEqual(['api', 'cache'])
  })

  it('reports several errors at once rather than stopping at the first', () => {
    const result = parse('server\nredis\npostgresql')
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(3)
  })

  it('reports a missing closing brace', () => {
    expect(errors('group dc "DC" {\n  server api\n').join(' ')).toContain('}')
  })

  it('reports a missing opening brace', () => {
    expect(errors('workload\n  dau 100M\n').join(' ')).toContain('{')
  })

  it('reports a connection with no target', () => {
    expect(errors('api ->').join(' ')).toContain('after "->"')
  })

  it('reports an empty protocol section', () => {
    expect(errors('api -> db :').join(' ')).toContain('protocol or label')
  })

  /**
   * Brace depth is tracked during recovery. Without it, a broken declaration containing a
   * block would leave the parser inside that block, reading its properties as declarations.
   */
  it('does not fall inside a block while recovering', () => {
    const result = parse('server { instances 3 }\nredis cache')
    const names = (result.diagram?.body ?? [])
      .filter((d): d is ComponentDeclNode => d.kind === 'component')
      .map((d) => d.name)
    expect(names).toContain('cache')
  })

  it('always terminates on malformed input', () => {
    // Forward progress is guaranteed explicitly; these would otherwise be candidates to hang.
    for (const source of ['{', '}', '->', ':', '{{{{', '} } }', 'a -> -> b', '"']) {
      expect(() => parse(source)).not.toThrow()
    }
  })

  it('carries lexer diagnostics through', () => {
    expect(errors('server api "unterminated').join(' ')).toContain('Unterminated string')
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

  group dc "Data Center" {
    group svc "Services" {
      server api "API Server" { instances 3, type m5.large, service 25ms }
    }
    redis cache "Redis" { type r5.large }
    postgresql db "Orders DB" { pool 20, multiAz }
  }

  web    -> lb    : HTTPS "GET /page"
  mobile -> lb    : HTTPS "REST call"
  lb     -> api   : HTTP
  api    -> cache : HTTP "cache lookup"
  api    -> db    : HTTP "query"
  api    ~> mq    : AMQP "enqueue"
}
`

  it('parses cleanly', () => {
    expect(parse(source).diagnostics).toEqual([])
  })

  it('finds every declaration', () => {
    const decls = body(source)
    expect(decls.filter((d) => d.kind === 'workload')).toHaveLength(1)
    expect(decls.filter((d) => d.kind === 'group')).toHaveLength(2)
    expect(decls.filter((d) => d.kind === 'component')).toHaveLength(1)
    expect(decls.filter((d) => d.kind === 'connection')).toHaveLength(6)
  })

  it('nests the services group inside the datacenter', () => {
    const dc = body(source).find(
      (d): d is GroupDeclNode => d.kind === 'group' && d.name === 'dc'
    )
    expect(dc?.children.filter((c) => c.kind === 'group')).toHaveLength(1)
    expect(dc?.children.filter((c) => c.kind === 'component')).toHaveLength(2)
  })
})

describe('shapes', () => {
  it('reads name, label and type', () => {
    const [decl] = body('shape hint "Add rate limiting" : note') as ShapeDeclNode[]
    expect(decl).toMatchObject({
      kind: 'shape',
      name: 'hint',
      label: 'Add rate limiting',
      shapeType: 'note',
    })
  })

  it('makes the label and type optional', () => {
    const [decl] = body('shape box') as ShapeDeclNode[]
    expect(decl).toMatchObject({ kind: 'shape', name: 'box', label: undefined, shapeType: undefined })
  })

  it('reads a styling block', () => {
    const [decl] = body('shape box "Legend" { fill "#eef", strokeWidth 3 }') as ShapeDeclNode[]
    expect(decl.properties).toEqual([
      expect.objectContaining({ key: 'fill', value: '#eef' }),
      expect.objectContaining({ key: 'strokeWidth', value: 3 }),
    ])
  })

  it('records the type span, so an unknown shape underlines precisely', () => {
    const source = 'shape box "B" : squircle'
    const [decl] = body(source) as ShapeDeclNode[]
    expect(decl.shapeTypeSpan?.start.offset).toBe(source.indexOf('squircle'))
  })

  it('reports a missing name', () => {
    expect(errors('shape "just a label"').join(' ')).toContain('after "shape"')
  })

  it('reports an empty type section', () => {
    expect(errors('shape box :').join(' ')).toContain('shape type')
  })

  /** `shape` is a plain word too, so it must still work as a component name. */
  it('still allows shape as a connection endpoint name', () => {
    const [decl] = body('shape -> api') as ConnectionNode[]
    expect(decl).toMatchObject({ kind: 'connection', from: 'shape', to: 'api' })
  })

  it('recovers from a broken shape and keeps the next declaration', () => {
    const result = parse('shape\nredis cache')
    const names = (result.diagram?.body ?? [])
      .filter((d): d is ComponentDeclNode => d.kind === 'component')
      .map((d) => d.name)
    expect(names).toContain('cache')
  })
})
