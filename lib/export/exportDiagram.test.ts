import { describe, expect, it } from 'vitest'
import { exportCanvasForBounds } from './exportDiagram'

describe('exportCanvasForBounds', () => {
  it('is the diagram size plus padding, not a 1200×800 floor', () => {
    expect(exportCanvasForBounds({ x: 100, y: 50, width: 400, height: 600 }, 40)).toEqual({
      width: 480,
      height: 680,
      transform: 'translate(-60px, -10px) scale(1)',
    })
  })

  it('keeps a 1:1 scale so the export is not a shrunk copy in a blank page', () => {
    const canvas = exportCanvasForBounds({ x: 0, y: 0, width: 900, height: 1400 })
    expect(canvas.transform).toContain('scale(1)')
    expect(canvas.width).toBe(980)
    expect(canvas.height).toBe(1480)
  })
})
