import { describe, it, expect } from 'vitest'
import { isEditingText } from './isEditingText'

describe('isEditingText', () => {
  it('is false for nothing', () => {
    expect(isEditingText(null)).toBe(false)
  })
})
