import type { Connection } from '@xyflow/react'
import type {
  ArchitectureEdge,
  ArchitectureNode,
  ArchitectureNodeData,
  ConfigValue,
  FrameNodeData,
  ShapeNodeData,
} from '@/types'
import type { WorkloadInputs } from '@/types/estimate'
import { getComponentById } from '@/data/components'
import { inferConnection } from '@/lib/canvas/inferConnection'
import type { GroupMap } from '@/lib/simulation/groups'
import { centerInside, nodeBounds } from '@/lib/canvas/geometry'

/**
 * Canvas to text.
 *
 * The migration path: every diagram that already exists gets code for free, so the editor
 * is not a second, empty world you have to start from scratch in.
 *
 * Two rules keep the output worth reading. Containment is recovered with the same
 * geometric rule the rest of the app uses (`buildGroups`), so what looks inside a frame
 * prints inside that group. And nothing is printed that the compiler could work out for
 * itself — an edge whose protocol and label match what `inferConnection` would infer prints
 * as a bare `api -> db`. That keeps the text short while still round-tripping exactly,
 * because anything inference would get wrong *is* printed.
 */

const DEFAULT_INDENT = '  '

/**
 * Node types with a text form.
 *
 * UML and icon nodes belong to the LLD board and have their own grammar still to come, so
 * they are reported as skipped rather than guessed at.
 */
const PRINTABLE_TYPES = new Set(['architecture', 'frame', 'shape'])

/** Shape styling worth printing, in the order it reads best. */
const SHAPE_STYLE_KEYS = [
  'fill',
  'fillOpacity',
  'stroke',
  'strokeWidth',
  'strokeStyle',
  'opacity',
  'cornerRadius',
  'fontSize',
  'fontWeight',
  'textAlign',
  'textColor',
] as const

/** Defaults the canvas stamps on every shape. Printing them back would be pure noise. */
/** Must match SHAPE_SIZES in compile.ts, so a size is printed only when it was set. */
const NATURAL_SHAPE_SIZES: Record<string, { w: number; h: number }> = {
  rectangle: { w: 160, h: 100 },
  ellipse: { w: 160, h: 100 },
  diamond: { w: 140, h: 100 },
  triangle: { w: 140, h: 110 },
  parallelogram: { w: 160, h: 80 },
  cylinder: { w: 120, h: 130 },
  hexagon: { w: 140, h: 120 },
  star: { w: 120, h: 120 },
  arrow: { w: 160, h: 40 },
  line: { w: 160, h: 40 },
  text: { w: 96, h: 28 },
  terminator: { w: 140, h: 56 },
  document: { w: 150, h: 110 },
  preparation: { w: 150, h: 90 },
  connector: { w: 48, h: 48 },
  note: { w: 140, h: 100 },
}

const SHAPE_STYLE_DEFAULTS: Record<string, string | number> = {
  fillOpacity: 1,
  strokeWidth: 1.5,
  strokeStyle: 'solid',
  opacity: 100,
  cornerRadius: 0,
  fontSize: 10,
  fontWeight: 'normal',
  textAlign: 'left',
}

export interface PrintOptions {
  /** Emitted as `diagram "Name" { … }`. Without it, a bare declaration list is printed. */
  name?: string
  workload?: WorkloadInputs
  indent?: string
  /**
   * Known containment, child node id to frame node id.
   *
   * Given, it wins over the geometric recovery. A freshly compiled diagram has no geometry
   * yet — every node sits at the origin until layout runs — so printing it back would
   * otherwise flatten every group. The editor has this in hand from `compile`.
   */
  hierarchy?: Record<string, string>
}

/** Something on the canvas that the language cannot express. */
export interface SkippedItem {
  id: string
  kind: 'node' | 'edge'
  /** React Flow node type, or 'edge'. */
  type: string
  reason: string
}

export interface PrintResult {
  text: string
  /**
   * Reported rather than dropped silently, so the editor can say "3 shapes are not shown
   * in code" instead of quietly losing a user's annotations.
   */
  skipped: SkippedItem[]
  /**
   * The DSL name given to each node, keyed by node id.
   *
   * Lets the caller carry existing canvas positions over as pins without guessing which
   * declaration became which node — importing a diagram should not rearrange it.
   */
  names: Record<string, string>
}

export function print(
  snapshot: { nodes: ArchitectureNode[]; edges: ArchitectureEdge[] },
  options: PrintOptions = {}
): PrintResult {
  return new Printer(snapshot.nodes, snapshot.edges, options).run()
}

class Printer {
  private readonly lines: string[] = []
  private readonly skipped: SkippedItem[] = []
  private readonly names = new Map<string, string>()
  private readonly indent: string
  private depth = 0

  constructor(
    private readonly nodes: ArchitectureNode[],
    private readonly edges: ArchitectureEdge[],
    private readonly options: PrintOptions
  ) {
    this.indent = options.indent ?? DEFAULT_INDENT
  }

  run(): PrintResult {
    const printable = this.nodes.filter((node) => {
      if (PRINTABLE_TYPES.has(String(node.type))) return true
      this.skipped.push({
        id: node.id,
        kind: 'node',
        type: String(node.type ?? 'unknown'),
        reason: 'Only components and groups have a text form.',
      })
      return false
    })

    this.assignNames(printable)
    const groups = this.resolveGroups(printable)

    if (this.options.name !== undefined) {
      this.push(`diagram ${quote(this.options.name)} {`)
      this.depth += 1
    }

    if (this.options.workload) {
      this.printWorkload(this.options.workload)
      this.blank()
    }

    // Roots in canvas order, so the text order is stable and matches the document.
    const roots = printable.filter((node) => !groups.parentOf.has(node.id))
    for (const node of roots) this.printNode(node, printable, groups)

    this.printConnections(printable)

    if (this.options.name !== undefined) {
      this.depth -= 1
      this.push('}')
    }

    // Collapse the runs of blank lines the section breaks leave behind.
    const text = this.lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\{\n\n/g, '{\n')
      .replace(/\n+(\s*)\}/g, '\n$1}')
      .trim()

    return {
      text: text ? `${text}\n` : '',
      skipped: this.skipped,
      names: Object.fromEntries(this.names),
    }
  }

  /**
   * Containment, from the caller if it knows and from geometry if not.
   *
   * The geometric path deliberately counts only frames as containers, unlike `buildGroups`,
   * which also counts any closed shape. A rectangle drawn around a cluster of components is
   * scenery: the language's container is `group`, and a shape has no body to nest anything
   * in. Treating one as a container here dropped everything inside it from the output while
   * still printing its arrows, leaving the text full of undeclared names.
   *
   * Nothing is lost visually — every position is pinned on import, so components that looked
   * inside the rectangle stay exactly where they were.
   */
  private resolveGroups(printable: ArchitectureNode[]): GroupMap {
    if (!this.options.hierarchy) return frameContainment(printable)

    const present = new Set(printable.map((n) => n.id))
    const members = new Map<string, string[]>()
    const parentOf = new Map<string, string>()
    const containers = new Set(
      printable.filter((n) => n.type === 'frame').map((n) => n.id)
    )

    for (const [childId, parentId] of Object.entries(this.options.hierarchy)) {
      if (!present.has(childId) || !present.has(parentId)) continue
      parentOf.set(childId, parentId)
      members.set(parentId, [...(members.get(parentId) ?? []), childId])
    }

    return { members, parentOf, containers }
  }

  // ── output helpers ──────────────────────────────────────────────────────────

  private push(line: string): void {
    this.lines.push(line ? this.indent.repeat(this.depth) + line : '')
  }

  private blank(): void {
    this.lines.push('')
  }

  /**
   * A readable, unique name per node.
   *
   * Derived from the label rather than the node id, because the name is what a person
   * types in a connection — `api -> db` beats `1757… -> 1757…`. Ids are not stable across
   * a recompile anyway.
   */
  private assignNames(nodes: ArchitectureNode[]): void {
    const used = new Set<string>()

    for (const node of nodes) {
      // A node already compiled from text knows its own name. Reusing it means printing a
      // document back gives the same names rather than re-slugging them from labels.
      const existing = typeof node.data?.dslName === 'string' ? node.data.dslName : ''
      const label = typeof node.data?.label === 'string' ? node.data.label : ''
      const base =
        slug(existing) ||
        slug(label) ||
        slug(String(node.data?.componentId ?? '')) ||
        slug(String(node.data?.shapeType ?? '')) ||
        'node'

      let name = base
      let suffix = 2
      while (used.has(name)) {
        name = `${base}-${suffix}`
        suffix += 1
      }
      used.add(name)
      this.names.set(node.id, name)
    }
  }

  private nameOf(id: string): string | undefined {
    return this.names.get(id)
  }

  // ── declarations ────────────────────────────────────────────────────────────

  private printNode(
    node: ArchitectureNode,
    printable: ArchitectureNode[],
    groups: GroupMap
  ): void {
    if (node.type === 'frame') this.printGroup(node, printable, groups)
    else if (node.type === 'architecture') this.printComponent(node)
    else if (node.type === 'shape') this.printShape(node)
  }

  /** `shape hint "Add rate limiting" : note { fill #fff }` */
  private printShape(node: ArchitectureNode): void {
    const data = node.data as ShapeNodeData
    const name = this.nameOf(node.id) ?? 'shape'

    let header = `shape ${name}`
    if (data.label) header += ` ${quote(data.label)}`
    // A rectangle is the default, so saying so adds nothing.
    if (data.shapeType && data.shapeType !== 'rectangle') header += ` : ${data.shapeType}`

    const properties: string[] = []

    for (const key of SHAPE_STYLE_KEYS) {
      const value = data[key]
      if (value === undefined || value === null || value === '') continue
      // Transparent is what the canvas uses for "no fill", which is a default too.
      if (key === 'fill' && value === 'transparent') continue
      if (SHAPE_STYLE_DEFAULTS[key] === value) continue
      properties.push(configProperty(key, value))
    }

    // Size only when it differs from the shape's natural box, since layout supplies that.
    const natural = NATURAL_SHAPE_SIZES[String(data.shapeType)] ?? { w: 160, h: 100 }
    const bounds = nodeBounds(node)
    if (Math.round(bounds.w) !== natural.w) properties.push(`width ${number(bounds.w)}`)
    if (Math.round(bounds.h) !== natural.h) properties.push(`height ${number(bounds.h)}`)

    if (properties.length === 0) {
      this.push(header)
      return
    }
    if (properties.length <= 3) {
      this.push(`${header} { ${properties.join(', ')} }`)
      return
    }

    this.push(`${header} {`)
    this.depth += 1
    for (const property of properties) this.push(property)
    this.depth -= 1
    this.push('}')
  }

  private printGroup(
    node: ArchitectureNode,
    printable: ArchitectureNode[],
    groups: GroupMap
  ): void {
    const data = node.data as FrameNodeData
    const name = this.nameOf(node.id) ?? 'group'

    let header = `group ${name}`
    if (data.label && data.label !== name) header += ` ${quote(data.label)}`
    if (data.frameType && data.frameType !== 'custom') header += ` : ${data.frameType}`

    const memberIds = groups.members.get(node.id) ?? []
    if (memberIds.length === 0) {
      this.push(`${header} {}`)
      return
    }

    this.push(`${header} {`)
    this.depth += 1

    // Canvas order again, filtered to this frame's direct members.
    const members = new Set(memberIds)
    for (const child of printable) {
      if (members.has(child.id)) this.printNode(child, printable, groups)
    }

    this.depth -= 1
    this.push('}')
  }

  private printComponent(node: ArchitectureNode): void {
    const data = node.data as ArchitectureNodeData
    const name = this.nameOf(node.id) ?? 'node'
    const component = getComponentById(data.componentId)

    let header = `${data.componentId} ${name}`
    // The registry name is the default, so printing it again would be noise.
    if (data.label && data.label !== component?.name) header += ` ${quote(data.label)}`

    const properties = this.componentProperties(data)
    if (properties.length === 0) {
      this.push(header)
      return
    }

    // Short blocks read better inline; long ones across lines.
    if (properties.length <= 3) {
      this.push(`${header} { ${properties.join(', ')} }`)
      return
    }

    this.push(`${header} {`)
    this.depth += 1
    for (const property of properties) this.push(property)
    this.depth -= 1
    this.push('}')
  }

  /** Only what was explicitly set. Absent sizing means "derive it", which must stay absent. */
  private componentProperties(data: ArchitectureNodeData): string[] {
    const out: string[] = []

    if (typeof data.instances === 'number') out.push(`instances ${number(data.instances)}`)

    // An instance type sets vCPU and RAM, so printing those alongside it is redundant —
    // and worse, it would pin them and stop the type driving them on recompile.
    const instanceType = data.config?.instanceType
    if (typeof instanceType === 'string') out.push(`type ${instanceType}`)
    else {
      if (typeof data.vcpu === 'number') out.push(`vcpu ${number(data.vcpu)}`)
      if (typeof data.memoryGb === 'number') out.push(`memory ${number(data.memoryGb)}`)
    }

    if (typeof data.concurrencyPerVcpu === 'number') {
      out.push(`concurrencyPerVcpu ${number(data.concurrencyPerVcpu)}`)
    }
    if (typeof data.serviceMs === 'number') out.push(`service ${number(data.serviceMs)}ms`)
    if (typeof data.concurrency === 'number') out.push(`concurrency ${number(data.concurrency)}`)
    if (typeof data.subtitle === 'string' && data.subtitle) out.push(`subtitle ${quote(data.subtitle)}`)
    if (typeof data.color === 'string' && data.color) out.push(`color ${quote(data.color)}`)

    for (const [key, value] of Object.entries(data.config ?? {})) {
      if (key === 'instanceType') continue
      out.push(configProperty(key, value))
    }

    return out
  }

  private printWorkload(workload: WorkloadInputs): void {
    this.push('workload {')
    this.depth += 1

    this.push(`dau ${count(workload.dau)}`)
    this.push(`perUser ${number(workload.requestsPerUserPerDay)}`)
    this.push(`peak ${number(workload.peakFactor)}x`)
    this.push(`reads ${ratio(workload.readsPerWrite)}`)
    this.push(`request ${kb(workload.requestKb)}`)
    this.push(`response ${kb(workload.responseKb)}`)
    this.push(`stored ${kb(workload.storedPerWriteKb)}`)
    this.push(`retention ${number(workload.retentionDays)}d`)
    this.push(`replicas ${number(workload.replicationFactor)}`)
    this.push(`compression ${number(workload.compressionRatio)}`)
    this.push(`cache ${percent(workload.cacheHitRate)}`)
    this.push(`secondsPerDay ${number(workload.secondsPerDay)}`)

    this.depth -= 1
    this.push('}')
  }

  // ── connections ─────────────────────────────────────────────────────────────

  /**
   * Printed as one block at the end rather than inside the groups.
   *
   * Edges cross group boundaries freely, so there is no group they all belong to, and a
   * flat list of arrows is the part of a diagram people actually read.
   */
  private printConnections(printable: ArchitectureNode[]): void {
    const printableIds = new Set(printable.map((n) => n.id))
    const lines: string[] = []

    for (const edge of this.edges) {
      if (!printableIds.has(edge.source) || !printableIds.has(edge.target)) {
        this.skipped.push({
          id: edge.id,
          kind: 'edge',
          type: 'edge',
          reason: 'One of its endpoints has no text form.',
        })
        continue
      }

      const from = this.nameOf(edge.source)
      const to = this.nameOf(edge.target)
      if (!from || !to) continue

      lines.push(this.connectionLine(edge, from, to, printable))
    }

    if (lines.length === 0) return
    this.blank()
    for (const line of lines) this.push(line)
  }

  private connectionLine(
    edge: ArchitectureEdge,
    from: string,
    to: string,
    printable: ArchitectureNode[]
  ): string {
    const data = edge.data ?? {}

    // What the compiler would work out on its own for this pair. Anything matching it is
    // left out; anything not is printed, which is what makes the short form lossless.
    const connection: Connection = {
      source: edge.source,
      target: edge.target,
      sourceHandle: null,
      targetHandle: null,
    }
    const inferred = inferConnection(connection, printable)

    const arrow =
      data.connectionType === 'asynchronous'
        ? '~>'
        : data.connectionType === 'bidirectional'
          ? '<->'
          : '->'

    let line = `${from} ${arrow} ${to}`

    const defaultProtocol = inferred.protocol ?? 'HTTPS'
    const showProtocol = data.protocol !== undefined && data.protocol !== defaultProtocol

    const defaultLabel = inferred.label ?? ''
    const showLabel = Boolean(data.label) && data.label !== defaultLabel

    if (showProtocol) {
      line += ` : ${data.protocol}`
      if (showLabel) line += ` ${quote(data.label ?? '')}`
    } else if (showLabel) {
      // A label with no protocol needs no colon.
      line += ` ${quote(data.label ?? '')}`
    }

    const properties: string[] = []

    // The arrow only spells out three of the seven connection types; the rest need saying.
    const arrowImplies =
      arrow === '~>'
        ? 'asynchronous'
        : arrow === '<->'
          ? 'bidirectional'
          : (inferred.connectionType ?? 'synchronous')
    if (data.connectionType && data.connectionType !== arrowImplies) {
      properties.push(`type ${data.connectionType}`)
    }

    const impliedAnimated = arrow === '~>' ? true : (inferred.animated ?? false)
    if (typeof data.animated === 'boolean' && data.animated !== impliedAnimated) {
      properties.push(`animated ${data.animated}`)
    }

    if (data.edgeLineStyle) properties.push(`style ${data.edgeLineStyle}`)

    for (const [key, value] of Object.entries(data.metadata ?? {})) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        properties.push(configProperty(key, value))
      }
    }

    if (properties.length > 0) line += ` { ${properties.join(', ')} }`
    return line
  }
}

/**
 * Which frame each node sits inside, by geometry.
 *
 * The same smallest-enclosing-container rule as `buildGroups`, restricted to frames. A node
 * inside a drawn shape comes back parentless, which is what makes it print at top level.
 */
function frameContainment(nodes: ArchitectureNode[]): GroupMap {
  const frames = nodes.filter((node) => node.type === 'frame')
  const containers = new Set(frames.map((f) => f.id))

  const members = new Map<string, string[]>()
  const parentOf = new Map<string, string>()
  if (frames.length === 0) return { members, parentOf, containers }

  for (const node of nodes) {
    let bestId: string | undefined
    let bestArea = Infinity

    for (const frame of frames) {
      if (frame.id === node.id) continue
      const box = nodeBounds(frame)
      if (!centerInside(node, box)) continue
      // Smallest wins, so a frame nested in another claims its own members.
      const area = box.w * box.h
      if (area < bestArea) {
        bestArea = area
        bestId = frame.id
      }
    }

    if (!bestId) continue
    parentOf.set(node.id, bestId)
    members.set(bestId, [...(members.get(bestId) ?? []), node.id])
  }

  return { members, parentOf, containers }
}

// ─── formatting ───────────────────────────────────────────────────────────────

/** A config or metadata pair. Flags print bare, which is how they read best. */
function configProperty(key: string, value: ConfigValue | unknown): string {
  if (value === true) return key
  if (value === false) return `${key} false`
  if (typeof value === 'number') return `${key} ${number(value)}`

  const text = String(value)
  // Bare words only where they lex as one identifier; anything else needs quoting.
  return /^[A-Za-z_][A-Za-z0-9_\-./]*$/.test(text) ? `${key} ${text}` : `${key} ${quote(text)}`
}

/** Lossless. Round-tripping matters more here than looking tidy. */
function number(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return String(value)
}

/** `100000000` → `100M`, but only when the suffix is exact. */
function count(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0'

  const units = [
    { limit: 1e12, suffix: 'T' },
    { limit: 1e9, suffix: 'B' },
    { limit: 1e6, suffix: 'M' },
    { limit: 1e3, suffix: 'K' },
  ] as const

  for (const { limit, suffix } of units) {
    if (value >= limit && value % limit === 0) return `${value / limit}${suffix}`
  }
  return number(value)
}

/** A KB value as a byte literal where that is exact, since `2kb` reads better than `2`. */
function kb(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return number(value)
  if (value % 1024 === 0) return `${value / 1024}mb`
  if (Number.isInteger(value)) return `${value}kb`
  return number(value)
}

/** `9` → `9:1`, the natural way to write a read/write split. */
function ratio(value: number): string {
  return Number.isInteger(value) ? `${value}:1` : number(value)
}

/** `0.8` → `80%`, matching how a hit rate is quoted. */
function percent(value: number): string {
  const scaled = value * 100
  return Number.isInteger(scaled) ? `${scaled}%` : number(value)
}

/** A DSL name from a label: `"API Server"` → `api-server`. */
function slug(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!base) return ''
  // Identifiers must start with a letter or underscore.
  return /^[a-z_]/.test(base) ? base : `n-${base}`
}

function quote(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
}
