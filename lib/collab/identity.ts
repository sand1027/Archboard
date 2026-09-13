/**
 * Who a collaborator is, visually.
 *
 * Colour is derived from the user id rather than handed out on join. Everyone in the
 * room must see the same person in the same colour, and join order differs per client —
 * assigning from a rotating index would give the same user a different colour in every
 * other participant's window, which makes the cursors impossible to follow.
 */

/**
 * Cursor palette.
 *
 * Chosen to stay legible against a white canvas and to be distinguishable from the
 * simulation's own colours, so a peer's pointer is never mistaken for a packet.
 */
export const PEER_COLORS = [
  '#6366F1', // indigo
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
  '#8B5CF6', // violet
  '#0EA5E9', // sky
  '#84CC16', // lime
  '#F43F5E', // rose
] as const

/**
 * A stable 32-bit hash of a string.
 *
 * FNV-1a: tiny, no dependencies, and well spread for short inputs like a UUID — which
 * matters, because two collaborators landing on the same colour defeats the point.
 */
export function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    // 16777619, via shifts to stay in 32-bit integer arithmetic.
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/** The colour for a user. Same input, same colour, on every client. */
export function peerColor(userId: string): string {
  if (!userId) return PEER_COLORS[0]
  return PEER_COLORS[hashString(userId) % PEER_COLORS.length]
}

/**
 * A short display name.
 *
 * Prefers a real name, falls back to the local part of an email — "sandeep" reads better
 * on a cursor label than "sandeep@example.com", which would be wider than most nodes.
 */
export function peerName(input: { name?: string | null; email?: string | null }): string {
  const name = input.name?.trim()
  if (name) return name

  const email = input.email?.trim()
  if (email) {
    const local = email.split('@')[0]
    if (local) return local
  }

  return 'Guest'
}

/** One or two initials, for a compact avatar. */
export function peerInitials(displayName: string): string {
  const parts = displayName.trim().split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
