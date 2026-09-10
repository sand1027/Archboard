import type { Diagram } from '@/types/diagram'

// JSON Export
export function exportJSON(diagram: Diagram): void {
  const json = JSON.stringify(diagram, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  downloadBlob(blob, `${diagram.name.replace(/\s+/g, '-').toLowerCase()}.json`)
}

// JSON Import
export function importJSON(json: string): Diagram | null {
  try {
    const data = JSON.parse(json)
    // Basic validation
    if (!data.nodes || !data.edges) return null
    return data as Diagram
  } catch {
    return null
  }
}

// SVG Export — captures the react-flow svg element
export async function exportSVG(diagramName: string): Promise<void> {
  const flowEl = document.querySelector('.react-flow__viewport') as SVGGElement | null
  if (!flowEl) return

  const viewport = document.querySelector('.react-flow__renderer') as HTMLElement | null
  if (!viewport) return

  const bounds = viewport.getBoundingClientRect()

  // Get all node elements and render them as foreignObject in SVG
  const svgWrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svgWrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  svgWrapper.setAttribute('width', String(bounds.width))
  svgWrapper.setAttribute('height', String(bounds.height))
  svgWrapper.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`)

  // White background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bg.setAttribute('width', '100%')
  bg.setAttribute('height', '100%')
  bg.setAttribute('fill', '#ffffff')
  svgWrapper.appendChild(bg)

  // Clone the flow viewport
  const cloned = flowEl.cloneNode(true) as SVGGElement
  svgWrapper.appendChild(cloned)

  const svgString = new XMLSerializer().serializeToString(svgWrapper)
  const blob = new Blob([svgString], { type: 'image/svg+xml' })
  downloadBlob(blob, `${diagramName.replace(/\s+/g, '-').toLowerCase()}.svg`)
}

// PNG Export — uses html2canvas via canvas approach
export async function exportPNG(diagramName: string): Promise<void> {
  const flowEl = document.querySelector('.react-flow') as HTMLElement | null
  if (!flowEl) return

  // Use browser print-to-canvas via offscreen canvas trick
  try {
    const { toPng } = await import('html-to-image').catch(() => ({ toPng: null }))
    if (toPng) {
      const dataUrl = await toPng(flowEl, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        filter: (node: HTMLElement) => {
          // Exclude minimap and controls from export
          return !node.classList?.contains('react-flow__minimap') &&
            !node.classList?.contains('react-flow__controls')
        },
      })
      downloadDataUrl(dataUrl, `${diagramName.replace(/\s+/g, '-').toLowerCase()}.png`)
    } else {
      // Fallback: SVG download
      await exportSVG(diagramName)
    }
  } catch {
    await exportSVG(diagramName)
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  downloadDataUrl(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadDataUrl(url: string, filename: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
