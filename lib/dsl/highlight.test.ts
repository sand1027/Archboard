import { describe, it, expect } from 'vitest'
import type { Diagnostic } from '@/types/dsl'
import { compileSource } from './compile'
import { decorate, diagnosticsByLine, highlight, type SegmentKind } from './highlight'

/** The kind assigned to the first occurrence of `text` in `source`. */
function kindOf(source: string, text: string): SegmentKind | undefined {
  const start = source.indexOf(text)
  return highlight(source).find((s) => s.start === start && s.end === start + text.length)?.kind
}

const reassemble = (source: string) =>
  highlight(source)
    .map((s) => source.slice(s.start, s.end))
    .join('')

describe('coverage', () => {
  /**
   * The overlay renders these segments behind a transparent textarea, so losing or
   * reordering a single character would visibly desynchronise the highlight from the caret.
   */
  it('covers every character exactly once, in order', () => {
    const source = 'diagram "X" {\n  # note\n  server api "API" { instances 3 }\n  api -> db\n}\n'
    expect(reassemble(source)).toBe(source)
  })

  it('leaves no gaps or overlaps', () => {
    const segments = highlight('server api "API" { instances 3 }')
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].start).toBe(segments[i - 1].end)
    }
  })

  it('handles an empty source', () => {
    expect(highlight('')).toEqual([])
  })

  it('handles whitespace only', () => {
    expect(reassemble('\n\n   \n')).toBe('\n\n   \n')
  })
})

describe('roles', () => {
  it('marks the keywords', () => {
    expect(kindOf('diagram "X" {\n}', 'diagram')).toBe('keyword')
    expect(kindOf('group dc "DC" {\n}', 'group')).toBe('keyword')
    expect(kindOf('shape hint "Note" : note', 'shape')).toBe('keyword')
    expect(kindOf('workload { dau 100M }', 'workload')).toBe('keyword')
  })

  it('marks a shape name and its type', () => {
    const source = 'shape hint "Note" : note'
    expect(kindOf(source, 'hint')).toBe('name')
    expect(kindOf(source, 'note')).toBe('value')
  })

  /** A shape block holds properties, not declarations. */
  it('treats a shape body as properties', () => {
    const source = 'shape box "B" { fill "#eef", strokeWidth 3 }'
    expect(kindOf(source, 'fill')).toBe('property')
    expect(kindOf(source, 'strokeWidth')).toBe('property')
  })

  /** `shape` is an ordinary word too, so it must not be coloured as a keyword mid-expression. */
  it('does not treat shape as a keyword when it is an endpoint name', () => {
    expect(kindOf('shape -> api', 'shape')).toBe('name')
  })

  it('marks a component type and its name differently', () => {
    const source = 'server api "API"'
    expect(kindOf(source, 'server')).toBe('component')
    expect(kindOf(source, 'api')).toBe('name')
  })

  it('marks labels as strings', () => {
    expect(kindOf('server api "API Server"', '"API Server"')).toBe('string')
  })

  /** An arrow makes the first word a reference, not a component type. */
  it('marks both ends of a connection as names', () => {
    const source = 'api -> db'
    expect(kindOf(source, 'api')).toBe('name')
    expect(kindOf(source, 'db')).toBe('name')
    expect(kindOf(source, '->')).toBe('arrow')
  })

  it('marks all three arrows', () => {
    expect(kindOf('a ~> b', '~>')).toBe('arrow')
    expect(kindOf('a <-> b', '<->')).toBe('arrow')
  })

  it('marks property keys and their values apart', () => {
    const source = 'server api { runtime node }'
    expect(kindOf(source, 'runtime')).toBe('property')
    expect(kindOf(source, 'node')).toBe('value')
  })

  it('marks a protocol after a colon as a value', () => {
    expect(kindOf('api -> db : HTTP', 'HTTP')).toBe('value')
  })

  it('marks a frame type after a colon as a value', () => {
    expect(kindOf('group net "N" : vpc {\n}', 'vpc')).toBe('value')
  })

  it('marks comments, both spellings', () => {
    expect(kindOf('# note\nserver api', '# note')).toBe('comment')
    expect(kindOf('server api // trailing', '// trailing')).toBe('comment')
  })

  it('marks braces, commas and colons as punctuation', () => {
    const source = 'server api { a 1, b 2 }'
    expect(kindOf(source, '{')).toBe('punctuation')
    expect(kindOf(source, ',')).toBe('punctuation')
    expect(kindOf(source, '}')).toBe('punctuation')
  })

  /** So `100M` reads as one value with a quiet unit rather than two competing colours. */
  it('splits a number from its unit', () => {
    const segments = highlight('dau 100M')
    const number = segments.find((s) => s.kind === 'number')!
    const unit = segments.find((s) => s.kind === 'unit')!
    expect('dau 100M'.slice(number.start, number.end)).toBe('100')
    expect('dau 100M'.slice(unit.start, unit.end)).toBe('M')
  })

  it('keeps a bare number whole', () => {
    expect(highlight('instances 3').filter((s) => s.kind === 'unit')).toEqual([])
  })

  it('keeps a ratio whole rather than calling the tail a unit', () => {
    const segments = highlight('reads 9:1')
    expect(segments.filter((s) => s.kind === 'unit')).toEqual([])
    const number = segments.find((s) => s.kind === 'number')!
    expect('reads 9:1'.slice(number.start, number.end)).toBe('9:1')
  })
})

describe('block context', () => {
  /** A group body holds declarations; a component body holds properties. */
  it('treats a group body as declarations, not properties', () => {
    const source = 'group dc "DC" {\n  server api "API"\n}'
    expect(kindOf(source, 'server')).toBe('component')
    expect(kindOf(source, 'api')).toBe('name')
  })

  it('treats a workload body as properties', () => {
    const source = 'workload {\n  dau 100M\n}'
    expect(kindOf(source, 'dau')).toBe('property')
  })

  it('pops back to declarations after a nested properties block', () => {
    const source = 'group dc "DC" {\n  server api { instances 3 }\n  redis cache\n}'
    expect(kindOf(source, 'instances')).toBe('property')
    // `redis` is back at declaration level despite the block that just closed.
    expect(kindOf(source, 'redis')).toBe('component')
  })

  it('handles the diagram wrapper as a declaration body', () => {
    const source = 'diagram "X" {\n  server api "API"\n}'
    expect(kindOf(source, 'server')).toBe('component')
  })

  it('survives an unbalanced closing brace', () => {
    expect(() => highlight('}\n}\nserver api')).not.toThrow()
    expect(kindOf('}\nserver api', 'server')).toBe('component')
  })
})

describe('decorate', () => {
  const spanAt = (start: number, end: number, line = 1) => ({
    start: { offset: start, line, column: start + 1 },
    end: { offset: end, line, column: end + 1 },
  })

  it('leaves segments untouched when there is nothing wrong', () => {
    expect(decorate('server api', [])).toEqual(highlight('server api'))
  })

  it('marks the segment a diagnostic covers', () => {
    const source = 'notathing api'
    const diagnostic: Diagnostic = {
      severity: 'error',
      message: 'Unknown component',
      span: spanAt(0, 9),
    }
    const marked = decorate(source, [diagnostic]).filter((s) => s.severity === 'error')
    expect(marked).toHaveLength(1)
    expect(source.slice(marked[0].start, marked[0].end)).toBe('notathing')
  })

  it('still covers every character after splitting', () => {
    const source = 'server api { poool 20 }'
    const diagnostic: Diagnostic = {
      severity: 'warning',
      message: 'unknown key',
      span: spanAt(13, 18),
    }
    const text = decorate(source, [diagnostic])
      .map((s) => source.slice(s.start, s.end))
      .join('')
    expect(text).toBe(source)
  })

  it('splits a segment when a diagnostic starts partway through it', () => {
    const source = 'abcdef'
    const marked = decorate(source, [
      { severity: 'error', message: 'x', span: spanAt(2, 4) },
    ])
    expect(marked.filter((s) => s.severity === 'error').map((s) => source.slice(s.start, s.end))).toEqual(['cd'])
  })

  it('lets an error win over a warning on the same character', () => {
    const source = 'server api'
    const marked = decorate(source, [
      { severity: 'warning', message: 'w', span: spanAt(0, 6) },
      { severity: 'error', message: 'e', span: spanAt(0, 6) },
    ])
    expect(marked.find((s) => s.start === 0)?.severity).toBe('error')
  })

  /** A zero-width span, at end of input say, would otherwise underline nothing. */
  it('widens a zero-width diagnostic so it is visible', () => {
    const source = 'server'
    const marked = decorate(source, [
      { severity: 'error', message: 'x', span: spanAt(3, 3) },
    ])
    expect(marked.some((s) => s.severity === 'error')).toBe(true)
  })

  it('ignores a diagnostic pointing past the end of the source', () => {
    expect(() =>
      decorate('server', [{ severity: 'error', message: 'x', span: spanAt(99, 120) }])
    ).not.toThrow()
  })

  /** Wired to the real compiler, since that is what feeds it. */
  it('marks what the compiler actually complains about', () => {
    const source = 'notathing api\nserver web "Web"'
    const compiled = compileSource(source)
    const marked = decorate(source, compiled.diagnostics).filter((s) => s.severity)
    expect(marked.length).toBeGreaterThan(0)
    expect(source.slice(marked[0].start, marked[0].end)).toBe('notathing')
  })
})

describe('diagnosticsByLine', () => {
  it('groups by the line the diagnostic starts on', () => {
    const make = (line: number, message: string): Diagnostic => ({
      severity: 'error',
      message,
      span: {
        start: { offset: 0, line, column: 1 },
        end: { offset: 1, line, column: 2 },
      },
    })

    const grouped = diagnosticsByLine([make(2, 'a'), make(2, 'b'), make(5, 'c')])
    expect(grouped.get(2)?.map((d) => d.message)).toEqual(['a', 'b'])
    expect(grouped.get(5)?.map((d) => d.message)).toEqual(['c'])
    expect(grouped.get(1)).toBeUndefined()
  })

  it('returns an empty map for no diagnostics', () => {
    expect(diagnosticsByLine([]).size).toBe(0)
  })
})

describe('a realistic document', () => {
  const source = `# Photo sharing
diagram "Photos" {
  workload { dau 100M, peak 3x, reads 9:1, cache 80% }

  group dc "Data Center" : data-center {
    server api "API Server" { instances 3, type m5.large, service 25ms }
    postgresql db "Orders" { connectionPool 20, multiAz }
  }

  api -> db : TCP "query"
  api ~> mq : Kafka
}
`

  it('reproduces the source exactly', () => {
    expect(reassemble(source)).toBe(source)
  })

  it('classifies the interesting words correctly', () => {
    expect(kindOf(source, 'diagram')).toBe('keyword')
    expect(kindOf(source, 'group')).toBe('keyword')
    expect(kindOf(source, 'server')).toBe('component')
    expect(kindOf(source, 'postgresql')).toBe('component')
    expect(kindOf(source, 'instances')).toBe('property')
    expect(kindOf(source, 'm5.large')).toBe('value')
    expect(kindOf(source, 'data-center')).toBe('value')
    expect(kindOf(source, 'TCP')).toBe('value')
    expect(kindOf(source, '# Photo sharing')).toBe('comment')
  })

  it('uses every kind it claims to', () => {
    const kinds = new Set(highlight(source).map((s) => s.kind))
    for (const expected of [
      'comment', 'keyword', 'component', 'name', 'string',
      'number', 'unit', 'arrow', 'punctuation', 'property', 'value', 'plain',
    ]) {
      expect(kinds.has(expected as SegmentKind)).toBe(true)
    }
  })
})
