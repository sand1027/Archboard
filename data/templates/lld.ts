import { generateId, generatePrefixedId } from '@/lib/canvas/ids'
import { edgeTypeForKind } from '@/lib/lld/specs'
import { spawnShape } from '@/lib/lld/spawnShape'
import type {
  ClassField,
  ClassMethod,
  ErColumn,
  LldDiagramSnapshot,
  LldDiagramType,
  LldEdge,
  LldEdgeData,
  LldShape,
  LldSpawn,
  Visibility,
} from '@/types/lld'

/**
 * LLD starters, in the LLD board's own shape language.
 *
 * These used to live in data/templates/index.ts as HLD `Diagram` payloads built from
 * `umlClass` / `umlEntity` / `umlLifeline` / `shape` nodes, and they were broken twice over:
 * the modal wrote them into diagramStore while the LLD canvas reads lldStore, and even routed
 * correctly none of those node types exist in LldCanvas's `nodeTypes` map. Clicking one
 * renamed the workspace and did nothing else.
 *
 * Shapes are described by their palette `spawn` descriptor rather than as literal objects, so
 * a starter is built by the same factory a drag from the palette uses. That means a template
 * cannot drift out of shape when a node type gains a field.
 */

export interface LldTemplateShape {
  /** Local handle, referenced by this template's edges. */
  key: string
  spawn: LldSpawn
  /** Centre point — `spawnShape` centres the box on it, as a palette drop does. */
  at: { x: number; y: number }
  /** Merged over the spawned shape's data, for labels and starter content. */
  data?: Record<string, unknown>
}

export interface LldTemplateEdge {
  /** Shape keys, not ids: ids are minted per build. */
  from: string
  to: string
  data: LldEdgeData
}

export interface LldTemplate {
  id: string
  name: string
  description: string
  preview: string
  type: LldDiagramType
  shapes: LldTemplateShape[]
  edges: LldTemplateEdge[]
}

// ─── content helpers ──────────────────────────────────────────────────────────

function field(name: string, type: string, visibility: Visibility = 'private'): ClassField {
  return { id: generatePrefixedId('f'), name, type, visibility }
}

function method(
  name: string,
  returnType: string,
  visibility: Visibility = 'public'
): ClassMethod {
  return { id: generatePrefixedId('m'), name, params: [], returnType, visibility }
}

function column(name: string, type: string, extra: Partial<ErColumn> = {}): ErColumn {
  return { id: generatePrefixedId('c'), name, type, ...extra }
}

// ─── templates ────────────────────────────────────────────────────────────────

export const lldTemplates: LldTemplate[] = [
  {
    id: 'lld-order-class',
    name: 'Order Class Model',
    description: 'UML class diagram for users, orders and their items',
    preview: 'User → Order → OrderItem',
    type: 'class',
    shapes: [
      {
        key: 'user',
        spawn: { shape: 'lldClass', stereotype: 'class', name: 'User' },
        at: { x: 200, y: 180 },
        data: {
          fields: [field('id', 'uuid'), field('email', 'string')],
          methods: [method('placeOrder', 'Order')],
        },
      },
      {
        key: 'order',
        spawn: { shape: 'lldClass', stereotype: 'class', name: 'Order' },
        at: { x: 520, y: 180 },
        data: {
          fields: [field('id', 'uuid'), field('total', 'Money'), field('status', 'Status')],
          methods: [method('addItem', 'void'), method('checkout', 'void')],
        },
      },
      {
        key: 'item',
        spawn: { shape: 'lldClass', stereotype: 'class', name: 'OrderItem' },
        at: { x: 520, y: 440 },
        data: {
          fields: [field('sku', 'string'), field('qty', 'int')],
          methods: [],
        },
      },
      {
        key: 'status',
        spawn: { shape: 'lldClass', stereotype: 'enum', name: 'Status' },
        at: { x: 840, y: 180 },
        data: { enumValues: ['PENDING', 'PAID', 'SHIPPED'] },
      },
    ],
    edges: [
      {
        from: 'user',
        to: 'order',
        data: { kind: 'association', label: 'places', targetMultiplicity: '0..*', isDirected: true },
      },
      { from: 'order', to: 'item', data: { kind: 'composition', label: 'contains', targetMultiplicity: '1..*' } },
      { from: 'order', to: 'status', data: { kind: 'dependency' } },
    ],
  },

  {
    id: 'lld-users-orders-er',
    name: 'Users and Orders ER',
    description: 'Entity-relationship model with a foreign key and cardinality',
    preview: 'users 1—N orders',
    type: 'er',
    shapes: [
      {
        key: 'users',
        spawn: { shape: 'lldTable', tableKind: 'table', name: 'users' },
        at: { x: 220, y: 220 },
        data: {
          columns: [
            column('id', 'uuid', { isPk: true }),
            column('email', 'citext', { isUnique: true }),
            column('created_at', 'timestamptz'),
          ],
        },
      },
      {
        key: 'orders',
        spawn: { shape: 'lldTable', tableKind: 'table', name: 'orders' },
        at: { x: 620, y: 220 },
        data: {
          columns: [
            column('id', 'uuid', { isPk: true }),
            column('user_id', 'uuid', { isFk: true }),
            column('total_cents', 'bigint'),
            column('status', 'text'),
          ],
        },
      },
    ],
    edges: [
      {
        from: 'users',
        to: 'orders',
        data: {
          kind: 'er-one-to-many',
          label: 'places',
          sourceCardinality: 'one',
          targetCardinality: 'zero-or-many',
          onDelete: 'cascade',
        },
      },
    ],
  },

  {
    id: 'lld-checkout-seq',
    name: 'Checkout Sequence',
    description: 'Customer, API and payment gateway over one checkout call',
    preview: 'Customer → API → Payments → API',
    type: 'sequence',
    shapes: [
      {
        key: 'customer',
        spawn: { shape: 'lldLifeline', lifelineKind: 'actor', label: 'Customer' },
        at: { x: 200, y: 80 },
      },
      {
        key: 'api',
        spawn: { shape: 'lldLifeline', lifelineKind: 'boundary', label: 'CheckoutAPI' },
        at: { x: 460, y: 80 },
      },
      {
        key: 'payments',
        spawn: { shape: 'lldLifeline', lifelineKind: 'control', label: 'Payments' },
        at: { x: 720, y: 80 },
      },
    ],
    // `order` is the slot on the vertical time axis, so these read top to bottom.
    edges: [
      { from: 'customer', to: 'api', data: { kind: 'msg-sync', label: 'checkout(cart)', order: 1 } },
      { from: 'api', to: 'payments', data: { kind: 'msg-sync', label: 'charge(total)', order: 2 } },
      { from: 'payments', to: 'api', data: { kind: 'msg-return', label: 'receipt', order: 3 } },
      { from: 'api', to: 'customer', data: { kind: 'msg-return', label: 'order confirmed', order: 4 } },
    ],
  },

  {
    id: 'lld-login-state',
    name: 'Session State Machine',
    description: 'Login states with guarded transitions',
    preview: 'Anonymous → Authenticating → Active → Expired',
    type: 'state',
    shapes: [
      {
        key: 'start',
        spawn: { shape: 'lldState', stateKind: 'initial' },
        at: { x: 160, y: 200 },
      },
      {
        key: 'anon',
        spawn: { shape: 'lldState', stateKind: 'state', label: 'Anonymous' },
        at: { x: 320, y: 200 },
      },
      {
        key: 'auth',
        spawn: { shape: 'lldState', stateKind: 'state', label: 'Authenticating' },
        at: { x: 560, y: 200 },
      },
      {
        key: 'active',
        spawn: { shape: 'lldState', stateKind: 'state', label: 'Active' },
        at: { x: 800, y: 200 },
      },
      {
        key: 'expired',
        spawn: { shape: 'lldState', stateKind: 'state', label: 'Expired' },
        at: { x: 800, y: 380 },
      },
      {
        key: 'end',
        spawn: { shape: 'lldState', stateKind: 'final' },
        at: { x: 1000, y: 380 },
      },
    ],
    edges: [
      { from: 'start', to: 'anon', data: { kind: 'state-transition' } },
      { from: 'anon', to: 'auth', data: { kind: 'state-transition', event: 'submit' } },
      {
        from: 'auth',
        to: 'active',
        data: { kind: 'state-transition', event: 'ok', guard: 'valid credentials' },
      },
      {
        from: 'auth',
        to: 'anon',
        data: { kind: 'state-transition', event: 'reject', action: 'show error' },
      },
      { from: 'active', to: 'expired', data: { kind: 'state-transition', event: 'timeout' } },
      { from: 'expired', to: 'end', data: { kind: 'state-transition', event: 'sign out' } },
    ],
  },
]

// ─── building ─────────────────────────────────────────────────────────────────

/**
 * Turn a template into shapes and edges ready for the store.
 *
 * Ids are minted here rather than written into the template, so loading the same starter
 * twice cannot collide, and edges are wired through the local `key` handles.
 */
export function buildLldTemplate(template: LldTemplate): LldDiagramSnapshot {
  const idByKey = new Map<string, string>()

  const shapes: LldShape[] = template.shapes.map((seed) => {
    const shape = spawnShape(seed.spawn, seed.at)
    idByKey.set(seed.key, shape.id)

    if (!seed.data) return shape
    // Merged rather than replaced, so a template only states what it cares about.
    return { ...shape, data: { ...shape.data, ...seed.data } } as LldShape
  })

  const edges: LldEdge[] = []
  for (const seed of template.edges) {
    const source = idByKey.get(seed.from)
    const target = idByKey.get(seed.to)
    // A template referring to a shape it never declared is a bug in the template, not
    // something to render half of.
    if (!source || !target) continue

    edges.push({
      id: generateId(),
      source,
      target,
      type: edgeTypeForKind(seed.data.kind),
      data: seed.data,
    } as LldEdge)
  }

  return { shapes, edges }
}

export function getLldTemplateById(id: string): LldTemplate | undefined {
  return lldTemplates.find((t) => t.id === id)
}
