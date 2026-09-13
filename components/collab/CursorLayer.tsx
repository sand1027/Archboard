'use client'

import { memo } from 'react'
import { ViewportPortal } from '@xyflow/react'
import { usePresenceStore } from '@/store/presenceStore'
import { useDiagramStore } from '@/store/diagramStore'
import type { PeerState } from '@/types/collab'

/**
 * Other people's pointers.
 *
 * Rendered through ViewportPortal, so the layer sits inside React Flow's transformed viewport
 * and cursors track pan and zoom without any conversion. Peer positions arrive in flow
 * coordinates for the same reason: it is the only frame all participants share.
 */
function CursorLayer() {
  const peers = usePresenceStore((s) => s.peers)
  const activeBoard = useDiagramStore((s) => s.activeBoard)

  const visible = Object.values(peers).filter(
    // Someone reading the LLD should not appear as a ghost on the HLD canvas.
    (peer) => peer.cursor && peer.board === activeBoard
  )

  if (visible.length === 0) return null

  return (
    <ViewportPortal>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          // Decoration: must never swallow a click meant for the canvas.
          pointerEvents: 'none',
          // Above nodes and the simulation layer, since a cursor is the most transient thing
          // on screen and being occluded makes it useless.
          zIndex: 10,
        }}
        aria-hidden
      >
        {visible.map((peer) => (
          <PeerCursor key={peer.userId} peer={peer} />
        ))}
      </div>
    </ViewportPortal>
  )
}

function PeerCursor({ peer }: { peer: PeerState }) {
  if (!peer.cursor) return null

  return (
    <div
      style={{
        position: 'absolute',
        // The hotspot is the arrow tip, so no centring offset — translate puts the tip exactly
        // on the reported point.
        transform: `translate(${peer.cursor.x}px, ${peer.cursor.y}px)`,
        // Cheap smoothing between the 20/s presence updates; without it the pointer steps.
        transition: 'transform 90ms linear',
        willChange: 'transform',
      }}
    >
      {/* Pointer. Drawn rather than an emoji so it can take the peer's colour, with a white
          outline to stay visible over a dark node. */}
      <svg
        width={20}
        height={20}
        viewBox="0 0 20 20"
        style={{ display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}
      >
        <path
          d="M2 2 L2 15.5 L6.2 11.6 L8.8 17.8 L11.6 16.6 L9 10.5 L14.5 10.2 Z"
          fill={peer.color}
          stroke="#ffffff"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      </svg>

      {/* Name, below and slightly right of the tip so it never covers what they are pointing at. */}
      <div
        style={{
          position: 'absolute',
          left: 14,
          top: 16,
          padding: '2px 6px',
          borderRadius: 6,
          background: peer.color,
          color: '#ffffff',
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 1.4,
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      >
        {peer.name}
      </div>
    </div>
  )
}

export default memo(CursorLayer)
