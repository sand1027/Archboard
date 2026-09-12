import { describe, it, expect } from 'vitest'
import {
  formatByUnit,
  formatByteRate,
  formatBytes,
  formatCount,
  formatRate,
} from './format'

describe('formatCount', () => {
  it('scales into K, M, B and T', () => {
    expect(formatCount(999)).toBe('999')
    expect(formatCount(1_500)).toBe('1.5K')
    expect(formatCount(100_000_000)).toBe('100M')
    expect(formatCount(2_500_000_000)).toBe('2.5B')
    expect(formatCount(3e12)).toBe('3T')
  })

  it('keeps small numbers readable', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(7)).toBe('7')
    expect(formatCount(7.5)).toBe('7.5')
  })

  it('handles negatives', () => {
    expect(formatCount(-1_500)).toBe('-1.5K')
  })

  it('shows a dash rather than NaN', () => {
    expect(formatCount(Number.NaN)).toBe('—')
    expect(formatCount(Infinity)).toBe('—')
  })

  /**
   * Back-of-envelope numbers must not imply precision the method lacks — the whole
   * point is an order of magnitude you can argue about.
   */
  it('does not print spurious precision', () => {
    expect(formatCount(11_574.074)).toBe('11.6K')
  })
})

describe('formatBytes', () => {
  it('scales in binary units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
    expect(formatBytes(1024 ** 4)).toBe('1 TB')
  })

  it('stops at the largest unit it knows', () => {
    expect(formatBytes(1024 ** 7)).toContain('EB')
  })

  it('handles negatives and non-finite input', () => {
    expect(formatBytes(-2048)).toBe('-2 KB')
    expect(formatBytes(Number.NaN)).toBe('—')
  })
})

describe('rates', () => {
  it('labels request rates', () => {
    expect(formatRate(11_574)).toBe('11.6K req/s')
  })

  it('labels byte rates', () => {
    expect(formatByteRate(1024 * 1024)).toBe('1 MB/s')
  })
})

describe('formatByUnit', () => {
  it('renders each unit in its own terms', () => {
    expect(formatByUnit(1_500, 'count')).toBe('1.5K')
    expect(formatByUnit(1_500, 'rate')).toBe('1.5K req/s')
    expect(formatByUnit(2048, 'bytes')).toBe('2 KB')
    expect(formatByUnit(2048, 'byteRate')).toBe('2 KB/s')
    expect(formatByUnit(0.8, 'ratio')).toBe('80%')
    expect(formatByUnit(365, 'days')).toBe('365 days')
  })
})
