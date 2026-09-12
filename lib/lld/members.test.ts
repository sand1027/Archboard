import { describe, it, expect } from 'vitest'
import {
  formatField,
  parseField,
  formatMethod,
  parseMethod,
  formatColumn,
  parseColumn,
  formatSchemaField,
  parseSchemaField,
  parseFields,
  parseMethods,
  parseColumns,
} from './members'

/** format(parse(s)) === s is the property that keeps bulk editing lossless. */
function roundTripsField(s: string) {
  const parsed = parseField(s)
  expect(parsed, s).not.toBeNull()
  return formatField(parsed!)
}

function roundTripsMethod(s: string) {
  const parsed = parseMethod(s)
  expect(parsed, s).not.toBeNull()
  return formatMethod(parsed!)
}

describe('class fields', () => {
  it.each([
    '+ id: string',
    '- count: int',
    '# name: string',
    '~ internal: boolean',
    '+ items: List<Order>',
    '- static instances: int',
    '+ lookup: Map<string, List<Order>>',
  ])('round-trips %s', (line) => {
    expect(roundTripsField(line)).toBe(line)
  })

  it('defaults to public when no sigil is present', () => {
    expect(parseField('id: string')?.visibility).toBe('public')
  })

  it('keeps a name-only field rather than discarding it', () => {
    const f = parseField('justAName')
    expect(f).toMatchObject({ name: 'justAName', type: undefined, visibility: 'public' })
  })

  it('splits on the last top-level colon so generics survive', () => {
    expect(parseField('+ m: Map<string, int>')).toMatchObject({
      name: 'm',
      type: 'Map<string, int>',
    })
  })

  it('ignores blank lines', () => {
    expect(parseField('   ')).toBeNull()
    expect(parseFields('+ a: int\n\n\n- b: int')).toHaveLength(2)
  })

  it('marks static', () => {
    expect(parseField('- static count: int')?.isStatic).toBe(true)
  })
})

describe('class methods', () => {
  it.each([
    '+ execute(): void',
    '- reset()',
    '# abstract render(ctx: Ctx): void',
    '+ find(id: string, opts: Options): Order',
    '+ static create(): Builder',
    '+ map(fn: (a: int) => int): List<int>',
  ])('round-trips %s', (line) => {
    expect(roundTripsMethod(line)).toBe(line)
  })

  it('parses parameters with names and types', () => {
    const m = parseMethod('+ find(id: string, limit: int): Order')
    expect(m?.params).toEqual([
      { name: 'id', type: 'string' },
      { name: 'limit', type: 'int' },
    ])
    expect(m?.returnType).toBe('Order')
  })

  it('handles an empty parameter list', () => {
    expect(parseMethod('+ ping(): pong')?.params).toEqual([])
  })

  it('does not split parameters inside generics', () => {
    const m = parseMethod('+ merge(a: Map<string, int>, b: List<int>): void')
    expect(m?.params).toHaveLength(2)
    expect(m?.params[0].type).toBe('Map<string, int>')
  })

  it('accepts static and abstract in either order', () => {
    expect(parseMethod('+ static abstract go(): void')).toMatchObject({
      isStatic: true,
      isAbstract: true,
    })
    expect(parseMethod('+ abstract static go(): void')).toMatchObject({
      isStatic: true,
      isAbstract: true,
    })
  })

  it('tolerates a missing parameter list', () => {
    expect(parseMethod('+ bare: int')).toMatchObject({
      name: 'bare',
      returnType: 'int',
      params: [],
    })
  })

  it('ignores blank lines', () => {
    expect(parseMethods('+ a(): void\n\n+ b(): void')).toHaveLength(2)
  })
})

describe('ER columns', () => {
  it.each([
    'pk id: uuid',
    'fk user_id: uuid',
    'uq email: text',
    'null deleted_at: timestamp',
    'created_at: timestamp',
    'pk fk composite: uuid',
  ])('round-trips %s', (line) => {
    const c = parseColumn(line)
    expect(c, line).not.toBeNull()
    expect(formatColumn(c!)).toBe(line)
  })

  it('parses flags in any order', () => {
    expect(parseColumn('fk pk x: int')).toMatchObject({ isPk: true, isFk: true })
  })

  it('accepts unique and nullable long forms', () => {
    expect(parseColumn('unique email: text')?.isUnique).toBe(true)
    expect(parseColumn('nullable note: text')?.isNullable).toBe(true)
  })

  it('defaults an unspecified type to text', () => {
    expect(parseColumn('name')?.type).toBe('text')
  })

  it('does not mistake a column named like a flag for a flag', () => {
    // "pk" alone is the column name, not a flag, because no name follows it.
    expect(parseColumn('pk')).toMatchObject({ name: 'pk', isPk: undefined })
  })

  it('ignores blank lines', () => {
    expect(parseColumns('pk id: uuid\n\nname: text')).toHaveLength(2)
  })
})

describe('API schema fields', () => {
  it('treats a trailing ? as optional and its absence as required', () => {
    expect(parseSchemaField('email: string')).toMatchObject({ required: true })
    expect(parseSchemaField('nickname?: string')).toMatchObject({ required: false })
  })

  it.each(['email: string', 'nickname?: string', 'tags: string[]'])(
    'round-trips %s',
    (line) => {
      const f = parseSchemaField(line)
      expect(f, line).not.toBeNull()
      expect(formatSchemaField(f!)).toBe(line)
    }
  )

  it('defaults an unspecified type to string', () => {
    expect(parseSchemaField('name')?.type).toBe('string')
  })
})
