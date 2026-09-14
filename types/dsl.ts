// ─── Archboard DSL ────────────────────────────────────────────────────────────
//
// A text form of an architecture. The point of inventing one rather than adopting
// Mermaid is that this can carry what Mermaid structurally cannot: a component type from
// the registry, its capacity, its connection pool, the workload. That makes the text
// runnable — parse it and the simulation can find the bottleneck.
//
// Deliberately absent: coordinates. Layout is derived and manual pins live in the document
// alongside the diagram, so the text stays a semantic document that diffs cleanly.

/** A position in the source, for editor diagnostics. */
export interface SourcePos {
  /** 0-based offset into the source string. */
  offset: number
  /** 1-based, because that is what editors and humans show. */
  line: number
  column: number
}

export interface SourceSpan {
  start: SourcePos
  end: SourcePos
}

// ─── tokens ───────────────────────────────────────────────────────────────────

export type TokenKind =
  | 'ident'
  | 'string'
  | 'number'
  | 'lbrace'
  | 'rbrace'
  | 'comma'
  | 'colon'
  /** `->` synchronous */
  | 'arrow'
  /** `~>` asynchronous */
  | 'arrowAsync'
  /** `<->` bidirectional */
  | 'arrowBoth'
  | 'newline'
  | 'eof'

/**
 * A recognised unit suffix.
 *
 * The language is mostly quantities, so units are lexed rather than parsed: `100M` and
 * `25ms` are single tokens, which keeps `dau 100M` from looking like two values.
 */
export type NumberUnit =
  | 'none'
  /** K, M, B, T */
  | 'count'
  | 'percent'
  /** 3x */
  | 'multiplier'
  | 'ms'
  | 'seconds'
  | 'bytes'
  | 'days'
  /** 9:1 */
  | 'ratio'

export interface Token {
  kind: TokenKind
  /** Raw source text. */
  text: string
  span: SourceSpan
  /** Set for `number`: the value already scaled by its unit. */
  value?: number
  unit?: NumberUnit
  /** Set for `ratio`: the right-hand side of `a:b`. */
  ratioDenominator?: number
}

// ─── diagnostics ──────────────────────────────────────────────────────────────

export type DiagnosticSeverity = 'error' | 'warning'

export interface Diagnostic {
  severity: DiagnosticSeverity
  message: string
  span: SourceSpan
  /** Short hint at the fix, shown under the message in the editor. */
  hint?: string
}

// ─── AST ──────────────────────────────────────────────────────────────────────

/** `key value` inside a `{ }` block. */
export interface PropertyNode {
  key: string
  /** Numbers keep their scaled value; bare words and strings stay strings. */
  value: string | number | boolean
  span: SourceSpan
  unit?: NumberUnit
  ratioDenominator?: number
}

/** `server api "API Server" { ... }` */
export interface ComponentDeclNode {
  kind: 'component'
  /** Registry component id — `server`, `redis`, `postgresql`. */
  componentType: string
  /** Local name, used to reference it in connections. */
  name: string
  label?: string
  properties: PropertyNode[]
  span: SourceSpan
  /** Span of just the type word, so an unknown component underlines precisely. */
  typeSpan: SourceSpan
}

/**
 * `shape hint "Add rate limiting" : note` — an annotation.
 *
 * Written with a keyword rather than as a bare `note hint "…"` so the shape names can never
 * collide with a registry component id. A component called `note` added to the library later
 * would otherwise silently change what existing documents mean.
 */
export interface ShapeDeclNode {
  kind: 'shape'
  name: string
  label?: string
  /** Shape kind — rectangle, note, text. Defaults to a rectangle. */
  shapeType?: string
  shapeTypeSpan?: SourceSpan
  properties: PropertyNode[]
  span: SourceSpan
}

/** `group dc "Data Center" : data-center { ... }` — a frame. Groups nest. */
export interface GroupDeclNode {
  kind: 'group'
  name: string
  label?: string
  /**
   * Frame kind — vpc, cluster, region.
   *
   * Written after a `:` rather than as a property inside the block, because a group body
   * holds declarations: `type vpc` on its own line would parse as a component named `vpc`.
   */
  frameType?: string
  frameTypeSpan?: SourceSpan
  children: DeclNode[]
  span: SourceSpan
}

export type ConnectionStyle = 'sync' | 'async' | 'both'

/** `api -> db : HTTP "query"` */
export interface ConnectionNode {
  kind: 'connection'
  from: string
  to: string
  style: ConnectionStyle
  protocol?: string
  label?: string
  properties: PropertyNode[]
  span: SourceSpan
  /** Spans of the endpoints, so an unknown name underlines the name itself. */
  fromSpan: SourceSpan
  toSpan: SourceSpan
}

/** `workload { dau 100M ... }` — feeds the capacity estimate. */
export interface WorkloadNode {
  kind: 'workload'
  properties: PropertyNode[]
  span: SourceSpan
}

export type DeclNode =
  | ComponentDeclNode
  | GroupDeclNode
  | ShapeDeclNode
  | ConnectionNode
  | WorkloadNode

export interface DiagramNode {
  kind: 'diagram'
  name?: string
  body: DeclNode[]
  span: SourceSpan
}

/**
 * A parse result.
 *
 * The AST is returned even when there are errors: a live editor has to render whatever was
 * understood so far, or the preview blanks on every half-typed line.
 */
export interface ParseResult {
  diagram: DiagramNode | null
  diagnostics: Diagnostic[]
}
