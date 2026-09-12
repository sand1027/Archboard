/**
 * Single authority on which nodes can be connected.
 *
 * React Flow honours a per-node `connectable` flag over the canvas-wide
 * `nodesConnectable`, so a stale `false` baked into saved data permanently
 * disables wiring for that node — silently, with no error. That flag was written
 * by older spawn paths (when HLD connecting did not exist), by `buildShapeNode`
 * for every shape on the HLD board, and it survives in templates and exported
 * JSON.
 *
 * Rather than chase every producer, normalise on the way in: strip the flag from
 * anything that *should* be connectable so the canvas decides, and keep an
 * explicit `false` only on genuine scenery.
 */

/** Node types that are decoration, never connection endpoints. */
const NEVER_CONNECTABLE = new Set([
  'frame',
  'lldBoundary',
  'lldSwimlane',
  'lldFragment',
  'lldNote',
  'lldActivation',
])

/** Shape kinds that cannot host an endpoint even though `shape` generally can. */
const NEVER_CONNECTABLE_SHAPES = new Set(['line', 'arrow', 'text'])

interface ConnectivityNode {
  type?: string
  data?: Record<string, unknown>
  connectable?: boolean
}

export function isConnectableNode(node: ConnectivityNode): boolean {
  if (NEVER_CONNECTABLE.has(node.type ?? '')) return false

  if (node.type === 'shape') {
    const shapeType = String(node.data?.shapeType ?? '')
    if (NEVER_CONNECTABLE_SHAPES.has(shapeType)) return false
    if (shapeType.startsWith('arrow')) return false
  }

  return true
}

/**
 * Normalise one node's `connectable` flag.
 *
 * Connectable nodes have the field removed entirely — absent means "defer to the
 * canvas", which is what lets `nodesConnectable` gate on the active tool.
 */
export function normaliseNodeConnectable<T extends ConnectivityNode>(node: T): T {
  const shouldConnect = isConnectableNode(node)

  if (!shouldConnect) {
    return node.connectable === false ? node : { ...node, connectable: false }
  }

  if (node.connectable === undefined) return node
  const { connectable: _drop, ...rest } = node
  return rest as T
}

/** Normalise a whole board. Returns the original array when nothing changed. */
export function normaliseNodesConnectable<T extends ConnectivityNode>(nodes: T[]): T[] {
  let changed = false
  const next = nodes.map((node) => {
    const normalised = normaliseNodeConnectable(node)
    if (normalised !== node) changed = true
    return normalised
  })
  return changed ? next : nodes
}
