import { describe, it, expect } from 'vitest'
import { MAX_DIAGRAM_COLLABORATORS } from '@/lib/supabase/types'
import {
  checkInvite,
  describeShareError,
  isValidEmail,
  normaliseEmail,
  remainingSlots,
} from './invites'

describe('normaliseEmail', () => {
  // Must match the normalising trigger on diagram_shares, or the client and the unique
  // constraint would disagree about what counts as the same person.
  it('trims and lowercases', () => {
    expect(normaliseEmail('  Sandeep@Example.COM ')).toBe('sandeep@example.com')
  })
})

describe('isValidEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(isValidEmail('sandeep@example.com')).toBe(true)
    expect(isValidEmail('first.last+tag@sub.example.co.uk')).toBe(true)
  })

  it('rejects obvious typos', () => {
    expect(isValidEmail('sandeep')).toBe(false)
    expect(isValidEmail('sandeep@')).toBe(false)
    expect(isValidEmail('@example.com')).toBe(false)
    expect(isValidEmail('sandeep@example')).toBe(false)
    expect(isValidEmail('sandeep@@example.com')).toBe(false)
    expect(isValidEmail('sandeep@example..com')).toBe(false)
    expect(isValidEmail('sandeep@.example.com')).toBe(false)
    expect(isValidEmail('sandeep @example.com')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})

describe('checkInvite', () => {
  const existing = ['a@example.com']

  it('accepts a new address and returns it normalised', () => {
    const result = checkInvite({ email: ' NEW@Example.com ', existing })
    expect(result).toEqual({ ok: true, email: 'new@example.com' })
  })

  it('rejects a duplicate regardless of case', () => {
    const result = checkInvite({ email: 'A@EXAMPLE.COM', existing })
    expect(result).toMatchObject({ ok: false, reason: 'duplicate' })
  })

  it('rejects the owner inviting themselves', () => {
    const result = checkInvite({ email: 'me@example.com', existing, ownerEmail: 'Me@example.com' })
    expect(result).toMatchObject({ ok: false, reason: 'self' })
  })

  it('rejects once the cap is reached', () => {
    const full = ['a@x.com', 'b@x.com', 'c@x.com']
    const result = checkInvite({ email: 'd@x.com', existing: full })
    expect(result).toMatchObject({ ok: false, reason: 'limit' })
  })

  it('allows the last slot', () => {
    const result = checkInvite({ email: 'c@x.com', existing: ['a@x.com', 'b@x.com'] })
    expect(result.ok).toBe(true)
  })

  /** A malformed duplicate should be reported as malformed — that is the thing to fix. */
  it('reports the most actionable problem first', () => {
    const result = checkInvite({ email: 'not-an-email', existing: ['not-an-email'] })
    expect(result).toMatchObject({ ok: false, reason: 'invalid' })
  })

  it('points at teams rather than just refusing', () => {
    const result = checkInvite({ email: 'd@x.com', existing: ['a@x.com', 'b@x.com', 'c@x.com'] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('team')
  })

  it('honours a custom limit', () => {
    expect(checkInvite({ email: 'b@x.com', existing: ['a@x.com'], limit: 1 }).ok).toBe(false)
  })
})

describe('remainingSlots', () => {
  it('counts down from the cap', () => {
    expect(remainingSlots(0)).toBe(MAX_DIAGRAM_COLLABORATORS)
    expect(remainingSlots(2)).toBe(MAX_DIAGRAM_COLLABORATORS - 2)
  })

  it('never goes negative', () => {
    expect(remainingSlots(99)).toBe(0)
    expect(remainingSlots(-5)).toBe(MAX_DIAGRAM_COLLABORATORS)
  })
})

describe('describeShareError', () => {
  /**
   * The cap is a trigger, so it arrives as a Postgres exception. Without translation the user
   * would see the raw message and an error code.
   */
  it('translates the cap exception', () => {
    expect(describeShareError('A diagram can be shared with at most 3 collaborators.')).toContain(
      'team'
    )
  })

  it('translates a unique violation', () => {
    expect(
      describeShareError('duplicate key value violates unique constraint "diagram_shares_..."')
    ).toContain('already have access')
  })

  it('translates a policy refusal into who is allowed', () => {
    expect(describeShareError('new row violates row-level security policy')).toContain('owner')
  })

  it('falls back to something harmless', () => {
    expect(describeShareError('connection reset')).toBe('Could not update sharing. Please try again.')
  })
})
