'use client'

import { useParams } from 'next/navigation'

/**
 * The `diagrams.id` from the URL — i.e. the Supabase row id.
 *
 * Deliberately NOT `useDiagramStore().diagramId`. That field holds the *board's*
 * internal id, minted locally by `emptyBoard()` via `generateId()`, and it has
 * nothing to do with the persisted row. Building a link from it yields
 * `/diagram/<board-id>/lld/<componentId>`, which 404s because no such diagram
 * row exists.
 *
 * Returns null when rendered outside a `/diagram/[id]` route, so callers can
 * skip navigation rather than push a broken URL.
 */
export function useDiagramRouteId(): string | null {
  const params = useParams<{ id?: string | string[] }>()
  const id = params?.id
  if (typeof id === 'string' && id) return id
  if (Array.isArray(id) && typeof id[0] === 'string' && id[0]) return id[0]
  return null
}

/** Path to a component's LLD workspace, or null when the route id is unknown. */
export function lldWorkspacePath(
  diagramRouteId: string | null,
  componentId: string
): string | null {
  return diagramRouteId ? `/diagram/${diagramRouteId}/lld/${componentId}` : null
}
