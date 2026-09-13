'use client'

import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { BoardMode } from '@/types/diagram'
import type { CollabOp, PeerState } from '@/types/collab'
import type { OpStamp } from './crdt'

/**
 * The realtime channel for one diagram.
 *
 * Presence and document operations share a single channel: they are the same conversation,
 * and a second socket per diagram would double the connection count for no benefit.
 *
 * Nothing here needs table replication. Supabase presence and broadcast are channel features,
 * so no publication changes were required in the migration.
 */

/** Wire shape of a presence entry. Kept flat and small — presence is resent in full. */
export interface PresencePayload {
  userId: string
  name: string
  color: string
  board: BoardMode
  cursor: { x: number; y: number } | null
  selection: string[]
  at: number
}

/** Wire shape of a document operation. */
export interface OpPayload {
  from: string
  board: BoardMode
  op: CollabOp
  stamp: OpStamp
}

export const OP_EVENT = 'op'

/** Presence entries older than this are dropped; a tab closed without unsubscribing lingers. */
export const PEER_TTL_MS = 30_000

export function channelName(diagramId: string): string {
  return `diagram:${diagramId}`
}

export interface CollabChannelHandlers {
  /** Called with the full peer list on every presence change. */
  onPeers: (peers: PeerState[]) => void
  onOp: (payload: OpPayload) => void
  onStatus: (status: 'connecting' | 'live' | 'error') => void
  /**
   * Our current presence, requested once the channel is joined.
   *
   * Presence cannot be published before the subscription completes — an early `track` is sent
   * on a channel that has not joined and is lost, so nobody ever sees us. Asking for it here
   * also means a reconnect re-announces us instead of leaving us invisible.
   */
  getPresence: () => PresencePayload
}

export interface CollabChannel {
  /** Publish our own presence. Safe to call often; Supabase diffs it. */
  track: (payload: PresencePayload) => void
  /** Send document operations. */
  send: (payload: OpPayload) => void
  leave: () => void
}

/**
 * Join a diagram's channel.
 *
 * `presence.key` is the user id so a peer is identified by who they are rather than by
 * connection: reconnecting replaces their entry instead of appearing as a second person.
 * The trade-off is that the same user in two tabs is one peer, which is the right call —
 * seeing your own cursor as a stranger's is worse.
 */
export function joinDiagramChannel(
  diagramId: string,
  selfUserId: string,
  handlers: CollabChannelHandlers
): CollabChannel {
  const supabase = createClient()

  const channel: RealtimeChannel = supabase.channel(channelName(diagramId), {
    config: {
      presence: { key: selfUserId, enabled: true },
      // We apply our own edits locally the moment they happen, so echoing them back would
      // only cost bandwidth and risk a redundant re-render.
      broadcast: { self: false },
    },
  })

  const readPeers = () => {
    const state = channel.presenceState<PresencePayload>()
    const now = Date.now()
    const peers: PeerState[] = []

    for (const entries of Object.values(state)) {
      // Supabase keeps an array per key; the last entry is the most recent for that client.
      const entry = entries[entries.length - 1]
      if (!entry || typeof entry.userId !== 'string') continue
      if (entry.userId === selfUserId) continue
      if (typeof entry.at === 'number' && now - entry.at > PEER_TTL_MS) continue

      peers.push({
        userId: entry.userId,
        name: entry.name,
        color: entry.color,
        board: entry.board,
        cursor: entry.cursor ?? null,
        selection: Array.isArray(entry.selection) ? entry.selection : [],
        at: entry.at ?? now,
      })
    }

    handlers.onPeers(peers)
  }

  channel
    .on('presence', { event: 'sync' }, readPeers)
    .on('presence', { event: 'join' }, readPeers)
    .on('presence', { event: 'leave' }, readPeers)
    .on('broadcast', { event: OP_EVENT }, ({ payload }) => {
      const message = payload as OpPayload | undefined
      // Guard the echo defensively as well as via `broadcast.self`, since a reconnect replay
      // could deliver our own messages back to us.
      if (!message?.op || message.from === selfUserId) return
      handlers.onOp(message)
    })

  handlers.onStatus('connecting')

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      handlers.onStatus('live')
      // Announce ourselves only now. Also covers reconnects, which re-run this callback.
      void channel.track(handlers.getPresence())
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      handlers.onStatus('error')
    } else if (status === 'CLOSED') {
      handlers.onStatus('connecting')
    }
  })

  return {
    track: (payload) => {
      void channel.track(payload)
    },
    send: (payload) => {
      void channel.send({ type: 'broadcast', event: OP_EVENT, payload })
    },
    leave: () => {
      void channel.untrack()
      void supabase.removeChannel(channel)
    },
  }
}
