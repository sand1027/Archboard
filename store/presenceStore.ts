'use client'

import { create } from 'zustand'
import type { CollabStatus, PeerState } from '@/types/collab'

/**
 * Who else is in the room.
 *
 * Separate from diagramStore because presence is not document state: it must not be
 * persisted, must not participate in undo, and changes many times a second while a cursor
 * moves. Mixing it into the document store would push cursor traffic through the save
 * dirty-flag subscription and the history stack.
 */
interface PresenceState {
  status: CollabStatus
  /** Peers keyed by user id, excluding ourselves. */
  peers: Record<string, PeerState>
  /** Our own identity in the room, once joined. */
  self: { userId: string; name: string; color: string } | null

  setStatus: (status: CollabStatus) => void
  setSelf: (self: PresenceState['self']) => void
  replacePeers: (peers: PeerState[]) => void
  reset: () => void
}

export const usePresenceStore = create<PresenceState>()((set) => ({
  status: 'offline',
  peers: {},
  self: null,

  setStatus: (status) => set({ status }),
  setSelf: (self) => set({ self }),

  /**
   * Presence arrives as a full snapshot rather than a delta, so the map is replaced outright.
   * Merging would leave a departed peer's cursor on the canvas forever.
   */
  replacePeers: (peers) =>
    set(() => {
      const next: Record<string, PeerState> = {}
      for (const peer of peers) next[peer.userId] = peer
      return { peers: next }
    }),

  reset: () => set({ status: 'offline', peers: {}, self: null }),
}))

/** Peers currently looking at the given board, sorted for a stable avatar order. */
export function peersOnBoard(peers: Record<string, PeerState>, board: string): PeerState[] {
  return Object.values(peers)
    .filter((peer) => peer.board === board)
    .sort((a, b) => (a.userId < b.userId ? -1 : 1))
}
