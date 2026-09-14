import { describe, it, expect } from 'vitest'
import { scaleNumber, tokenize } from './lexer'

/** Token kinds, with newlines dropped — most tests do not care about layout. */
const kinds = (source: string) =>
  tokenize(source)
    .tokens.filter((t) => t.kind !== 'newline' && t.kind !== 'eof')
    .map((t) => t.kind)

const texts = (source: string) =>
  tokenize(source)
    .tokens.filter((t) => t.kind !== 'newline' && t.kind !== 'eof')
    .map((t) => t.text)

const numberToken = (source: string) => tokenize(source).tokens[0]

describe('identifiers', () => {
  it('reads plain names', () => {
    expect(texts('server api')).toEqual(['server', 'api'])
  })

  /** Registry ids and instance types contain dashes and dots. */
  it('keeps dashes and dots inside one identifier', () => {
    expect(texts('load-balancer m5.large aws-ec2')).toEqual([
      'load-balancer',
      'm5.large',
      'aws-ec2',
    ])
  })

  it('does not start an identifier with a digit', () => {
    expect(kinds('2fast')).toEqual(['number'])
  })
})

describe('strings', () => {
  it('reads double and single quoted', () => {
    expect(texts('"API Server" \'Orders DB\'')).toEqual(['API Server', 'Orders DB'])
  })

  it('handles escapes that matter in a label', () => {
    expect(texts('"line\\nbreak"')).toEqual(['line\nbreak'])
    expect(texts('"say \\"hi\\""')).toEqual(['say "hi"'])
  })

  /** An unterminated string must not swallow the rest of the file. */
  it('stops an unterminated string at the newline and reports it', () => {
    const result = tokenize('"oops\nserver api')
    expect(result.diagnostics[0].message).toContain('Unterminated string')
    expect(result.tokens.map((t) => t.text)).toContain('server')
  })
})

describe('numbers and units', () => {
  it('reads a plain number', () => {
    expect(numberToken('42')).toMatchObject({ kind: 'number', value: 42, unit: 'none' })
  })

  it('reads a decimal', () => {
    expect(numberToken('2.5')).toMatchObject({ value: 2.5 })
  })

  it('scales counts', () => {
    expect(numberToken('100M')).toMatchObject({ value: 100_000_000, unit: 'count' })
    expect(numberToken('1k')).toMatchObject({ value: 1_000, unit: 'count' })
  })

  it('reads percentages as fractions', () => {
    expect(numberToken('80%')).toMatchObject({ value: 0.8, unit: 'percent' })
  })

  it('reads multipliers, times and days', () => {
    expect(numberToken('3x')).toMatchObject({ value: 3, unit: 'multiplier' })
    expect(numberToken('25ms')).toMatchObject({ value: 25, unit: 'ms' })
    expect(numberToken('2s')).toMatchObject({ value: 2000, unit: 'seconds' })
    expect(numberToken('365d')).toMatchObject({ value: 365, unit: 'days' })
  })

  /** Byte suffixes must win over count suffixes, or `kb` would read as `k`. */
  it('reads byte sizes in binary units', () => {
    expect(numberToken('1kb')).toMatchObject({ value: 1024, unit: 'bytes' })
    expect(numberToken('4mb')).toMatchObject({ value: 4 * 1024 * 1024, unit: 'bytes' })
  })

  // `1B users` is far more common in an architecture document than one byte.
  it('treats a bare b as billions', () => {
    expect(numberToken('2B')).toMatchObject({ value: 2e9, unit: 'count' })
  })

  /** `9:1` is one token — otherwise the colon would look like a protocol separator. */
  it('reads a ratio as a single token', () => {
    expect(numberToken('9:1')).toMatchObject({
      kind: 'number',
      value: 9,
      unit: 'ratio',
      ratioDenominator: 1,
    })
    expect(kinds('reads 9:1')).toEqual(['ident', 'number'])
  })

  it('reports an unknown unit but still produces a token', () => {
    const result = tokenize('10furlongs')
    expect(result.diagnostics[0].message).toContain('Unknown unit')
    expect(result.tokens[0].kind).toBe('number')
  })
})

describe('arrows and punctuation', () => {
  it('reads the three connection arrows', () => {
    expect(kinds('a -> b')).toEqual(['ident', 'arrow', 'ident'])
    expect(kinds('a ~> b')).toEqual(['ident', 'arrowAsync', 'ident'])
    expect(kinds('a <-> b')).toEqual(['ident', 'arrowBoth', 'ident'])
  })

  it('reads braces, commas and colons', () => {
    expect(kinds('{ a, b: c }')).toEqual([
      'lbrace',
      'ident',
      'comma',
      'ident',
      'colon',
      'ident',
      'rbrace',
    ])
  })
})

describe('comments', () => {
  it('ignores hash and slash comments', () => {
    expect(texts('# note\nserver api // trailing')).toEqual(['server', 'api'])
  })

  it('does not treat a hash inside a string as a comment', () => {
    expect(texts('"tag #1"')).toEqual(['tag #1'])
  })
})

describe('newlines', () => {
  /** Declarations are line-separated, so newlines are tokens rather than whitespace. */
  it('emits a newline token', () => {
    const result = tokenize('a\nb')
    expect(result.tokens.map((t) => t.kind)).toEqual(['ident', 'newline', 'ident', 'eof'])
  })

  it('collapses blank lines into one separator', () => {
    const result = tokenize('a\n\n\n\nb')
    expect(result.tokens.filter((t) => t.kind === 'newline')).toHaveLength(1)
  })
})

describe('positions', () => {
  /** Diagnostics are useless without accurate spans; the editor underlines from these. */
  it('tracks line and column across newlines', () => {
    const { tokens } = tokenize('server\n  api')
    expect(tokens[0].span.start).toMatchObject({ line: 1, column: 1, offset: 0 })
    expect(tokens[2].span.start).toMatchObject({ line: 2, column: 3 })
  })

  it('spans a token from its first to its last character', () => {
    const { tokens } = tokenize('redis')
    expect(tokens[0].span.start.offset).toBe(0)
    expect(tokens[0].span.end.offset).toBe(5)
  })

  it('always terminates with eof', () => {
    expect(tokenize('').tokens.map((t) => t.kind)).toEqual(['eof'])
  })
})

describe('scaleNumber', () => {
  it('returns ok for known suffixes and the empty suffix', () => {
    expect(scaleNumber(5, '')).toEqual({ value: 5, unit: 'none', ok: true })
    expect(scaleNumber(5, 'M').ok).toBe(true)
  })

  it('flags an unknown suffix without throwing', () => {
    expect(scaleNumber(5, 'zz')).toMatchObject({ value: 5, ok: false })
  })

  it('is case insensitive', () => {
    expect(scaleNumber(1, 'MB').value).toBe(1024 * 1024)
    expect(scaleNumber(1, 'mb').value).toBe(1024 * 1024)
  })
})

describe('a realistic document', () => {
  const source = `
# Photo sharing
diagram "Photos" {
  workload { dau 100M, peak 3x, reads 9:1, cache 80% }

  group dc "Data Center" {
    server api "API" { instances 3, type m5.large, service 25ms }
    postgresql db "Orders" { pool 20 }
  }

  api -> db : HTTP "query"
  api ~> mq : AMQP
}
`

  it('tokenizes without complaint', () => {
    expect(tokenize(source).diagnostics).toEqual([])
  })

  it('finds the pieces that matter', () => {
    const all = tokenize(source).tokens
    expect(all.some((t) => t.kind === 'arrow')).toBe(true)
    expect(all.some((t) => t.kind === 'arrowAsync')).toBe(true)
    expect(all.find((t) => t.text === 'm5.large')?.kind).toBe('ident')
    expect(all.find((t) => t.text === '9:1')?.unit).toBe('ratio')
  })
})
