import type { Connection } from '@xyflow/react'
import type {
  ArchitectureEdge,
  ArchitectureEdgeData,
  ArchitectureNode,
  ArchitectureNodeData,
  ComponentCategory,
  ConfigValue,
  ConnectionType,
  FrameNodeData,
  FrameType,
  Protocol,
  ShapeNodeData,
  ShapeType,
} from '@/types'
import type {
  ComponentDeclNode,
  ConnectionNode,
  DeclNode,
  Diagnostic,
  DiagramNode,
  GroupDeclNode,
  PropertyNode,
  ShapeDeclNode,
  SourceSpan,
  WorkloadNode,
} from '@/types/dsl'
import type { WorkloadInputs } from '@/types/estimate'
import { componentRegistry, getComponentById } from '@/data/components'
import { inferConnection } from '@/lib/canvas/inferConnection'
import { configFieldsFor, type ConfigField } from '@/lib/config/fields'
import { findInstanceType, INSTANCE_TYPE_IDS } from '@/lib/config/instanceTypes'
import { DEFAULT_WORKLOAD, normaliseWorkload } from '@/lib/estimate/workload'
import { parse } from './parser'

/**
 * AST to canvas.
 *
 * Produces exactly the node and edge objects the canvas builds when a user drags a
 * component in, so a compiled diagram is indistinguishable from a drawn one — same
 * registry `componentId`, `category` and `icon`, so the simulation and the capacity panel
 * work on it with nothing else configured.
 *
 * Positions are not assigned here. Every node comes out at the origin and layout owns all
 * geometry, which keeps this pass pure and synchronous while the layout pass is neither.
 * Frame membership rides in `hierarchy` rather than on the nodes, because containment in
 * this codebase is geometric (see lib/canvas/geometry.ts) — layout is what makes it true
 * by placing children inside their frame's rect.
 */

/** Matches the drop handler in Whiteboard.tsx, so compiled nodes measure the same. */
const ARCH_NODE_W = 72
const ARCH_NODE_H = 88

/** Property keys that map to typed fields on node data rather than into the config bag. */
const SIZING_KEYS = new Set([
  'instances',
  'vcpu',
  'memory',
  'memoryGb',
  'concurrencyPerVcpu',
  'service',
  'serviceMs',
  'concurrency',
])

const SHAPE_TYPES: readonly ShapeType[] = [
  'rectangle',
  'ellipse',
  'diamond',
  'triangle',
  'parallelogram',
  'cylinder',
  'hexagon',
  'star',
  'arrow',
  'line',
  'text',
  'terminator',
  'document',
  'preparation',
  'connector',
  'note',
]

/** Default box for a shape, matching the canvas's own defaults per tool. */
const SHAPE_SIZES: Partial<Record<ShapeType, { w: number; h: number }>> = {
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

/** Shape styling the DSL can set, mapped to the fields on ShapeNodeData. */
const SHAPE_TEXT_KEYS = new Set(['fill', 'stroke', 'textColor', 'strokeStyle', 'textAlign', 'fontWeight'])
const SHAPE_NUMBER_KEYS = new Set([
  'fillOpacity',
  'strokeWidth',
  'opacity',
  'cornerRadius',
  'fontSize',
])

const FRAME_TYPES: readonly FrameType[] = [
  'region',
  'availability-zone',
  'vpc',
  'cluster',
  'service',
  'database-cluster',
  'data-center',
  'custom',
]

const PROTOCOLS: readonly Protocol[] = [
  'HTTP',
  'HTTPS',
  'TCP',
  'UDP',
  'gRPC',
  'WebSocket',
  'SSE',
  'REST',
  'GraphQL',
  'Kafka',
  'AMQP',
  'MQTT',
]

const CONNECTION_TYPES: readonly ConnectionType[] = [
  'synchronous',
  'asynchronous',
  'replication',
  'event',
  'read',
  'write',
  'bidirectional',
]

/** DSL workload keys, mapped to the estimator's field names. */
const WORKLOAD_KEYS: Record<string, keyof WorkloadInputs> = {
  dau: 'dau',
  perUser: 'requestsPerUserPerDay',
  requestsPerUser: 'requestsPerUserPerDay',
  peak: 'peakFactor',
  reads: 'readsPerWrite',
  readsPerWrite: 'readsPerWrite',
  request: 'requestKb',
  response: 'responseKb',
  stored: 'storedPerWriteKb',
  retention: 'retentionDays',
  replicas: 'replicationFactor',
  replication: 'replicationFactor',
  compression: 'compressionRatio',
  cache: 'cacheHitRate',
  cacheHitRate: 'cacheHitRate',
  secondsPerDay: 'secondsPerDay',
}

/** Workload fields the estimator wants in KB, so a byte-unit value must be converted. */
const KB_FIELDS = new Set<keyof WorkloadInputs>([
  'requestKb',
  'responseKb',
  'storedPerWriteKb',
])

export interface CompiledDiagram {
  name?: string
  nodes: ArchitectureNode[]
  edges: ArchitectureEdge[]
  /** Present only when the source declared a `workload` block. */
  workload?: WorkloadInputs
  /**
   * Frame membership: child node id to its containing frame node id.
   *
   * Not on the nodes themselves because this codebase resolves containment geometrically;
   * layout consumes this to place children inside the frame it belongs to.
   */
  hierarchy: Record<string, string>
  /**
   * DSL name to generated node id.
   *
   * Kept so layout can pin positions by DSL name — a stable key across recompiles, which
   * the generated node id is not.
   */
  nodeIdsByName: Record<string, string>
  diagnostics: Diagnostic[]
}

/** Compile source text in one step. */
export function compileSource(source: string): CompiledDiagram {
  const { diagram, diagnostics } = parse(source)
  if (!diagram) {
    return { nodes: [], edges: [], hierarchy: {}, nodeIdsByName: {}, diagnostics }
  }
  const compiled = compile(diagram)
  // Parse errors first: they are the ones that stopped things being understood at all.
  return { ...compiled, diagnostics: [...diagnostics, ...compiled.diagnostics] }
}

export function compile(diagram: DiagramNode): CompiledDiagram {
  return new Compiler().run(diagram)
}

interface Declared {
  nodeId: string
}

class Compiler {
  private readonly diagnostics: Diagnostic[] = []
  private readonly nodes: ArchitectureNode[] = []
  private readonly edges: ArchitectureEdge[] = []
  private readonly hierarchy: Record<string, string> = {}
  /** DSL name to declaration. Names are the reference mechanism, so they must be unique. */
  private readonly declared = new Map<string, Declared>()
  private workload: WorkloadInputs | undefined
  private workloadSpan: SourceSpan | undefined
  private counter = 0

  run(diagram: DiagramNode): CompiledDiagram {
    // Two passes, because a connection may reference a component declared further down —
    // insisting on declare-before-use would make the text order-dependent for no reason.
    this.collect(diagram.body, undefined)
    this.connect(diagram.body)

    const nodeIdsByName: Record<string, string> = {}
    for (const [name, entry] of this.declared) nodeIdsByName[name] = entry.nodeId

    return {
      name: diagram.name,
      nodes: this.nodes,
      edges: this.edges,
      workload: this.workload,
      hierarchy: this.hierarchy,
      nodeIdsByName,
      diagnostics: this.diagnostics,
    }
  }

  /**
   * Deterministic ids.
   *
   * `generateId()` embeds a timestamp and a random suffix, which would make the same text
   * compile to different ids every keystroke — the canvas would remount every node and any
   * position pin would be orphaned. Sequential ids keep recompiles stable.
   */
  private nextId(prefix: string): string {
    this.counter += 1
    return `${prefix}-${this.counter}`
  }

  private error(message: string, span: SourceSpan, hint?: string): void {
    this.diagnostics.push({ severity: 'error', message, span, hint })
  }

  private warn(message: string, span: SourceSpan, hint?: string): void {
    this.diagnostics.push({ severity: 'warning', message, span, hint })
  }

  // ── pass one: components, groups, workload ──────────────────────────────────

  private collect(body: DeclNode[], parentId: string | undefined): void {
    for (const decl of body) {
      if (decl.kind === 'component') this.collectComponent(decl, parentId)
      else if (decl.kind === 'group') this.collectGroup(decl, parentId)
      else if (decl.kind === 'shape') this.collectShape(decl, parentId)
      else if (decl.kind === 'workload') this.collectWorkload(decl)
    }
  }

  /** Claim a name, reporting a clash. Returns the node id, or undefined if already taken. */
  private claim(name: string, span: SourceSpan, prefix = 'n'): string | undefined {
    if (this.declared.has(name)) {
      this.error(
        `"${name}" is already declared.`,
        span,
        'Names identify things in connections, so each must be unique.'
      )
      return undefined
    }
    const nodeId = this.nextId(prefix)
    this.declared.set(name, { nodeId })
    return nodeId
  }

  private collectComponent(decl: ComponentDeclNode, parentId: string | undefined): void {
    const component = getComponentById(decl.componentType)

    if (!component) {
      this.error(
        `Unknown component "${decl.componentType}".`,
        decl.typeSpan,
        this.suggestComponent(decl.componentType)
      )
      // No registry entry means no category or icon, so there is nothing sensible to
      // render. The name is still claimed below so connections report the real problem
      // here rather than a misleading "unknown component" on every arrow that touches it.
    }

    const nodeId = this.claim(decl.name, decl.span)
    if (nodeId === undefined) return
    if (!component) return

    const data: ArchitectureNodeData = {
      componentId: component.id,
      label: decl.label ?? component.name,
      category: component.category,
      icon: component.icon,
      // Marks this node as owned by the text. Without it the sync layer cannot tell a node
      // it generated from one the user drew, so it would have to replace the whole canvas —
      // and silently delete every hand-drawn shape on the next keystroke.
      dslName: decl.name,
      ...(component.provider ? { provider: component.provider } : {}),
      ...(component.description ? { description: component.description } : {}),
    }

    this.applyComponentProperties(decl, component.category, data)

    this.nodes.push({
      id: nodeId,
      type: 'architecture',
      position: { x: 0, y: 0 },
      width: ARCH_NODE_W,
      height: ARCH_NODE_H,
      style: { width: ARCH_NODE_W, height: ARCH_NODE_H },
      connectable: true,
      zIndex: 10,
      data,
    })

    if (parentId) this.hierarchy[nodeId] = parentId
  }

  private collectGroup(decl: GroupDeclNode, parentId: string | undefined): void {
    // Groups claim their name like anything else, so a frame can be pinned and referenced.
    const nodeId = this.claim(decl.name, decl.span, 'f')
    if (nodeId === undefined) {
      // Still descend: the children are real declarations and their errors are their own.
      this.collect(decl.children, parentId)
      return
    }

    let frameType: FrameType = 'custom'
    if (decl.frameType) {
      if (isFrameType(decl.frameType)) {
        frameType = decl.frameType
      } else if (decl.frameTypeSpan) {
        this.error(
          `Unknown frame type "${decl.frameType}".`,
          decl.frameTypeSpan,
          `Try one of: ${FRAME_TYPES.join(', ')}.`
        )
      }
    }

    const data: FrameNodeData = {
      label: decl.label ?? decl.name,
      frameType,
      dslName: decl.name,
    }

    // Size is assigned by layout, which is the only thing that knows how big the contents
    // turned out. Frames carry no size here on purpose.
    this.nodes.push({
      id: nodeId,
      type: 'frame',
      position: { x: 0, y: 0 },
      data,
      zIndex: 0,
    })

    if (parentId) this.hierarchy[nodeId] = parentId
    this.collect(decl.children, nodeId)
  }

  /**
   * A shape — an annotation rather than a piece of architecture.
   *
   * Compiled like anything else so it can be laid out, pinned and connected, but it carries
   * no component id and the simulation never sees it: a sticky note is not a tier.
   */
  private collectShape(decl: ShapeDeclNode, parentId: string | undefined): void {
    const nodeId = this.claim(decl.name, decl.span, 's')
    if (nodeId === undefined) return

    let shapeType: ShapeType = 'rectangle'
    if (decl.shapeType) {
      if (isShapeType(decl.shapeType)) {
        shapeType = decl.shapeType
      } else if (decl.shapeTypeSpan) {
        this.error(
          `Unknown shape "${decl.shapeType}".`,
          decl.shapeTypeSpan,
          `Try one of: ${SHAPE_TYPES.join(', ')}.`
        )
      }
    }

    const data: ShapeNodeData = {
      shapeType,
      label: decl.label ?? '',
      dslName: decl.name,
    }

    this.applyShapeProperties(decl, data)

    const size = SHAPE_SIZES[shapeType] ?? { w: 160, h: 100 }
    const width = typeof data.width === 'number' ? data.width : size.w
    const height = typeof data.height === 'number' ? data.height : size.h

    this.nodes.push({
      id: nodeId,
      type: 'shape',
      position: { x: 0, y: 0 },
      width,
      height,
      style: { width, height },
      // Lines, arrows and text are scenery on the canvas too, never endpoints.
      connectable: shapeType !== 'line' && shapeType !== 'arrow' && shapeType !== 'text',
      zIndex: shapeType === 'line' || shapeType === 'arrow' || shapeType === 'text' ? 5 : 0,
      data,
    })

    if (parentId) this.hierarchy[nodeId] = parentId
  }

  private applyShapeProperties(decl: ShapeDeclNode, data: ShapeNodeData): void {
    for (const property of decl.properties) {
      const { key, value } = property

      if (key === 'width' || key === 'height') {
        if (typeof value !== 'number') {
          this.error(`"${key}" needs a number.`, property.span)
          continue
        }
        data[key] = value
        continue
      }

      if (SHAPE_NUMBER_KEYS.has(key)) {
        if (typeof value !== 'number') {
          this.error(`"${key}" needs a number.`, property.span)
          continue
        }
        // `fillOpacity 80%` lexes to 0.8, which is already what the field wants; `opacity`
        // is stored 0–100, so a percentage has to be scaled back up.
        data[key] = key === 'opacity' && property.unit === 'percent' ? value * 100 : value
        continue
      }

      if (SHAPE_TEXT_KEYS.has(key)) {
        data[key] = String(value)
        continue
      }

      this.warn(
        `"${key}" is not a known shape setting.`,
        property.span,
        `Try one of: fill, stroke, strokeWidth, opacity, cornerRadius, fontSize, textColor, width, height.`
      )
    }
  }

  private collectWorkload(decl: WorkloadNode): void {
    if (this.workload) {
      this.warn(
        'Duplicate workload block; the later one wins.',
        decl.span,
        this.workloadSpan
          ? `Already declared on line ${this.workloadSpan.start.line}.`
          : undefined
      )
    }
    this.workloadSpan = decl.span

    const raw: Partial<Record<keyof WorkloadInputs, number>> = {}

    for (const property of decl.properties) {
      const field = WORKLOAD_KEYS[property.key]
      if (!field) {
        this.warn(
          `Unknown workload input "${property.key}".`,
          property.span,
          `Try one of: ${Object.keys(WORKLOAD_KEYS).join(', ')}.`
        )
        continue
      }

      if (typeof property.value !== 'number') {
        this.error(
          `"${property.key}" needs a number.`,
          property.span,
          'For example: dau 100M'
        )
        continue
      }

      raw[field] = this.workloadValue(field, property)
    }

    // Through the same clamp the panel and the stored document use, so text and UI cannot
    // disagree about what is a valid workload.
    this.workload = normaliseWorkload({ ...DEFAULT_WORKLOAD, ...raw })
  }

  /** Convert a property to the unit the estimator expects. */
  private workloadValue(field: keyof WorkloadInputs, property: PropertyNode): number {
    const value = property.value as number

    // `reads 9:1` is the natural way to write a read/write split.
    if (field === 'readsPerWrite' && property.unit === 'ratio') {
      const denominator = property.ratioDenominator ?? 1
      return denominator === 0 ? value : value / denominator
    }

    // The estimator works in KB, so `request 2kb` must not arrive as 2048.
    if (KB_FIELDS.has(field) && property.unit === 'bytes') return value / 1024

    return value
  }

  // ── component properties ────────────────────────────────────────────────────

  /**
   * Map a component's block onto node data.
   *
   * Sizing keys become typed fields, because the simulation reads them by name off the
   * node; everything else goes into the free-form `config` bag and is checked against that
   * component's schema in lib/config/fields.ts, so a typo is reported rather than silently
   * stored where no inspector will ever show it.
   */
  private applyComponentProperties(
    decl: ComponentDeclNode,
    category: ComponentCategory,
    data: ArchitectureNodeData
  ): void {
    const fields = configFieldsFor(decl.componentType, category)
    const byKey = new Map(fields.map((f) => [f.key, f]))
    const config: Record<string, ConfigValue> = {}

    for (const property of decl.properties) {
      const { key } = property

      if (SIZING_KEYS.has(key)) {
        this.applySizingProperty(property, data)
        continue
      }

      // `type m5.large` — shorthand for the instance type, which is how people actually
      // size a tier.
      if (key === 'type') {
        if (typeof property.value === 'string' && findInstanceType(property.value)) {
          config.instanceType = property.value
        } else {
          this.error(
            `Unknown instance type "${String(property.value)}".`,
            property.span,
            `Try one of: ${INSTANCE_TYPE_IDS.slice(0, 6).join(', ')}…`
          )
        }
        continue
      }

      if (key === 'label' && typeof property.value === 'string') {
        data.label = property.value
        continue
      }
      if (key === 'color' && typeof property.value === 'string') {
        data.color = property.value
        continue
      }
      if (key === 'subtitle' && typeof property.value === 'string') {
        data.subtitle = property.value
        continue
      }

      const field = byKey.get(key)
      if (!field) {
        this.warn(
          `"${key}" is not a known setting for ${decl.componentType}.`,
          property.span,
          this.suggestKey(key, fields)
        )
        // Stored anyway: dropping what someone wrote is worse than keeping a value the
        // inspector will not show, and the warning says so.
        config[key] = property.value
        continue
      }

      const value = this.coerceConfigValue(field, property)
      if (value !== undefined) config[key] = value
    }

    if (Object.keys(config).length > 0) data.config = config
  }

  private applySizingProperty(property: PropertyNode, data: ArchitectureNodeData): void {
    const { key, value } = property

    if (typeof value !== 'number') {
      this.error(`"${key}" needs a number.`, property.span, 'For example: instances 3')
      return
    }

    switch (key) {
      case 'instances':
        data.instances = value
        break
      case 'vcpu':
        data.vcpu = value
        break
      case 'memory':
      case 'memoryGb':
        // `memory 8gb` lexes to bytes; the field is in GB.
        data.memoryGb = property.unit === 'bytes' ? value / 1024 ** 3 : value
        break
      case 'concurrencyPerVcpu':
        data.concurrencyPerVcpu = value
        break
      case 'service':
      case 'serviceMs':
        data.serviceMs = value
        break
      case 'concurrency':
        data.concurrency = value
        break
    }
  }

  /** Check a config value against its declared type, reporting rather than coercing blindly. */
  private coerceConfigValue(field: ConfigField, property: PropertyNode): ConfigValue | undefined {
    const { value } = property

    if (field.type === 'number') {
      if (typeof value !== 'number') {
        this.error(`"${field.key}" needs a number.`, property.span)
        return undefined
      }
      // A percentage field wants 80, not the 0.8 the lexer produced from `80%`.
      const scaled = property.unit === 'percent' && field.unit === '%' ? value * 100 : value
      if (field.min !== undefined && scaled < field.min) {
        this.warn(`"${field.key}" is below the minimum of ${field.min}.`, property.span)
      }
      if (field.max !== undefined && scaled > field.max) {
        this.warn(`"${field.key}" is above the maximum of ${field.max}.`, property.span)
      }
      return scaled
    }

    if (field.type === 'boolean') {
      if (typeof value === 'boolean') return value
      this.error(`"${field.key}" is a flag.`, property.span, `Write "${field.key}" or "${field.key} false".`)
      return undefined
    }

    if (field.type === 'select') {
      const text = String(value)
      if (field.options && !field.options.includes(text)) {
        this.error(
          `"${text}" is not a valid ${field.key}.`,
          property.span,
          `Try one of: ${field.options.join(', ')}.`
        )
        return undefined
      }
      return text
    }

    return typeof value === 'boolean' ? value : String(value)
  }

  // ── pass two: connections ───────────────────────────────────────────────────

  private connect(body: DeclNode[]): void {
    for (const decl of body) {
      if (decl.kind === 'connection') this.compileConnection(decl)
      // Connections may be written inside a group, next to what they join.
      else if (decl.kind === 'group') this.connect(decl.children)
    }
  }

  private compileConnection(decl: ConnectionNode): void {
    const source = this.resolveEndpoint(decl.from, decl.fromSpan)
    const target = this.resolveEndpoint(decl.to, decl.toSpan)
    if (!source || !target) return

    if (source === target) {
      this.error(
        `"${decl.from}" cannot connect to itself.`,
        decl.span,
        'The canvas rejects self-connections too.'
      )
      return
    }

    // Same inference the canvas runs when an arrow is drawn, so an unannotated DSL edge
    // gets the label and protocol a user would have got by dragging.
    const connection: Connection = {
      source,
      target,
      sourceHandle: null,
      targetHandle: null,
    }
    const inferred = inferConnection(connection, this.nodes)

    const data: ArchitectureEdgeData = {
      connectionType: styleToConnectionType(decl.style) ?? inferred.connectionType ?? 'synchronous',
      protocol: inferred.protocol ?? 'HTTPS',
      label: decl.label ?? inferred.label ?? '',
      animated: decl.style === 'async' ? true : (inferred.animated ?? false),
      // The edge equivalent of a node's dslName, so the sync layer replaces only its own
      // edges and leaves hand-drawn ones alone.
      dslOwned: true,
    }

    if (decl.protocol) {
      const protocol = matchProtocol(decl.protocol)
      if (protocol) data.protocol = protocol
      else {
        this.error(
          `Unknown protocol "${decl.protocol}".`,
          decl.span,
          `Try one of: ${PROTOCOLS.join(', ')}.`
        )
      }
    }

    this.applyConnectionProperties(decl, data)

    this.edges.push({
      id: this.nextId('e'),
      type: 'architecture',
      source,
      target,
      animated: data.animated,
      data,
    })
  }

  private applyConnectionProperties(decl: ConnectionNode, data: ArchitectureEdgeData): void {
    const metadata: Record<string, unknown> = {}

    for (const property of decl.properties) {
      const { key, value } = property

      // An explicit `type` beats the arrow, which can only express three of the seven.
      if (key === 'type') {
        const connectionType = CONNECTION_TYPES.find((t) => t === String(value))
        if (connectionType) data.connectionType = connectionType
        else {
          this.error(
            `Unknown connection type "${String(value)}".`,
            property.span,
            `Try one of: ${CONNECTION_TYPES.join(', ')}.`
          )
        }
        continue
      }

      if (key === 'animated' && typeof value === 'boolean') {
        data.animated = value
        continue
      }

      if (key === 'style') {
        const styles = ['bezier', 'straight', 'step', 'smoothstep'] as const
        const style = styles.find((s) => s === String(value))
        if (style) data.edgeLineStyle = style
        else {
          this.error(
            `Unknown line style "${String(value)}".`,
            property.span,
            `Try one of: ${styles.join(', ')}.`
          )
        }
        continue
      }

      // Anything else is the author's own annotation — a timeout, a retry budget. Kept
      // rather than rejected, because an architecture document carries more than this
      // tool models.
      metadata[key] = value
    }

    if (Object.keys(metadata).length > 0) data.metadata = metadata
  }

  private resolveEndpoint(name: string, span: SourceSpan): string | undefined {
    const entry = this.declared.get(name)
    if (entry) {
      // Declared but not built, because its component type was unknown. That error is
      // already reported at the declaration; repeating it per arrow would bury it.
      return this.nodes.some((n) => n.id === entry.nodeId) ? entry.nodeId : undefined
    }

    this.error(
      `"${name}" is not declared.`,
      span,
      this.suggestName(name)
    )
    return undefined
  }

  // ── suggestions ─────────────────────────────────────────────────────────────

  private suggestComponent(id: string): string {
    const match = nearest(id, componentRegistry.map((c) => c.id))
    return match ? `Did you mean "${match}"?` : 'Pick a component from the library to see its id.'
  }

  private suggestName(name: string): string {
    const match = nearest(name, [...this.declared.keys()])
    return match ? `Did you mean "${match}"?` : 'Declare it first, e.g. server api "API Server".'
  }

  private suggestKey(key: string, fields: ConfigField[]): string {
    const match = nearest(key, fields.map((f) => f.key))
    return match ? `Did you mean "${match}"?` : 'It will be stored, but nothing reads it.'
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function isFrameType(value: string): value is FrameType {
  return (FRAME_TYPES as readonly string[]).includes(value)
}

function isShapeType(value: string): value is ShapeType {
  return (SHAPE_TYPES as readonly string[]).includes(value)
}

/** Protocols are matched case-insensitively, so `http` and `HTTP` both work. */
function matchProtocol(text: string): Protocol | undefined {
  const lower = text.toLowerCase()
  return PROTOCOLS.find((p) => p.toLowerCase() === lower)
}

/**
 * The arrow's contribution to connection type.
 *
 * `sync` returns undefined rather than 'synchronous' so a plain `->` lets inference speak:
 * `api -> db` should be able to come out as a read, which is what the canvas would have
 * inferred, instead of being flattened to synchronous.
 */
function styleToConnectionType(style: ConnectionNode['style']): ConnectionType | undefined {
  if (style === 'async') return 'asynchronous'
  if (style === 'both') return 'bidirectional'
  return undefined
}

/** Closest candidate by edit distance, if one is close enough to be worth suggesting. */
function nearest(input: string, candidates: string[]): string | undefined {
  const target = input.toLowerCase()
  let best: string | undefined
  let bestDistance = Infinity

  for (const candidate of candidates) {
    const distance = editDistance(target, candidate.toLowerCase())
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }

  // A third of the length, so short names need a near-exact match and long ones can
  // tolerate a couple of slips.
  const threshold = Math.max(1, Math.floor(target.length / 3))
  return bestDistance <= threshold ? best : undefined
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    previous = current
  }

  return previous[b.length]
}
