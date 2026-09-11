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

export interface ExportOptions {
  /** All current nodes — needed to compute bounding box */
  nodesBounds: { x: number; y: number; width: number; height: number }
  /** The CSS transform string for the RF viewport, e.g. "translate(x,y) scale(z)" */
  viewportTransform: string
  diagramName: string
}

/**
 * Export PNG.
 * Temporarily stamps the exact viewport transform needed to fit the diagram,
 * captures with html-to-image, then restores.
 */
export async function exportPNG(opts: ExportOptions): Promise<void> {
  const { nodesBounds, viewportTransform, diagramName } = opts

  const PADDING = 40
  const imageW = Math.max(1200, nodesBounds.width  + PADDING * 2)
  const imageH = Math.max(800,  nodesBounds.height + PADDING * 2)

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
    if (!toPng) { await exportSVG(opts); return }

    // Capture just the viewport element at the exact canvas bounds
    const container = document.querySelector<HTMLElement>('.react-flow__renderer')
    if (!container) { await exportSVG(opts); return }

    const dataUrl = await toPng(container, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      width: imageW,
      height: imageH,
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
  const { nodesBounds, viewportTransform, diagramName } = opts

  const PADDING = 40
  const imageW = Math.max(1200, nodesBounds.width  + PADDING * 2)
  const imageH = Math.max(800,  nodesBounds.height + PADDING * 2)

  const viewportEl = document.querySelector<SVGGElement>('.react-flow__viewport')
  if (!viewportEl) return

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  svg.setAttribute('width',   String(imageW))
  svg.setAttribute('height',  String(imageH))
  svg.setAttribute('viewBox', `0 0 ${imageW} ${imageH}`)

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

function safeName(name: string) {
  return name.replace(/\s+/g, '-').toLowerCase()
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  downloadDataUrl(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadDataUrl(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
