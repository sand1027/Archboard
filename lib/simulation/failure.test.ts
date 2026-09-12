import { describe, it, expect } from 'vitest'
import type { FailureConfig } from '@/types/simulation'
import { decideFailure, failureLabel, isSlowEdge } from './failure'

function config(partial: Partial<FailureConfig> = {}): FailureConfig {
  return {
    failNodes: new Set(),
    slowEdges: new Set(),
    errorRate: 0,
    slowFactor: 3,
    ...partial,
  }
}

describe('decideFailure', () => {
  /**
   * The contract that makes the feature trustworthy: a node the user marked down
   * fails every time, not on a dice roll.
   */
  it('always fails a node marked down, whatever the roll', () => {
    const failure = config({ failNodes: new Set(['db']) })
    for (const roll of [0, 0.5, 0.999]) {
      expect(decideFailure('db', failure, roll)).toEqual({ failed: true, reason: 'node-down' })
    }
  })

  it('leaves unmarked nodes alone when the error rate is zero', () => {
    const failure = config({ failNodes: new Set(['db']) })
    expect(decideFailure('redis', failure, 0)).toEqual({ failed: false, reason: null })
  })

  it('applies the error rate to unmarked nodes', () => {
    const failure = config({ errorRate: 0.3 })
    expect(decideFailure('redis', failure, 0.1).failed).toBe(true)
    expect(decideFailure('redis', failure, 0.1).reason).toBe('error-rate')
    expect(decideFailure('redis', failure, 0.5).failed).toBe(false)
  })

  // Boundary cases the old inline `Math.random() < errorRate` got right by accident
  // and which are easy to break when refactoring.
  it('never fails at a rate of 0 and always fails at a rate of 1', () => {
    expect(decideFailure('x', config({ errorRate: 0 }), 0).failed).toBe(false)
    expect(decideFailure('x', config({ errorRate: 1 }), 0.999).failed).toBe(true)
  })

  it('treats a non-finite error rate as no failures', () => {
    expect(decideFailure('x', config({ errorRate: Number.NaN }), 0).failed).toBe(false)
  })

  it('reports node-down in preference to the error rate', () => {
    const failure = config({ failNodes: new Set(['db']), errorRate: 1 })
    expect(decideFailure('db', failure, 0).reason).toBe('node-down')
  })
})

describe('isSlowEdge', () => {
  it('reflects the marked set', () => {
    const failure = config({ slowEdges: new Set(['e1']) })
    expect(isSlowEdge('e1', failure)).toBe(true)
    expect(isSlowEdge('e2', failure)).toBe(false)
  })
})

describe('failureLabel', () => {
  it('names both causes', () => {
    expect(failureLabel('node-down')).toBe('node down')
    expect(failureLabel('error-rate')).toBe('error rate')
  })
})
