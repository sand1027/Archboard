'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useDiagramStore } from '@/store/diagramStore'
import { usePresenceStore } from '@/store/presenceStore'
import {
  joinDiagramChannel,
  type CollabChannel,
  type OpPayload,
  type PresencePayload,
} from '@/lib/collab/channel'
import { peerColor, peerName } from '@/lib/collab/identity'
import { applyStamped, createClock, noteLocal, type Clock, type VersionMap } from '@/lib/collab/crdt'
import { diffEdges, diffNodes, MAX_OPS_PER_FLUSH } from '@/lib/collab/ops'
import type { CollabOp } from '@/types/collab'

/**
 * Cursor updates per second.
 *
 * A pointer move fires far faster than anyone can perceive, and presence is resent in full on
 * every track. 20/s reads as smooth while keeping the channel quiet enough to leave headroom
 * for the edits, which matter more.
 */
const CURSOR_HZ = 20
const CURSOR_INTERVAL_MS = 1000 / CURSOR_HZ

export interface CollaborationOptions {
  diagramId: string
  userId: string
  email?: string | null
  name?: string | null
  /** Viewers may watch and be seen, but their edits are not broadcast. */
  canEdit?: boolean
}

/**
 * Live collaboration for one diagram: presence out, peers in, edits both ways.
 *
 * Local edits are detected by diffing the store rather than by instrumenting every mutation
 * site. There are dozens of those — the inspector, the context menu, keyboard shortcuts,
 * templates — and threading a broadcast through each one would guarantee that some path was
 * missed and silently failed to replicate.
 */
export function useCollaboration({
  diagramId,
  userId,
  email,
  name,
  canEdit = true,
}: CollaborationOptions) {
  const { screenToFlowPosition } = useReactFlow()

  const channelRef = useRef<CollabChannel | null>(null)
  const clockRef = useRef<Clock | null>(null)
  const versionsRef = useRef<VersionMap>(new Map())

  // Set while a remote operation is being written to the store, so the diff subscription does
  // not mistake it for a local edit and echo it back around the room.
  const applyingRemote = useRef(false)

  const lastCursorAt = useRef(0)
  const cursorRef = useRef<{ x: number; y: number } | null>(null)

  const displayName = peerName({ name, email })
  const color = peerColor(userId)

  /**
   * Our presence payload, built from whatever is current.
   *
   * Held in a ref so the channel can ask for it without the join effect depending on it —
   * otherwise every rename or board change would tear down and rebuild the connection.
   */
  const buildPresenceRef = useRef<() => PresencePayload>(() => ({
    userId,
    name: displayName,
    color,
    board: 'hld',
    cursor: null,
    selection: [],
    at: Date.now(),
  }))

  buildPresenceRef.current = () => {
    const store = useDiagramStore.getState()
    return {
      userId,
      name: displayName,
      color,
      board: store.activeBoard,
      cursor: cursorRef.current,
      selection: store.selectedNodeIds,
      at: Date.now(),
    }
  }

  // ── inbound ─────────────────────────────────────────────────────────────────
  // Declared before the join effect that closes over it. It is stable, so the ordering is
  // currently harmless, but a channel holding a stale applier would be a hard bug to find.
  const applyRemote = useCallback((payload: OpPayload) => {
    const store = useDiagramStore.getState()
    // An operation for the other board belongs to that board's snapshot, not the live one.
    if (payload.board !== store.activeBoard) return

    clockRef.current?.observe(payload.stamp)

    const result = applyStamped(
      { nodes: store.nodes, edges: store.edges },
      versionsRef.current,
      { op: payload.op, stamp: payload.stamp }
    )
    if (!result.applied) return

    applyingRemote.current = true
    try {
      if (result.doc.nodes !== store.nodes) store.setNodes(result.doc.nodes)
      if (result.doc.edges !== store.edges) store.setEdges(result.doc.edges)
      if (payload.op.t === 'diagram:name') store.setDiagramName(payload.op.name)
    } finally {
      applyingRemote.current = false
    }
  }, [])

  // ── join ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!diagramId || !userId) return

    clockRef.current = createClock(userId)
    versionsRef.current = new Map()

    const presence = usePresenceStore.getState()
    presence.setSelf({ userId, name: displayName, color })

    const channel = joinDiagramChannel(diagramId, userId, {
      onPeers: (peers) => usePresenceStore.getState().replacePeers(peers),
      onStatus: (status) => usePresenceStore.getState().setStatus(status),
      onOp: (payload) => applyRemote(payload),
      // Read at join time rather than captured, so a reconnect re-announces where the pointer
      // actually is instead of where it was when the tab opened.
      getPresence: () => buildPresenceRef.current(),
    })
    channelRef.current = channel

    return () => {
      channel.leave()
      channelRef.current = null
      usePresenceStore.getState().reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramId, userId, applyRemote])

  // ── outbound edits ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canEdit) return

    let previousNodes = useDiagramStore.getState().nodes
    let previousEdges = useDiagramStore.getState().edges

    const unsubscribe = useDiagramStore.subscribe(
      (state) => [state.nodes, state.edges] as const,
      ([nodes, edges]) => {
        const channel = channelRef.current
        const clock = clockRef.current

        // Remote writes are already everyone else's; re-sending would loop.
        if (applyingRemote.current || !channel || !clock) {
          previousNodes = nodes
          previousEdges = edges
          return
        }

        const ops: CollabOp[] = [
          ...diffNodes(previousNodes, nodes),
          ...diffEdges(previousEdges, edges),
        ]
        previousNodes = nodes
        previousEdges = edges

        if (ops.length === 0) return

        const board = useDiagramStore.getState().activeBoard

        // A bulk paste or a template drop can produce hundreds of operations at once. Past the
        // cap the channel would be the bottleneck, and a manual save resyncs anyway.
        for (const op of ops.slice(0, MAX_OPS_PER_FLUSH)) {
          const stamp = clock.next()
          noteLocal(versionsRef.current, op, stamp)
          channel.send({ from: userId, board, op, stamp })
        }
      },
      { equalityFn: (a, b) => a[0] === b[0] && a[1] === b[1] }
    )

    return unsubscribe
  }, [canEdit, userId])

  // ── outbound presence ───────────────────────────────────────────────────────
  const publishCursor = useCallback((cursor: { x: number; y: number } | null) => {
    const channel = channelRef.current
    if (!channel) return
    cursorRef.current = cursor
    channel.track(buildPresenceRef.current())
  }, [])

  /**
   * Pointer tracking is attached to the canvas element rather than surfaced as props.
   *
   * The alternative was threading handlers through CanvasShell into Whiteboard's wrapper div,
   * which couples three components to a feature none of them own.
   */
  useEffect(() => {
    if (!diagramId || !userId) return

    const pane = document.querySelector('.react-flow')
    if (!(pane instanceof HTMLElement)) return

    const onMove = (event: PointerEvent) => {
      const now = Date.now()
      if (now - lastCursorAt.current < CURSOR_INTERVAL_MS) return
      lastCursorAt.current = now

      // Flow coordinates, not screen pixels: every participant has their own pan and zoom, so
      // a screen position would land somewhere different in each window.
      publishCursor(screenToFlowPosition({ x: event.clientX, y: event.clientY }))
    }

    // Clear on leave, or the pointer hangs at wherever it was last seen.
    const onLeave = () => publishCursor(null)

    pane.addEventListener('pointermove', onMove)
    pane.addEventListener('pointerleave', onLeave)

    return () => {
      pane.removeEventListener('pointermove', onMove)
      pane.removeEventListener('pointerleave', onLeave)
    }
  }, [diagramId, userId, screenToFlowPosition, publishCursor])

  // Re-announce when the board changes, so peers stop drawing us on a canvas we left.
  useEffect(() => {
    const unsubscribe = useDiagramStore.subscribe(
      (state) => state.activeBoard,
      () => publishCursor(cursorRef.current)
    )
    return unsubscribe
  }, [publishCursor])
}
