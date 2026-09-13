import type { ArchitectureNode, ArchitectureEdge, BoardMode } from './diagram'

// ─── Presence ─────────────────────────────────────────────────────────────────

/** A peer's pointer, in flow coordinates. */
export interface PeerCursor {
  x: number
  y: number
}

/**
 * What we know about another person in the room.
 *
 * The cursor is stored in flow coordinates rather than screen pixels: every participant
 * has their own pan and zoom, so a screen position would land somewhere different in each
 * window. Flow coordinates are the only frame everyone agrees on.
 */
export interface PeerState {
  userId: string
  name: string
  /** Derived from the user id, so every client shows this person the same way. */
  color: string
  cursor: PeerCursor | null
  /** Node ids they have selected, so their selection can be outlined. */
  selection: string[]
  /** Which board they are on — a peer in LLD should not appear on the HLD canvas. */
  board: BoardMode
  /** Epoch ms of their last update, for dropping stale peers. */
  at: number
}

// ─── Document operations ──────────────────────────────────────────────────────

/**
 * A single change to the document.
 *
 * Granular operations rather than whole-document snapshots, because the existing save is a
 * whole-document PATCH with last-write-wins: two people editing means whoever saves last
 * silently destroys the other's work. Per-entity operations let independent edits merge,
 * and only conflict when two people touch the same node.
 */
export type CollabOp =
  | { t: 'node:add'; node: ArchitectureNode }
  | { t: 'node:move'; id: string; position: { x: number; y: number } }
  | { t: 'node:data'; id: string; data: Record<string, unknown> }
  | { t: 'node:remove'; id: string }
  | { t: 'edge:add'; edge: ArchitectureEdge }
  | { t: 'edge:data'; id: string; data: Record<string, unknown> }
  | { t: 'edge:remove'; id: string }
  | { t: 'diagram:name'; name: string }

export type CollabOpType = CollabOp['t']

/**
 * An operation as it travels over the wire.
 *
 * `from` lets a client ignore its own echo; `board` keeps HLD and LLD edits from being
 * applied to the wrong canvas.
 */
export interface OpEnvelope {
  from: string
  board: BoardMode
  op: CollabOp
  at: number
}

/** How the local client is participating. */
export type CollabRole = 'owner' | 'editor' | 'viewer'

export type CollabStatus = 'offline' | 'connecting' | 'live' | 'error'
