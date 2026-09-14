import { describe, it, expect } from 'vitest'
import {
  MIN_CAPTURE_PX,
  MAX_CAPTURE_EDGE,
  clientRectToFlow,
  fitCaptureScale,
  normalizeClientRect,
  parseViewportTransform,
} from './captureRegion'

describe('normalizeClientRect', () => {
  it('orders a drag that went up and left', () => {
    expect(normalizeClientRect(80, 90, 20, 30)).toEqual({ x: 20, y: 30, w: 60, h: 60 })
  })

  it('keeps a drag that went down and right', () => {
    expect(normalizeClientRect(10, 10, 40, 25)).toEqual({ x: 10, y: 10, w: 30, h: 15 })
  })
})

describe('MIN_CAPTURE_PX', () => {
  it('is large enough that a click is not a capture', () => {
    expect(MIN_CAPTURE_PX).toBeGreaterThan(10)
  })
})

describe('parseViewportTransform', () => {
  it('reads the translate/scale string React Flow writes', () => {
    expect(parseViewportTransform('translate(12px, 40px) scale(0.16)')).toEqual({
      x: 12,
      y: 40,
      zoom: 0.16,
    })
  })

  it('reads a matrix() from getComputedStyle', () => {
    expect(parseViewportTransform('matrix(0.5, 0, 0, 0.5, 10, 20)')).toEqual({
      x: 10,
      y: 20,
      zoom: 0.5,
    })
  })

  it('treats none as identity', () => {
    expect(parseViewportTransform('none')).toEqual({ x: 0, y: 0, zoom: 1 })
  })
})

describe('clientRectToFlow', () => {
  it('undoes pan and zoom so a 16% crop is the real diagram size', () => {
    expect(clientRectToFlow({ x: 12, y: 40, w: 80, h: 40 }, { x: 12, y: 40, zoom: 0.16 })).toEqual({
      x: 0,
      y: 0,
      w: 500,
      h: 250,
    })
  })
})

describe('fitCaptureScale', () => {
  it('does not upscale a region already under the cap', () => {
    expect(fitCaptureScale({ x: 0, y: 0, w: 800, h: 400 })).toBe(1)
  })

  it('scales a huge region down to the long-edge cap', () => {
    expect(fitCaptureScale({ x: 0, y: 0, w: MAX_CAPTURE_EDGE * 2, h: 100 })).toBe(0.5)
  })
})
