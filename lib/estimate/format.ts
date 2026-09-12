/**
 * Human-readable numbers for capacity estimates.
 *
 * Back-of-envelope work is only useful if you can read it at a glance. "11.6K req/s"
 * starts the right conversation; "11574.074 req/s" implies a precision the method does
 * not have and invites an argument about the wrong thing.
 *
 * These are also used to build the derivation strings the panel shows, so a step reads
 * `100M × 10` rather than `100000000 × 10`.
 */

const COUNT_UNITS = [
  { limit: 1e12, suffix: 'T' },
  { limit: 1e9, suffix: 'B' },
  { limit: 1e6, suffix: 'M' },
  { limit: 1e3, suffix: 'K' },
] as const

/** Two significant-ish digits: enough to compare, not enough to over-trust. */
function trim(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 100) return value.toFixed(0)
  if (abs >= 10) return value.toFixed(1).replace(/\.0$/, '')
  return value.toFixed(2).replace(/\.?0+$/, '')
}

/** 1234567 → "1.23M". */
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '0'

  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)

  for (const { limit, suffix } of COUNT_UNITS) {
    if (abs >= limit) return `${sign}${trim(abs / limit)}${suffix}`
  }
  return `${sign}${trim(abs)}`
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'] as const

/**
 * Binary byte sizes, since that is what storage and memory are quoted in.
 *
 * 1024-based rather than 1000-based: a "1 GB" disk figure people compare against is
 * conventionally binary in this context, and mixing the two is how estimates end up 7%
 * out for no visible reason.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes === 0) return '0 B'

  const sign = bytes < 0 ? '-' : ''
  let value = Math.abs(bytes)
  let unit = 0

  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024
    unit++
  }
  return `${sign}${trim(value)} ${BYTE_UNITS[unit]}`
}

/** Per-second byte rate, e.g. "11.3 MB/s". */
export function formatByteRate(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond)) return '—'
  return `${formatBytes(bytesPerSecond)}/s`
}

/** Per-second request rate, e.g. "11.6K req/s". */
export function formatRate(perSecond: number): string {
  if (!Number.isFinite(perSecond)) return '—'
  return `${formatCount(perSecond)} req/s`
}

export type EstimateUnit = 'count' | 'rate' | 'bytes' | 'byteRate' | 'ratio' | 'days'

/** Render a value according to what it measures. */
export function formatByUnit(value: number, unit: EstimateUnit): string {
  switch (unit) {
    case 'rate':
      return formatRate(value)
    case 'bytes':
      return formatBytes(value)
    case 'byteRate':
      return formatByteRate(value)
    case 'ratio':
      return `${trim(value * 100)}%`
    case 'days':
      return `${formatCount(value)} days`
    case 'count':
    default:
      return formatCount(value)
  }
}
