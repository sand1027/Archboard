import type { ArchitectureEdge, ArchitectureNode } from '@/types/diagram'
import type { CollabOp } from '@/types/collab'

/**
 * Applying a remote change to the local document.
 *
 * Pure and separate from the transport so the merge rules can be tested without a network:
 * this is the part that decides whether two people editing at once keeps both their work.
 *
 * Every operation is idempotent. Broadcast delivery is at-most-once but a client can still
 * see a message twice — its own echo, or a replay after reconnecting — and an `add` that
 * duplicated a node on redelivery would be worse than one that was dropped.
 */

export interface DocumentSlice {
  nodes: ArchitectureNode[]
  edges: ArchitectureEdge[]
}

/**
 * Apply one operation.
 *
 * Returns the original object when nothing changed, so callers can skip a store write and
 * avoid a needless re-render.
 */
export function applyOp(doc: DocumentSlice, op: CollabOp): DocumentSlice {
  switch (op.t) {
    case 'node:add': {
      if (doc.nodes.some((n) => n.id === op.node.id)) return doc
      return { ...doc, nodes: [...doc.nodes, op.node] }
    }

    case 'node:move': {
      let moved = false
      const nodes = doc.nodes.map((n) => {
        if (n.id !== op.id) return n
        if (n.position.x === op.position.x && n.position.y === op.position.y) return n
        moved = true
        return { ...n, position: { ...op.position } }
      })
      return moved ? { ...doc, nodes } : doc
    }

    case 'node:data': {
      let found = false
      const nodes = doc.nodes.map((n) => {
        if (n.id !== op.id) return n
        found = true
        // Merged, not replaced: the sender only transmits the fields it changed, so a
        // wholesale replace would wipe anything the receiver knows and the sender does not.
        return { ...n, data: { ...n.data, ...op.data } } as ArchitectureNode
      })
      return found ? { ...doc, nodes } : doc
    }

    case 'node:remove': {
      if (!doc.nodes.some((n) => n.id === op.id)) return doc
      return {
        nodes: doc.nodes.filter((n) => n.id !== op.id),
        // Edges to a node that no longer exists would render as lines to nowhere.
        edges: doc.edges.filter((e) => e.source !== op.id && e.target !== op.id),
      }
    }

    case 'edge:add': {
      if (doc.edges.some((e) => e.id === op.edge.id)) return doc
      // An edge whose endpoints have not arrived yet cannot be drawn. Dropping it is safe:
      // the sender's next full save carries it, and rendering a dangling edge is worse.
      const hasEnds =
        doc.nodes.some((n) => n.id === op.edge.source) &&
        doc.nodes.some((n) => n.id === op.edge.target)
      if (!hasEnds) return doc
      return { ...doc, edges: [...doc.edges, op.edge] }
    }

    case 'edge:data': {
      let found = false
      const edges = doc.edges.map((e) => {
        if (e.id !== op.id) return e
        found = true
        return { ...e, data: { ...e.data, ...op.data } } as ArchitectureEdge
      })
      return found ? { ...doc, edges } : doc
    }

    case 'edge:remove': {
      if (!doc.edges.some((e) => e.id === op.id)) return doc
      return { ...doc, edges: doc.edges.filter((e) => e.id !== op.id) }
    }

    case 'diagram:name':
      // Handled by the caller, which owns the name; nothing to change in the slice.
      return doc
  }
}

/** Apply a batch in order. */
export function applyOps(doc: DocumentSlice, ops: CollabOp[]): DocumentSlice {
  return ops.reduce(applyOp, doc)
}

/**
 * Diff two node lists into operations.
 *
 * Used to turn a local store change into something transmittable without instrumenting
 * every mutation site. Position and data are compared separately so dragging a node emits a
 * small move rather than its entire data bag.
 */
export function diffNodes(
  previous: ArchitectureNode[],
  next: ArchitectureNode[]
): CollabOp[] {
  const ops: CollabOp[] = []
  const before = new Map(previous.map((n) => [n.id, n]))

  for (const node of next) {
    const old = before.get(node.id)
    if (!old) {
      ops.push({ t: 'node:add', node })
      continue
    }
    before.delete(node.id)

    if (old.position.x !== node.position.x || old.position.y !== node.position.y) {
      ops.push({ t: 'node:move', id: node.id, position: { ...node.position } })
    }
    if (old.data !== node.data) {
      ops.push({ t: 'node:data', id: node.id, data: { ...node.data } })
    }
  }

  // Anything left was present before and is gone now.
  for (const id of before.keys()) ops.push({ t: 'node:remove', id })

  return ops
}

export function diffEdges(
  previous: ArchitectureEdge[],
  next: ArchitectureEdge[]
): CollabOp[] {
  const ops: CollabOp[] = []
  const before = new Map(previous.map((e) => [e.id, e]))

  for (const edge of next) {
    const old = before.get(edge.id)
    if (!old) {
      ops.push({ t: 'edge:add', edge })
      continue
    }
    before.delete(edge.id)

    if (old.data !== edge.data) {
      ops.push({ t: 'edge:data', id: edge.id, data: { ...(edge.data ?? {}) } })
    }
  }

  for (const id of before.keys()) ops.push({ t: 'edge:remove', id })

  return ops
}

/** Cap on operations sent for a single change, so a bulk paste cannot flood the channel. */
export const MAX_OPS_PER_FLUSH = 200
