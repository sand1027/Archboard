import type { Diagnostic, DiagnosticSeverity, Token } from '@/types/dsl'
import { tokenize } from './lexer'

/**
 * Syntax highlighting for the DSL editor.
 *
 * Built on the same `tokenize` the parser uses, which is the whole point: a second
 * tokenizer written for an editor library would be a copy of the language definition free to
 * drift from the real one, so text could highlight as valid while failing to parse.
 *
 * Roles are assigned by a light contextual pass rather than a full parse. Highlighting is
 * decoration — if a half-typed line colours a word as a component that turns out to be a
 * property, nothing breaks, and the parser still has the last word on meaning.
 */

export type SegmentKind =
  | 'comment'
  /** `diagram`, `group`, `workload`. */
  | 'keyword'
  /** A registry component id — the first word of a declaration. */
  | 'component'
  /** The local name a connection refers to. */
  | 'name'
  | 'string'
  | 'number'
  /** The unit suffix on a number, dimmed so `100M` reads as one value. */
  | 'unit'
  | 'arrow'
  | 'punctuation'
  /** A key inside a `{ }` block. */
  | 'property'
  /** A bare-word value, or a protocol or frame type after `:`. */
  | 'value'
  /** Whitespace and anything unclassified. */
  | 'plain'

export interface Segment {
  start: number
  end: number
  kind: SegmentKind
  /** Set when a diagnostic covers this segment, so the editor can underline it. */
  severity?: DiagnosticSeverity
}

const KEYWORDS = new Set(['diagram', 'group', 'shape', 'workload'])

/** What a `{` opened: a list of declarations, or a list of key/value pairs. */
type BlockKind = 'declarations' | 'properties'

/**
 * Split the source into styled segments covering every character.
 *
 * Full coverage, including whitespace, so the renderer is a plain map over the list and
 * cannot lose or reorder text — which in an overlay editor would visibly desynchronise the
 * highlight from the caret.
 */
export function highlight(source: string): Segment[] {
  const { tokens, comments } = tokenize(source)
  const spans: Segment[] = []

  // A stack, so a properties block inside a group body pops back to declarations.
  const blocks: BlockKind[] = ['declarations']
  /** How many idents this declaration has had so far. */
  let identsThisLine = 0
  /** True once an arrow appears, which makes this line a connection. */
  let lineIsConnection = false
  /** True right after a `:`, where a protocol or frame type is expected. */
  let afterColon = false
  /** True right after a property key, where its value is expected. */
  let expectValue = false
  /** Set when the current line is a `group` or `diagram`, whose `{` opens declarations. */
  let lineOpensDeclarations = false

  /** What an identifier means, from where it sits. */
  const identRole = (token: Token, block: BlockKind): SegmentKind => {
    // `: HTTP` or `: vpc`.
    if (afterColon) {
      afterColon = false
      return 'value'
    }

    if (block === 'properties') {
      if (expectValue) {
        expectValue = false
        return 'value'
      }
      expectValue = true
      return 'property'
    }

    // A keyword only leads a declaration. On a connection line the same word is an ordinary
    // reference — `shape -> api` names something called `shape` — which is how the parser
    // reads it too.
    if (KEYWORDS.has(token.text) && identsThisLine === 0 && !lineIsConnection) {
      identsThisLine += 1
      // `group` and `diagram` open a body of declarations. `workload` and `shape` open
      // properties, so their blocks must not be treated as a declaration list.
      if (token.text === 'group' || token.text === 'diagram') lineOpensDeclarations = true
      return 'keyword'
    }

    identsThisLine += 1
    // The first word is the component type — unless an arrow made this a connection, in
    // which case it is a reference to something declared elsewhere.
    if (identsThisLine === 1) return lineIsConnection ? 'name' : 'component'
    return 'name'
  }

  const endLine = () => {
    identsThisLine = 0
    lineIsConnection = false
    afterColon = false
    expectValue = false
  }

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    if (token.kind === 'eof') break

    if (token.kind === 'newline') {
      endLine()
      continue
    }

    const block = blocks[blocks.length - 1]

    // Whether this is a connection has to be known before its first word is classified —
    // in `api -> db`, `api` is a reference, but the arrow proving it comes later. So look
    // ahead once per line rather than discovering it too late.
    if (identsThisLine === 0 && !lineIsConnection) {
      lineIsConnection = lineHasArrow(tokens, index)
    }

    switch (token.kind) {
      case 'lbrace':
        push(spans, token, 'punctuation')
        blocks.push(lineOpensDeclarations ? 'declarations' : 'properties')
        lineOpensDeclarations = false
        endLine()
        break

      case 'rbrace':
        push(spans, token, 'punctuation')
        if (blocks.length > 1) blocks.pop()
        endLine()
        break

      case 'comma':
        push(spans, token, 'punctuation')
        // Commas separate properties, so the next ident is a key again.
        expectValue = false
        break

      case 'colon':
        push(spans, token, 'punctuation')
        afterColon = true
        break

      case 'arrow':
      case 'arrowAsync':
      case 'arrowBoth':
        push(spans, token, 'arrow')
        lineIsConnection = true
        break

      case 'string':
        push(spans, token, 'string')
        expectValue = false
        break

      case 'number':
        pushNumber(spans, token)
        expectValue = false
        break

      case 'ident':
        push(spans, token, identRole(token, block))
        break
    }
  }

  for (const comment of comments) {
    spans.push({ start: comment.start.offset, end: comment.end.offset, kind: 'comment' })
  }

  spans.sort((a, b) => a.start - b.start)
  return fillGaps(spans, source.length)
}

/**
 * Highlight, then mark the parts a diagnostic covers.
 *
 * Segments are split at diagnostic boundaries rather than underlined from a separate
 * absolutely-positioned layer, which would have to re-measure text to stay aligned.
 */
export function decorate(source: string, diagnostics: Diagnostic[]): Segment[] {
  const segments = highlight(source)
  if (diagnostics.length === 0) return segments

  const marks = diagnostics
    .map((d) => ({
      start: d.span.start.offset,
      // A zero-width span — at end of input, say — would be invisible.
      end: Math.max(d.span.end.offset, d.span.start.offset + 1),
      severity: d.severity,
    }))
    .filter((m) => m.end > m.start)

  const out: Segment[] = []

  for (const segment of segments) {
    // Cut points inside this segment, so an underline can start mid-token.
    const cuts = new Set<number>([segment.start, segment.end])
    for (const mark of marks) {
      if (mark.start > segment.start && mark.start < segment.end) cuts.add(mark.start)
      if (mark.end > segment.start && mark.end < segment.end) cuts.add(mark.end)
    }

    const points = [...cuts].sort((a, b) => a - b)
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i]
      const end = points[i + 1]
      // Errors win over warnings where both cover the same character.
      const covering = marks.filter((m) => m.start < end && m.end > start)
      const severity = covering.some((m) => m.severity === 'error')
        ? 'error'
        : covering.length > 0
          ? 'warning'
          : undefined

      out.push({ start, end, kind: segment.kind, ...(severity ? { severity } : {}) })
    }
  }

  return out
}

/** Diagnostics grouped by 1-based line, for the gutter. */
export function diagnosticsByLine(diagnostics: Diagnostic[]): Map<number, Diagnostic[]> {
  const out = new Map<number, Diagnostic[]>()
  for (const diagnostic of diagnostics) {
    const line = diagnostic.span.start.line
    out.set(line, [...(out.get(line) ?? []), diagnostic])
  }
  return out
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Is there an arrow between here and the end of this line? */
function lineHasArrow(tokens: Token[], from: number): boolean {
  for (let i = from; i < tokens.length; i++) {
    const kind = tokens[i].kind
    if (kind === 'newline' || kind === 'eof') return false
    // A block opens a new context, so an arrow inside it belongs to a different line.
    if (kind === 'lbrace') return false
    if (kind === 'arrow' || kind === 'arrowAsync' || kind === 'arrowBoth') return true
  }
  return false
}

function push(spans: Segment[], token: Token, kind: SegmentKind): void {
  spans.push({ start: token.span.start.offset, end: token.span.end.offset, kind })
}

/** A number and its unit are separate segments, so `100M` can dim the `M`. */
function pushNumber(spans: Segment[], token: Token): void {
  const start = token.span.start.offset
  const end = token.span.end.offset
  const digits = /^[0-9.]*(:[0-9]+)?/.exec(token.text)?.[0].length ?? token.text.length

  if (digits >= token.text.length) {
    spans.push({ start, end, kind: 'number' })
    return
  }
  spans.push({ start, end: start + digits, kind: 'number' })
  spans.push({ start: start + digits, end, kind: 'unit' })
}

/** Cover the whitespace between tokens so the segment list spans the whole source. */
function fillGaps(spans: Segment[], length: number): Segment[] {
  const out: Segment[] = []
  let cursor = 0

  for (const span of spans) {
    // Comments sit where the lexer skipped ahead, so a token can already cover this range.
    if (span.start < cursor) continue
    if (span.start > cursor) out.push({ start: cursor, end: span.start, kind: 'plain' })
    out.push(span)
    cursor = span.end
  }

  if (cursor < length) out.push({ start: cursor, end: length, kind: 'plain' })
  return out
}
