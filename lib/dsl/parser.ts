import type {
  ComponentDeclNode,
  ConnectionNode,
  ConnectionStyle,
  DeclNode,
  Diagnostic,
  GroupDeclNode,
  ParseResult,
  PropertyNode,
  ShapeDeclNode,
  SourceSpan,
  Token,
  WorkloadNode,
} from '@/types/dsl'
import { tokenize } from './lexer'

/**
 * Parser for the Archboard DSL.
 *
 * Built to recover rather than to stop. A live editor is almost always looking at an
 * unfinished document, so bailing on the first mistake would mean the preview blanks on
 * every half-typed line and only ever shows you one error at a time. Instead each
 * declaration is parsed independently: a bad one is reported and skipped to the next line,
 * and everything else still compiles.
 */

const GROUP_KEYWORD = 'group'
const SHAPE_KEYWORD = 'shape'
const WORKLOAD_KEYWORD = 'workload'
const DIAGRAM_KEYWORD = 'diagram'

export function parse(source: string): ParseResult {
  const { tokens, diagnostics } = tokenize(source)
  return new Parser(tokens, diagnostics).parseDocument()
}

class Parser {
  private index = 0

  constructor(
    private readonly tokens: Token[],
    private readonly diagnostics: Diagnostic[]
  ) {}

  // ── token helpers ───────────────────────────────────────────────────────────

  private peek(ahead = 0): Token {
    return this.tokens[Math.min(this.index + ahead, this.tokens.length - 1)]
  }

  private at(kind: Token['kind']): boolean {
    return this.peek().kind === kind
  }

  private next(): Token {
    const token = this.peek()
    if (this.index < this.tokens.length - 1) this.index += 1
    return token
  }

  private skipNewlines(): void {
    while (this.at('newline')) this.next()
  }

  private error(message: string, span: SourceSpan, hint?: string): void {
    this.diagnostics.push({ severity: 'error', message, span, hint })
  }

  private spanFrom(start: Token, end: Token = this.tokens[this.index - 1] ?? start): SourceSpan {
    return { start: start.span.start, end: end.span.end }
  }

  /**
   * Skip to the start of the next declaration after an error.
   *
   * Brace depth is tracked so a broken declaration containing a block does not leave the
   * parser inside that block, reading its properties as top-level declarations.
   */
  private recover(): void {
    let depth = 0
    while (!this.at('eof')) {
      const token = this.peek()
      if (token.kind === 'lbrace') depth += 1
      if (token.kind === 'rbrace') {
        if (depth === 0) return
        depth -= 1
      }
      if (token.kind === 'newline' && depth === 0) {
        this.next()
        return
      }
      this.next()
    }
  }

  // ── document ────────────────────────────────────────────────────────────────

  parseDocument(): ParseResult {
    this.skipNewlines()

    // `diagram "Name" { ... }` is optional. A bare list of declarations is a diagram too —
    // requiring the wrapper would make the smallest useful document three lines instead of one.
    if (this.at('ident') && this.peek().text === DIAGRAM_KEYWORD) {
      const start = this.next()
      const name = this.at('string') ? this.next().text : undefined

      if (!this.expectBrace()) {
        return { diagram: { kind: 'diagram', name, body: [], span: this.spanFrom(start) }, diagnostics: this.diagnostics }
      }

      const body = this.parseDeclList('rbrace')
      this.expect('rbrace', 'Expected "}" to close the diagram.')

      return {
        diagram: { kind: 'diagram', name, body, span: this.spanFrom(start) },
        diagnostics: this.diagnostics,
      }
    }

    const start = this.peek()
    const body = this.parseDeclList('eof')
    return {
      diagram: { kind: 'diagram', body, span: this.spanFrom(start) },
      diagnostics: this.diagnostics,
    }
  }

  private parseDeclList(terminator: 'rbrace' | 'eof'): DeclNode[] {
    const decls: DeclNode[] = []

    while (true) {
      this.skipNewlines()
      if (this.at('eof')) break
      if (terminator === 'rbrace' && this.at('rbrace')) break

      const before = this.index
      const decl = this.parseDecl()
      if (decl) decls.push(decl)

      // Guarantee forward progress. Without this a declaration that consumed nothing would
      // spin here forever on malformed input.
      if (this.index === before) this.next()
    }

    return decls
  }

  private parseDecl(): DeclNode | null {
    const token = this.peek()

    if (token.kind !== 'ident') {
      this.error(`Expected a declaration, found "${token.text || 'end of file'}".`, token.span,
        'Declarations look like: server api "API Server"')
      this.recover()
      return null
    }

    if (token.text === WORKLOAD_KEYWORD) return this.parseWorkload()
    if (token.text === GROUP_KEYWORD) return this.parseGroup()
    // `shape` only leads a declaration when a name follows. Bare `shape` is a component
    // reference in `shape -> api`, and a name is a name.
    if (token.text === SHAPE_KEYWORD && this.peek(1).kind === 'ident') return this.parseShape()

    // A connection starts with a name followed by an arrow; a component with a type followed
    // by a name. One token of lookahead separates them.
    const after = this.peek(1).kind
    if (after === 'arrow' || after === 'arrowAsync' || after === 'arrowBoth') {
      return this.parseConnection()
    }

    return this.parseComponent()
  }

  // ── declarations ────────────────────────────────────────────────────────────

  private parseComponent(): ComponentDeclNode | null {
    const typeToken = this.next()

    if (!this.at('ident')) {
      this.error(
        `Expected a name after "${typeToken.text}".`,
        this.peek().span,
        'Write the component type then a name: server api "API Server"'
      )
      this.recover()
      return null
    }
    const nameToken = this.next()
    const label = this.at('string') ? this.next().text : undefined
    const properties = this.at('lbrace') ? this.parseBlock() : []

    return {
      kind: 'component',
      componentType: typeToken.text,
      name: nameToken.text,
      label,
      properties,
      span: this.spanFrom(typeToken),
      typeSpan: typeToken.span,
    }
  }

  private parseGroup(): GroupDeclNode | null {
    const start = this.next()

    if (!this.at('ident')) {
      this.error('Expected a name after "group".', this.peek().span,
        'Groups look like: group dc "Data Center" { ... }')
      this.recover()
      return null
    }
    const nameToken = this.next()
    const label = this.at('string') ? this.next().text : undefined

    // `: vpc` — the frame kind. Same `:` idiom as a connection's protocol.
    let frameType: string | undefined
    let frameTypeSpan: SourceSpan | undefined
    if (this.at('colon')) {
      this.next()
      if (this.at('ident')) {
        const typeToken = this.next()
        frameType = typeToken.text
        frameTypeSpan = typeToken.span
      } else {
        this.error('Expected a frame type after ":".', this.peek().span,
          'For example: group net "Network" : vpc { ... }')
      }
    }

    if (!this.expectBrace()) return null

    // Recursive, so groups nest — which matches how frames actually contain sub-frames.
    const children = this.parseDeclList('rbrace')
    this.expect('rbrace', 'Expected "}" to close the group.')

    return {
      kind: 'group',
      name: nameToken.text,
      label,
      frameType,
      frameTypeSpan,
      children,
      span: this.spanFrom(start),
    }
  }

  /** `shape hint "Add rate limiting" : note { fill #fff }` */
  private parseShape(): ShapeDeclNode | null {
    const start = this.next()

    if (!this.at('ident')) {
      this.error('Expected a name after "shape".', this.peek().span,
        'Shapes look like: shape hint "Remember this" : note')
      this.recover()
      return null
    }
    const nameToken = this.next()
    const label = this.at('string') ? this.next().text : undefined

    // `: note` — same `:` idiom as a group's frame type.
    let shapeType: string | undefined
    let shapeTypeSpan: SourceSpan | undefined
    if (this.at('colon')) {
      this.next()
      if (this.at('ident')) {
        const typeToken = this.next()
        shapeType = typeToken.text
        shapeTypeSpan = typeToken.span
      } else {
        this.error('Expected a shape type after ":".', this.peek().span,
          'For example: shape hint "Note" : note')
      }
    }

    const properties = this.at('lbrace') ? this.parseBlock() : []

    return {
      kind: 'shape',
      name: nameToken.text,
      label,
      shapeType,
      shapeTypeSpan,
      properties,
      span: this.spanFrom(start),
    }
  }

  private parseWorkload(): WorkloadNode | null {
    const start = this.next()
    if (!this.expectBrace()) return null

    const properties = this.parseBlockBody()
    this.expect('rbrace', 'Expected "}" to close the workload block.')

    return { kind: 'workload', properties, span: this.spanFrom(start) }
  }

  private parseConnection(): ConnectionNode | null {
    const fromToken = this.next()
    const arrow = this.next()

    const style: ConnectionStyle =
      arrow.kind === 'arrowAsync' ? 'async' : arrow.kind === 'arrowBoth' ? 'both' : 'sync'

    if (!this.at('ident')) {
      this.error(
        `Expected a component name after "${arrow.text}".`,
        this.peek().span,
        'Connections look like: api -> db : HTTP "query"'
      )
      this.recover()
      return null
    }
    const toToken = this.next()

    let protocol: string | undefined
    let label: string | undefined

    // `: HTTP "query"` — both parts optional, in that order.
    if (this.at('colon')) {
      this.next()
      if (this.at('ident')) protocol = this.next().text
      if (this.at('string')) label = this.next().text

      if (!protocol && !label) {
        this.error('Expected a protocol or label after ":".', this.peek().span,
          'For example: api -> db : HTTP "query"')
      }
    } else if (this.at('string')) {
      // A label with no protocol is common enough to allow without the colon.
      label = this.next().text
    }

    const properties = this.at('lbrace') ? this.parseBlock() : []

    return {
      kind: 'connection',
      from: fromToken.text,
      to: toToken.text,
      style,
      protocol,
      label,
      properties,
      span: this.spanFrom(fromToken),
      fromSpan: fromToken.span,
      toSpan: toToken.span,
    }
  }

  // ── blocks and properties ───────────────────────────────────────────────────

  private expectBrace(): boolean {
    if (this.at('lbrace')) {
      this.next()
      return true
    }
    this.error('Expected "{".', this.peek().span)
    this.recover()
    return false
  }

  private expect(kind: Token['kind'], message: string): void {
    if (this.at(kind)) {
      this.next()
      return
    }
    this.error(message, this.peek().span)
  }

  private parseBlock(): PropertyNode[] {
    this.next() // consume `{`
    const properties = this.parseBlockBody()
    this.expect('rbrace', 'Expected "}" to close the block.')
    return properties
  }

  /**
   * `key value` pairs, separated by commas or newlines.
   *
   * Both separators are accepted because a short block reads better inline
   * (`{ instances 3, type m5.large }`) and a long one reads better across lines.
   */
  private parseBlockBody(): PropertyNode[] {
    const properties: PropertyNode[] = []

    while (!this.at('rbrace') && !this.at('eof')) {
      if (this.at('newline') || this.at('comma')) {
        this.next()
        continue
      }

      if (!this.at('ident')) {
        this.error(`Expected a property name, found "${this.peek().text}".`, this.peek().span)
        this.next()
        continue
      }

      const keyToken = this.next()
      const property = this.parsePropertyValue(keyToken)
      if (property) properties.push(property)
    }

    return properties
  }

  private parsePropertyValue(keyToken: Token): PropertyNode | null {
    const valueToken = this.peek()

    if (valueToken.kind === 'number') {
      this.next()
      return {
        key: keyToken.text,
        value: valueToken.value ?? 0,
        unit: valueToken.unit,
        ratioDenominator: valueToken.ratioDenominator,
        span: this.spanFrom(keyToken),
      }
    }

    if (valueToken.kind === 'string') {
      this.next()
      return { key: keyToken.text, value: valueToken.text, span: this.spanFrom(keyToken) }
    }

    if (valueToken.kind === 'ident') {
      this.next()
      // `true`/`false` are spelled as bare words, so they arrive as idents.
      const lower = valueToken.text.toLowerCase()
      const value = lower === 'true' ? true : lower === 'false' ? false : valueToken.text
      return { key: keyToken.text, value, span: this.spanFrom(keyToken) }
    }

    // A key with no value is treated as a flag. `multiAz` alone is clearer than `multiAz true`.
    return { key: keyToken.text, value: true, span: keyToken.span }
  }
}
