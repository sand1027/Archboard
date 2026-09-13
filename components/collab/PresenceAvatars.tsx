'use client'

import { memo } from 'react'
import { usePresenceStore } from '@/store/presenceStore'
import { peerInitials } from '@/lib/collab/identity'

/** Beyond this, avatars are collapsed into a count rather than shrinking the toolbar. */
const MAX_VISIBLE = 4

/**
 * Who else is in the diagram, in the toolbar.
 *
 * Separate from the cursor layer on purpose: a collaborator whose pointer is off-screen, or who
 * is reading the LLD while you are on the HLD, has no cursor to draw but is still present. Only
 * the avatars tell you they are there.
 */
function PresenceAvatars() {
  const peers = usePresenceStore((s) => s.peers)
  const status = usePresenceStore((s) => s.status)

  const list = Object.values(peers)

  /*
    Always show the connection state, even alone.

    "Connected, nobody else here" and "not connected at all" previously looked identical —
    both rendered nothing — which made a broken channel impossible to tell from an empty room.
  */
  if (list.length === 0) {
    return (
      <span
        className="flex items-center gap-1.5 text-[10px] font-medium"
        title={
          status === 'live'
            ? 'Connected — nobody else is here'
            : status === 'error'
              ? 'Live collaboration could not connect'
              : 'Connecting to live collaboration'
        }
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background:
              status === 'live' ? '#10B981' : status === 'error' ? '#EF4444' : '#F59E0B',
          }}
        />
        <span className="text-slate-400">
          {status === 'live' ? 'Live' : status === 'error' ? 'Offline' : 'Connecting'}
        </span>
      </span>
    )
  }

  const visible = list.slice(0, MAX_VISIBLE)
  const overflow = list.length - visible.length

  return (
    <div className="flex items-center" aria-label={`${list.length} other people here`}>
      {visible.map((peer, index) => (
        <span
          key={peer.userId}
          title={peer.name}
          className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white"
          style={{
            background: peer.color,
            // Overlapped so a full room stays compact, with a ring to keep them distinct.
            boxShadow: '0 0 0 2px #ffffff',
            marginLeft: index === 0 ? 0 : -6,
            zIndex: MAX_VISIBLE - index,
          }}
        >
          {peerInitials(peer.name)}
        </span>
      ))}

      {overflow > 0 && (
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[9px] font-semibold text-slate-600"
          style={{ boxShadow: '0 0 0 2px #ffffff', marginLeft: -6 }}
          title={list.slice(MAX_VISIBLE).map((p) => p.name).join(', ')}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}

export default memo(PresenceAvatars)
