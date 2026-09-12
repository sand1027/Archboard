/**
 * Formatters and parsers for class members and ER columns.
 *
 * These back the "bulk edit" textareas on the canvas, and they are the reason
 * class/ER metadata is exportable at all: the legacy UmlClassNodeData stores
 * `attributes: string[]`, which cannot separate visibility from the display
 * string, so it cannot be rendered to Mermaid or PlantUML reliably.
 *
 * Parsing never throws. Unrecognised input degrades to a name-only member so a
 * user's half-typed line is preserved rather than discarded.
 */

import { generatePrefixedId } from '@/lib/canvas/ids'
import {
  VISIBILITY_SIGIL,
  type ClassField,
  type ClassMethod,
  type ErColumn,
  type MethodParam,
  type SchemaField,
  type Visibility,
} from '@/types/lld'

const SIGIL_TO_VISIBILITY: Record<string, Visibility> = {
  '+': 'public',
  '-': 'private',
  '#': 'protected',
  '~': 'package',
}

// ─── class fields ────────────────────────────────────────────────────────────

export function formatField(f: ClassField): string {
  const parts = [VISIBILITY_SIGIL[f.visibility]]
  if (f.isStatic) parts.push('static')
  parts.push(f.type ? `${f.name}: ${f.type}` : f.name)
  return parts.join(' ')
}

export function parseField(line: string): ClassField | null {
  const raw = line.trim()
  if (!raw) return null

  let rest = raw
  let visibility: Visibility = 'public'

  const sigil = rest[0]
  if (sigil && SIGIL_TO_VISIBILITY[sigil]) {
    visibility = SIGIL_TO_VISIBILITY[sigil]
    rest = rest.slice(1).trim()
  }

  let isStatic = false
  if (/^static\b/i.test(rest)) {
    isStatic = true
    rest = rest.replace(/^static\b/i, '').trim()
  }

  // Split on the LAST top-level colon so generics like List<Map<K,V>> survive.
  const idx = lastTopLevelColon(rest)
  const name = (idx === -1 ? rest : rest.slice(0, idx)).trim()
  const type = idx === -1 ? undefined : rest.slice(idx + 1).trim() || undefined

  if (!name) return null
  return { id: generatePrefixedId('f'), name, type, visibility, isStatic: isStatic || undefined }
}

export function formatFields(fields: ClassField[]): string {
  return fields.map(formatField).join('\n')
}

export function parseFields(text: string): ClassField[] {
  return text
    .split('\n')
    .map(parseField)
    .filter((f): f is ClassField => f !== null)
}

// ─── class methods ───────────────────────────────────────────────────────────

export function formatMethod(m: ClassMethod): string {
  const parts = [VISIBILITY_SIGIL[m.visibility]]
  if (m.isStatic) parts.push('static')
  if (m.isAbstract) parts.push('abstract')
  const params = m.params.map((p) => (p.type ? `${p.name}: ${p.type}` : p.name)).join(', ')
  parts.push(`${m.name}(${params})${m.returnType ? `: ${m.returnType}` : ''}`)
  return parts.join(' ')
}

export function parseMethod(line: string): ClassMethod | null {
  const raw = line.trim()
  if (!raw) return null

  let rest = raw
  let visibility: Visibility = 'public'

  const sigil = rest[0]
  if (sigil && SIGIL_TO_VISIBILITY[sigil]) {
    visibility = SIGIL_TO_VISIBILITY[sigil]
    rest = rest.slice(1).trim()
  }

  let isStatic = false
  let isAbstract = false
  // Modifiers may appear in either order.
  for (let i = 0; i < 2; i++) {
    if (/^static\b/i.test(rest)) {
      isStatic = true
      rest = rest.replace(/^static\b/i, '').trim()
    } else if (/^abstract\b/i.test(rest)) {
      isAbstract = true
      rest = rest.replace(/^abstract\b/i, '').trim()
    }
  }

  const open = rest.indexOf('(')
  const close = matchingParen(rest, open)

  if (open === -1 || close === -1) {
    // No parentheses — treat the whole thing as a zero-arg method.
    const idx = lastTopLevelColon(rest)
    const name = (idx === -1 ? rest : rest.slice(0, idx)).trim()
    if (!name) return null
    return {
      id: generatePrefixedId('m'),
      name,
      params: [],
      returnType: idx === -1 ? undefined : rest.slice(idx + 1).trim() || undefined,
      visibility,
      isStatic: isStatic || undefined,
      isAbstract: isAbstract || undefined,
    }
  }

  const name = rest.slice(0, open).trim()
  if (!name) return null

  const params = parseParams(rest.slice(open + 1, close))
  const after = rest.slice(close + 1).trim()
  const returnType = after.startsWith(':') ? after.slice(1).trim() || undefined : undefined

  return {
    id: generatePrefixedId('m'),
    name,
    params,
    returnType,
    visibility,
    isStatic: isStatic || undefined,
    isAbstract: isAbstract || undefined,
  }
}

function parseParams(inner: string): MethodParam[] {
  const trimmed = inner.trim()
  if (!trimmed) return []
  return splitTopLevel(trimmed, ',')
    .map((chunk): MethodParam | null => {
      const idx = lastTopLevelColon(chunk)
      const name = (idx === -1 ? chunk : chunk.slice(0, idx)).trim()
      const type = idx === -1 ? undefined : chunk.slice(idx + 1).trim() || undefined
      return name ? { name, type } : null
    })
    .filter((p): p is MethodParam => p !== null)
}

export function formatMethods(methods: ClassMethod[]): string {
  return methods.map(formatMethod).join('\n')
}

export function parseMethods(text: string): ClassMethod[] {
  return text
    .split('\n')
    .map(parseMethod)
    .filter((m): m is ClassMethod => m !== null)
}

// ─── ER columns ──────────────────────────────────────────────────────────────

export function formatColumn(c: ErColumn): string {
  const flags: string[] = []
  if (c.isPk) flags.push('pk')
  if (c.isFk) flags.push('fk')
  if (c.isUnique) flags.push('uq')
  if (c.isNullable) flags.push('null')
  const prefix = flags.length ? `${flags.join(' ')} ` : ''
  return `${prefix}${c.name}: ${c.type}`
}

const COLUMN_FLAGS = new Set(['pk', 'fk', 'uq', 'unique', 'null', 'nullable'])

export function parseColumn(line: string): ErColumn | null {
  const raw = line.trim()
  if (!raw) return null

  let rest = raw
  let isPk = false
  let isFk = false
  let isUnique = false
  let isNullable = false

  // Leading flag words, in any order.
  for (;;) {
    const m = rest.match(/^([A-Za-z]+)\s+/)
    if (!m || !COLUMN_FLAGS.has(m[1].toLowerCase())) break
    const flag = m[1].toLowerCase()
    if (flag === 'pk') isPk = true
    else if (flag === 'fk') isFk = true
    else if (flag === 'uq' || flag === 'unique') isUnique = true
    else isNullable = true
    rest = rest.slice(m[0].length)
  }

  const idx = lastTopLevelColon(rest)
  const name = (idx === -1 ? rest : rest.slice(0, idx)).trim()
  const type = idx === -1 ? '' : rest.slice(idx + 1).trim()

  if (!name) return null
  return {
    id: generatePrefixedId('c'),
    name,
    type: type || 'text',
    isPk: isPk || undefined,
    isFk: isFk || undefined,
    isUnique: isUnique || undefined,
    isNullable: isNullable || undefined,
  }
}

export function formatColumns(columns: ErColumn[]): string {
  return columns.map(formatColumn).join('\n')
}

export function parseColumns(text: string): ErColumn[] {
  return text
    .split('\n')
    .map(parseColumn)
    .filter((c): c is ErColumn => c !== null)
}

// ─── API schema fields ───────────────────────────────────────────────────────

export function formatSchemaField(f: SchemaField): string {
  return `${f.name}${f.required ? '' : '?'}: ${f.type}`
}

export function parseSchemaField(line: string): SchemaField | null {
  const raw = line.trim()
  if (!raw) return null

  const idx = lastTopLevelColon(raw)
  let name = (idx === -1 ? raw : raw.slice(0, idx)).trim()
  const type = idx === -1 ? 'string' : raw.slice(idx + 1).trim() || 'string'

  // Trailing `?` marks the field optional; absence means required.
  const optional = name.endsWith('?')
  if (optional) name = name.slice(0, -1).trim()

  if (!name) return null
  return { id: generatePrefixedId('sf'), name, type, required: !optional }
}

export function formatSchemaFields(fields: SchemaField[]): string {
  return fields.map(formatSchemaField).join('\n')
}

export function parseSchemaFields(text: string): SchemaField[] {
  return text
    .split('\n')
    .map(parseSchemaField)
    .filter((f): f is SchemaField => f !== null)
}

// ─── generic-aware string scanning ───────────────────────────────────────────

/** Index of the last `:` that is not nested inside <>, () or []. */
function lastTopLevelColon(s: string): number {
  let depth = 0
  let found = -1
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '<' || ch === '(' || ch === '[') depth++
    else if (ch === '>' || ch === ')' || ch === ']') depth--
    else if (ch === ':' && depth === 0) found = i
  }
  return found
}

/** Split on a separator that is not nested inside <>, () or []. */
function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '<' || ch === '(' || ch === '[') depth++
    else if (ch === '>' || ch === ')' || ch === ']') depth--
    else if (ch === sep && depth === 0) {
      out.push(s.slice(start, i))
      start = i + 1
    }
  }
  out.push(s.slice(start))
  return out.filter((c) => c.trim() !== '')
}

/** Index of the `)` matching the `(` at `open`, or -1. */
function matchingParen(s: string, open: number): number {
  if (open === -1) return -1
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}
