import { MAX_DIAGRAM_COLLABORATORS } from '@/lib/supabase/types'

/**
 * Validating an invite before it reaches the database.
 *
 * The collaborator cap and the uniqueness rule are enforced by a trigger and a constraint, and
 * that is where they belong — the API can be called directly. But a Postgres error surfaces as
 * a wall of text with an error code in it, so the same rules are checked here to produce a
 * sentence someone can act on. The database stays the authority; this is only the explanation.
 */

/** Lowercased and trimmed, matching the normalising trigger on `diagram_shares`. */
export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Good enough email validation.
 *
 * Deliberately not RFC 5322: a full grammar rejects addresses that work and accepts ones that
 * do not, and the real test is whether the invite is ever opened. This catches typos.
 */
export function isValidEmail(raw: string): boolean {
  const email = normaliseEmail(raw)
  if (email.length < 5 || email.length > 320) return false
  if (/\s/.test(email)) return false

  const parts = email.split('@')
  if (parts.length !== 2) return false

  const [local, domain] = parts
  if (!local || !domain) return false
  if (!domain.includes('.')) return false
  if (domain.startsWith('.') || domain.endsWith('.')) return false
  if (domain.includes('..')) return false

  return true
}

export type InviteRejection = 'invalid' | 'duplicate' | 'self' | 'limit'

export type InviteCheck =
  | { ok: true; email: string }
  | { ok: false; reason: InviteRejection; message: string }

export interface InviteContext {
  /** Raw input from the form. */
  email: string
  /** Emails already invited to this diagram. */
  existing: readonly string[]
  /** The owner's own email, if known. */
  ownerEmail?: string | null
  limit?: number
}

/**
 * Whether an invite can be sent, and why not.
 *
 * Ordered so the most useful message wins: an address that is both malformed and a duplicate
 * is reported as malformed, because that is the thing to fix.
 */
export function checkInvite({
  email,
  existing,
  ownerEmail,
  limit = MAX_DIAGRAM_COLLABORATORS,
}: InviteContext): InviteCheck {
  const candidate = normaliseEmail(email)

  if (!isValidEmail(candidate)) {
    return { ok: false, reason: 'invalid', message: 'That does not look like an email address.' }
  }

  if (ownerEmail && candidate === normaliseEmail(ownerEmail)) {
    return { ok: false, reason: 'self', message: 'You already have access as the owner.' }
  }

  if (existing.some((current) => normaliseEmail(current) === candidate)) {
    return { ok: false, reason: 'duplicate', message: 'They already have access to this diagram.' }
  }

  if (existing.length >= limit) {
    return {
      ok: false,
      reason: 'limit',
      // Points at the way forward rather than just refusing.
      message: `A diagram can be shared with ${limit} people. Create a team to share more widely.`,
    }
  }

  return { ok: true, email: candidate }
}

/** Invites still available, for the "2 of 3 left" hint. */
export function remainingSlots(
  used: number,
  limit: number = MAX_DIAGRAM_COLLABORATORS
): number {
  return Math.max(limit - Math.max(used, 0), 0)
}

/**
 * Turn a Postgres failure into something readable.
 *
 * The cap is raised by a trigger, so it arrives as an exception rather than a validation
 * result. Without this the user would see the raw message and error code.
 */
export function describeShareError(message: string): string {
  const text = message.toLowerCase()

  if (text.includes('at most') || text.includes('check_violation')) {
    return `A diagram can be shared with ${MAX_DIAGRAM_COLLABORATORS} people. Create a team to share more widely.`
  }
  if (text.includes('duplicate') || text.includes('unique')) {
    return 'They already have access to this diagram.'
  }
  if (text.includes('row-level security') || text.includes('policy')) {
    return 'Only the owner can change who has access.'
  }
  return 'Could not update sharing. Please try again.'
}
