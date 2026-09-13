import { describe, it, expect } from 'vitest'
import { PEER_COLORS, hashString, peerColor, peerInitials, peerName } from './identity'

describe('hashString', () => {
  it('is stable for the same input', () => {
    expect(hashString('abc')).toBe(hashString('abc'))
  })

  it('separates similar inputs', () => {
    expect(hashString('user-1')).not.toBe(hashString('user-2'))
  })

  it('stays a 32-bit unsigned integer', () => {
    for (const value of ['', 'a', 'a'.repeat(500), '7f3b9c2e-1234-4567-89ab-cdef01234567']) {
      const hash = hashString(value)
      expect(Number.isInteger(hash)).toBe(true)
      expect(hash).toBeGreaterThanOrEqual(0)
      expect(hash).toBeLessThanOrEqual(0xffffffff)
    }
  })
})

describe('peerColor', () => {
  /**
   * The reason this is derived rather than assigned: join order differs per client, so an
   * index-based colour would show the same person differently in every other window.
   */
  it('gives a user the same colour every time', () => {
    const id = '7f3b9c2e-1234-4567-89ab-cdef01234567'
    expect(peerColor(id)).toBe(peerColor(id))
  })

  it('only ever returns a palette colour', () => {
    for (let i = 0; i < 200; i++) {
      expect(PEER_COLORS).toContain(peerColor(`user-${i}`))
    }
  })

  it('spreads across the palette rather than favouring one entry', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) seen.add(peerColor(`user-${i}`))
    // Not every id set will hit all eight, but clustering on one or two would make
    // cursors indistinguishable.
    expect(seen.size).toBeGreaterThanOrEqual(PEER_COLORS.length - 1)
  })

  it('falls back to a colour for a missing id', () => {
    expect(PEER_COLORS).toContain(peerColor(''))
  })
})

describe('peerName', () => {
  it('prefers a real name', () => {
    expect(peerName({ name: 'Sandeep V', email: 'sv@example.com' })).toBe('Sandeep V')
  })

  // A full address is wider than most nodes and would swamp the cursor label.
  it('falls back to the local part of an email', () => {
    expect(peerName({ email: 'sandeep@example.com' })).toBe('sandeep')
  })

  it('ignores blank values', () => {
    expect(peerName({ name: '   ', email: 'sandeep@example.com' })).toBe('sandeep')
    expect(peerName({ name: null, email: null })).toBe('Guest')
    expect(peerName({})).toBe('Guest')
  })
})

describe('peerInitials', () => {
  it('takes one initial per word', () => {
    expect(peerInitials('Sandeep V')).toBe('SV')
  })

  it('takes two letters from a single word', () => {
    expect(peerInitials('sandeep')).toBe('SA')
  })

  it('splits on the separators that appear in usernames', () => {
    expect(peerInitials('sandeep.varma')).toBe('SV')
    expect(peerInitials('sandeep_varma')).toBe('SV')
    expect(peerInitials('sandeep-varma')).toBe('SV')
  })

  it('never returns empty', () => {
    expect(peerInitials('')).toBe('?')
    expect(peerInitials('   ')).toBe('?')
  })
})
