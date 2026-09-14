import type { Diagram } from '@/types/diagram'

// ─── JSON ─────────────────────────────────────────────────────────────────────

export function exportJSON(diagram: Diagram): void {
  const json = JSON.stringify(diagram, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  downloadBlob(blob, `${safeName(diagram.name)}.json`)
}

export function importJSON(json: string): Diagram | null {
  try {
    const data = JSON.parse(json)
    if (!data.nodes || !data.edges) return null
    return data as Diagram
  } catch {
    return null
  }
}

// ─── PNG / SVG via React Flow bounds ─────────────────────────────────────────
// These require the ReactFlow transform so they are called from the canvas hook.

export interface NodesBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface ExportOptions {
  /** All current nodes — needed to compute bounding box */
  nodesBounds: NodesBounds
  /** The CSS transform string for the RF viewport, e.g. "translate(x,y) scale(z)" */
  viewportTransform: string
  diagramName: string
}

/** Padding around the diagram in the exported image, in CSS pixels. */
export const EXPORT_PADDING_PX = 40

/**
 * A canvas the size of the diagram, plus a small margin.
 *
 * React Flow's `getViewportForBounds` treats a numeric padding as a *ratio*
 * (`40` ≈ 49% of the page on each side). Combined with a 1200×800 floor that
 * shrinks the architecture into the middle of a blank sheet — which is how an
 * export can look like a second, smaller copy of the board.
 */
export function exportCanvasForBounds(
  bounds: NodesBounds,
  padding = EXPORT_PADDING_PX
): { width: number; height: number; transform: string } {
  const width = Math.max(1, Math.ceil(bounds.width) + padding * 2)
  const height = Math.max(1, Math.ceil(bounds.height) + padding * 2)
  const x = padding - bounds.x
  const y = padding - bounds.y
  return {
    width,
    height,
    transform: `translate(${x}px, ${y}px) scale(1)`,
  }
}

/**
 * Export PNG.
 * Temporarily stamps the exact viewport transform needed to fit the diagram,
 * captures with html-to-image, then restores.
 */
export async function exportPNG(opts: ExportOptions): Promise<void> {
  const { nodesBounds, diagramName } = opts
  const canvas = exportCanvasForBounds(nodesBounds)
  const viewportTransform = opts.viewportTransform || canvas.transform

  const viewportEl = document.querySelector<HTMLElement>('.react-flow__viewport')
  if (!viewportEl) return

  // Temporarily apply the fit-to-canvas transform
  const prevTransform = viewportEl.style.transform
  viewportEl.style.transform = viewportTransform

  // Hide dot grid, minimap, panels
  const toHide = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.react-flow__background, .react-flow__minimap, .react-flow__panel'
    )
  )
  toHide.forEach((el) => { el.style.visibility = 'hidden' })

  try {
    const { toPng } = await import('html-to-image').catch(() => ({ toPng: null as any }))
    if (!toPng) { await exportSVG({ ...opts, viewportTransform }); return }

    // Capture just the viewport element at the exact canvas bounds
    const container = document.querySelector<HTMLElement>('.react-flow__renderer')
    if (!container) { await exportSVG({ ...opts, viewportTransform }); return }

    const dataUrl = await toPng(container, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      width: canvas.width,
      height: canvas.height,
      style: { background: '#ffffff' },
    })

    downloadDataUrl(dataUrl, `${safeName(diagramName)}.png`)
  } finally {
    viewportEl.style.transform = prevTransform
    toHide.forEach((el) => { el.style.visibility = '' })
  }
}

/**
 * Export SVG.
 * Clones the RF viewport element, applies the fit transform, strips the background.
 */
export async function exportSVG(opts: ExportOptions): Promise<void> {
  const { nodesBounds, diagramName } = opts
  const canvas = exportCanvasForBounds(nodesBounds)
  const viewportTransform = opts.viewportTransform || canvas.transform

  const viewportEl = document.querySelector<SVGGElement>('.react-flow__viewport')
  if (!viewportEl) return

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  svg.setAttribute('width',   String(canvas.width))
  svg.setAttribute('height',  String(canvas.height))
  svg.setAttribute('viewBox', `0 0 ${canvas.width} ${canvas.height}`)

  // White background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bg.setAttribute('width', '100%')
  bg.setAttribute('height', '100%')
  bg.setAttribute('fill', '#ffffff')
  svg.appendChild(bg)

  // Clone and transform
  const cloned = viewportEl.cloneNode(true) as SVGGElement
  cloned.setAttribute('transform', viewportTransform)
  cloned.querySelectorAll('.react-flow__background').forEach((el) => el.remove())
  svg.appendChild(cloned)

  const blob = new Blob(
    [new XMLSerializer().serializeToString(svg)],
    { type: 'image/svg+xml' }
  )
  downloadBlob(blob, `${safeName(diagramName)}.svg`)
}

// ─── helpers ──────────────────────────────────────────────────────────────────

export function safeName(name: string) {
  return name.replace(/\s+/g, '-').toLowerCase()
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  downloadDataUrl(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadDataUrl(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
