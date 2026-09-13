'use client'

import { useCollaboration } from '@/hooks/useCollaboration'

/**
 * Drives collaboration for the current diagram.
 *
 * Renders nothing. It exists so the hook can live inside ReactFlowProvider — it needs
 * `screenToFlowPosition` — while still being mounted where the diagram id and the signed-in
 * user are known. The cursors themselves are drawn by CursorLayer inside the canvas.
 *
 * Only mounted in cloud mode: a local diagram has no id to form a channel around and no other
 * participants to meet.
 */
export default function CollaborationLayer({
  diagramId,
  userId,
  userEmail,
}: {
  diagramId: string
  userId: string
  userEmail?: string
}) {
  useCollaboration({ diagramId, userId, email: userEmail })
  return null
}
