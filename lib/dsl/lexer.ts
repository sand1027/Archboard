import type {
  Diagnostic,
  NumberUnit,
  SourcePos,
  SourceSpan,
  Token,
  TokenKind,
} from '@/types/dsl'

/**
 * Tokenizer for the Archboard DSL.
 *
 * Newlines are tokens rather than whitespace. The language separates declarations by line
 * instead of by semicolon, which is what keeps `server api "API"` on one line from running
 * into the next declaration — and it means a missing brace produces a useful error instead
 * of swallowing the rest of the file.
 *
 * Units are lexed, not parsed. `100M` and `25ms` are single number tokens, so `dau 100M`
 * cannot be mistaken for two values, and the scaling lives in one place.
 */

const COUNT_SUFFIXES: Record<string, number> = {
  k: 1e3,
  m: 1e6,
  b: 1e9,
  t: 1e12,
}

const BYTE_SUFFIXES: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 ** 2,
  gb: 1024 ** 3,
  tb: 1024 ** 4,
}

/** Identifiers allow `-` and `.` so registry ids and instance types are single tokens. */
function isIdentStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch)
}

function isIdentPart(ch: string): boolean {
  return /[A-Za-z0-9_\-./]/.test(ch)
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

export interface LexResult {
  tokens: Token[]
  diagnostics: Diagnostic[]
  /**
   * Where the comments were.
   *
   * The parser has no use for these — comments are trivia — but the editor's highlighter
   * does, and recording them here keeps one definition of what a comment is instead of the
   * highlighter growing its own copy that can drift.
   */
  comments: SourceSpan[]
}

export function tokenize(source: string): LexResult {
  const tokens: Token[] = []
  const diagnostics: Diagnostic[] = []
  const comments: SourceSpan[] = []

  let offset = 0
  let line = 1
  let column = 1

  const pos = (): SourcePos => ({ offset, line, column })

  const advance = (count = 1) => {
    for (let i = 0; i < count; i++) {
      if (source[offset] === '\n') {
        line += 1
        column = 1
      } else {
        column += 1
      }
      offset += 1
    }
  }

  const push = (kind: TokenKind, text: string, start: SourcePos, extra?: Partial<Token>) => {
    tokens.push({ kind, text, span: { start, end: pos() }, ...extra })
  }

  const error = (message: string, span: SourceSpan, hint?: string) => {
    diagnostics.push({ severity: 'error', message, span, hint })
  }

  while (offset < source.length) {
    const start = pos()
    const ch = source[offset]

    // ── whitespace, excluding newlines ──
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      advance()
      continue
    }

    // ── newline: a real token, since declarations are line-separated ──
    if (ch === '\n') {
      advance()
      // Collapse blank lines: one separator is as good as ten, and it keeps the parser
      // from needing to skip runs of them everywhere.
      if (tokens[tokens.length - 1]?.kind !== 'newline') {
        push('newline', '\n', start)
      }
      continue
    }

    // ── comments: # or // to end of line ──
    if (ch === '#' || (ch === '/' && source[offset + 1] === '/')) {
      while (offset < source.length && source[offset] !== '\n') advance()
      comments.push({ start, end: pos() })
      continue
    }

    // ── strings ──
    if (ch === '"' || ch === "'") {
      const quote = ch
      advance()
      let text = ''
      let closed = false

      while (offset < source.length) {
        const current = source[offset]
        if (current === '\\' && offset + 1 < source.length) {
          // Only the two escapes that matter in a label.
          const next = source[offset + 1]
          text += next === 'n' ? '\n' : next
          advance(2)
          continue
        }
        if (current === quote) {
          advance()
          closed = true
          break
        }
        // An unterminated string must not eat the rest of the file.
        if (current === '\n') break
        text += current
        advance()
      }

      if (!closed) {
        error('Unterminated string.', { start, end: pos() }, 'Add the closing quote.')
      }
      push('string', text, start)
      continue
    }

    // ── numbers, with an optional unit suffix ──
    if (isDigit(ch)) {
      let raw = ''
      while (offset < source.length && (isDigit(source[offset]) || source[offset] === '.')) {
        raw += source[offset]
        advance()
      }

      // `9:1` — a ratio, not a number followed by a colon.
      if (source[offset] === ':' && isDigit(source[offset + 1] ?? '')) {
        advance()
        let denominator = ''
        while (offset < source.length && isDigit(source[offset])) {
          denominator += source[offset]
          advance()
        }
        push('number', `${raw}:${denominator}`, start, {
          value: Number(raw),
          unit: 'ratio',
          ratioDenominator: Number(denominator),
        })
        continue
      }

      // Unit suffix, if the next run of letters is one.
      let suffix = ''
      while (offset < source.length && /[A-Za-z%]/.test(source[offset])) {
        suffix += source[offset]
        advance()
      }

      const { value, unit, ok } = scaleNumber(Number(raw), suffix)
      if (!ok) {
        error(
          `Unknown unit "${suffix}".`,
          { start, end: pos() },
          'Try K, M, B, %, x, ms, s, kb, mb, gb or d.'
        )
      }
      push('number', raw + suffix, start, { value, unit })
      continue
    }

    // ── arrows ──
    if (ch === '<' && source.startsWith('<->', offset)) {
      advance(3)
      push('arrowBoth', '<->', start)
      continue
    }
    if (ch === '-' && source.startsWith('->', offset)) {
      advance(2)
      push('arrow', '->', start)
      continue
    }
    if (ch === '~' && source.startsWith('~>', offset)) {
      advance(2)
      push('arrowAsync', '~>', start)
      continue
    }

    // ── punctuation ──
    if (ch === '{') {
      advance()
      push('lbrace', '{', start)
      continue
    }
    if (ch === '}') {
      advance()
      push('rbrace', '}', start)
      continue
    }
    if (ch === ',') {
      advance()
      push('comma', ',', start)
      continue
    }
    if (ch === ':') {
      advance()
      push('colon', ':', start)
      continue
    }

    // ── identifiers ──
    if (isIdentStart(ch)) {
      let text = ''
      while (offset < source.length && isIdentPart(source[offset])) {
        text += source[offset]
        advance()
      }
      push('ident', text, start)
      continue
    }

    // ── anything else ──
    advance()
    error(
      `Unexpected character "${ch}".`,
      { start, end: pos() },
      'Names may contain letters, digits, dots and dashes.'
    )
  }

  tokens.push({ kind: 'eof', text: '', span: { start: pos(), end: pos() } })
  return { tokens, diagnostics, comments }
}

/** Apply a unit suffix. `ok: false` means the suffix was not recognised. */
export function scaleNumber(
  base: number,
  suffix: string
): { value: number; unit: NumberUnit; ok: boolean } {
  if (!suffix) return { value: base, unit: 'none', ok: true }

  const lower = suffix.toLowerCase()

  if (lower === '%') return { value: base / 100, unit: 'percent', ok: true }
  if (lower === 'x') return { value: base, unit: 'multiplier', ok: true }
  if (lower === 'ms') return { value: base, unit: 'ms', ok: true }
  if (lower === 's') return { value: base * 1000, unit: 'seconds', ok: true }
  if (lower === 'd') return { value: base, unit: 'days', ok: true }

  // Bytes before counts, so `kb` is not read as `k`.
  if (lower in BYTE_SUFFIXES && lower !== 'b') {
    return { value: base * BYTE_SUFFIXES[lower], unit: 'bytes', ok: true }
  }
  if (lower in COUNT_SUFFIXES) {
    return { value: base * COUNT_SUFFIXES[lower], unit: 'count', ok: true }
  }
  // `b` alone is ambiguous between bytes and billions; count wins, since `1B users` is the
  // far more common thing to write in an architecture document.
  if (lower === 'b') return { value: base * COUNT_SUFFIXES.b, unit: 'count', ok: true }

  return { value: base, unit: 'none', ok: false }
}
