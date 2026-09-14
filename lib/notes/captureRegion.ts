/**
 * Screenshot a dragged rectangle of the canvas into a data URL for notes.
 *
 * The capture tool is a marquee, not a node picker: you drag the amount of
 * diagram you want on the page, and that picture is what is filed.
 *
 * The crop is re-rendered in flow space rather than as the zoomed-out pixels
 * on screen. A board at 16% zoom would otherwise land in notes as a blurry
 * upscale of a tiny bitmap; here the same region is drawn at ~1:1 then scaled
 * to a bounded PNG so thin lines survive.
 */

export interface ClientRect {
  x: number
  y: number
  w: number
  h: number
}

export interface ViewportTransform {
  x: number
  y: number
  zoom: number
}

/** Smaller than this is a click, not a region. */
export const MIN_CAPTURE_PX = 24

/** Longest edge, in CSS pixels, of a captured bitmap before device pixel ratio. */
export const MAX_CAPTURE_EDGE = 1600

/** Rough data-URL length for ~800KB of image bytes. */
export const MAX_DATA_URL_CHARS = 1_100_000

export function normalizeClientRect(
  ax: number,
  ay: number,
  bx: number,
  by: number
): ClientRect {
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    w: Math.abs(bx - ax),
    h: Math.abs(by - ay),
  }
}

/**
 * Read a React Flow viewport transform.
 *
 * Accepts both the inline `translate() scale()` React Flow writes, and the
 * `matrix()` form `getComputedStyle` returns.
 */
export function parseViewportTransform(transform: string): ViewportTransform {
  if (!transform || transform === 'none') return { x: 0, y: 0, zoom: 1 }

  const matrix3d = transform.match(/matrix3d\((.+)\)/)
  if (matrix3d) {
    const n = matrix3d[1].split(',').map((part) => Number(part.trim()))
    return { x: n[12] ?? 0, y: n[13] ?? 0, zoom: n[0] || 1 }
  }

  const matrix = transform.match(/matrix\((.+)\)/)
  if (matrix) {
    const n = matrix[1].split(',').map((part) => Number(part.trim()))
    return { x: n[4] ?? 0, y: n[5] ?? 0, zoom: n[0] || 1 }
  }

  const translate = transform.match(/translate(?:3d)?\(\s*([-\d.]+)px,\s*([-\d.]+)px/)
  const scale = transform.match(/scale\(\s*([-\d.]+)/)
  return {
    x: translate ? Number(translate[1]) : 0,
    y: translate ? Number(translate[2]) : 0,
    zoom: scale ? Number(scale[1]) : 1,
  }
}

/** Convert a crop in renderer pixels into flow coordinates. */
export function clientRectToFlow(clipped: ClientRect, viewport: ViewportTransform): ClientRect {
  const zoom = viewport.zoom || 1
  return {
    x: (clipped.x - viewport.x) / zoom,
    y: (clipped.y - viewport.y) / zoom,
    w: clipped.w / zoom,
    h: clipped.h / zoom,
  }
}

/** Scale a flow-space crop so the long edge is at most `MAX_CAPTURE_EDGE`. */
export function fitCaptureScale(flow: ClientRect): number {
  const longest = Math.max(flow.w, flow.h)
  if (longest <= 0) return 1
  return Math.min(1, MAX_CAPTURE_EDGE / longest)
}

export async function captureViewportRegion(
  renderer: HTMLElement,
  rect: ClientRect
): Promise<string | null> {
  const clipped = clipToElement(renderer, rect)
  if (!clipped || clipped.w < MIN_CAPTURE_PX || clipped.h < MIN_CAPTURE_PX) return null

  const viewportEl = renderer.querySelector<HTMLElement>('.react-flow__viewport')
  if (viewportEl) {
    const sharp = await captureFlowRegion(viewportEl, clipped)
    if (sharp) return sharp
  }

  return captureScreenRegion(renderer, clipped)
}

async function captureFlowRegion(
  viewportEl: HTMLElement,
  clipped: ClientRect
): Promise<string | null> {
  const raw =
    viewportEl.style.transform ||
    (typeof window !== 'undefined' ? window.getComputedStyle(viewportEl).transform : '')
  const viewport = parseViewportTransform(raw)
  const flow = clientRectToFlow(clipped, viewport)
  if (flow.w < 1 || flow.h < 1) return null

  const fit = fitCaptureScale(flow)
  const width = Math.max(1, Math.round(flow.w * fit))
  const height = Math.max(1, Math.round(flow.h * fit))

  const { toPng } = await import('html-to-image')
  try {
    const dataUrl = await toPng(viewportEl, {
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      width,
      height,
      skipFonts: true,
      style: {
        transform: `translate(${-flow.x * fit}px, ${-flow.y * fit}px) scale(${fit})`,
        transformOrigin: '0 0',
        background: '#ffffff',
      },
      filter: captureFilter,
    })
    return await tightenDataUrl(dataUrl)
  } catch {
    return null
  }
}

async function captureScreenRegion(
  renderer: HTMLElement,
  clipped: ClientRect
): Promise<string | null> {
  const { toPng } = await import('html-to-image')
  const bounds = renderer.getBoundingClientRect()

  const full = await toPng(renderer, {
    backgroundColor: '#ffffff',
    pixelRatio: 2,
    skipFonts: true,
    filter: captureFilter,
  })

  const img = new Image()
  img.src = full
  await img.decode()

  const scaleX = img.width / bounds.width
  const scaleY = img.height / bounds.height
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(clipped.w * scaleX))
  canvas.height = Math.max(1, Math.round(clipped.h * scaleY))

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    img,
    Math.round(clipped.x * scaleX),
    Math.round(clipped.y * scaleY),
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height
  )

  return encodeCapturedCanvas(canvas)
}

function captureFilter(node: HTMLElement): boolean {
  const cls = node.classList
  if (!cls) return true
  return (
    !cls.contains('react-flow__minimap') &&
    !cls.contains('react-flow__controls') &&
    !cls.contains('react-flow__panel') &&
    !cls.contains('react-flow__background')
  )
}

export function encodeCapturedCanvas(canvas: HTMLCanvasElement): string {
  const png = canvas.toDataURL('image/png')
  if (png.length <= MAX_DATA_URL_CHARS) return png

  // Shrink the bitmap before falling back to JPEG — diagram lines die at 0.82.
  const factor = Math.sqrt(MAX_DATA_URL_CHARS / png.length) * 0.92
  const scale = Math.max(0.5, Math.min(0.92, factor))
  const scaled = document.createElement('canvas')
  scaled.width = Math.max(1, Math.round(canvas.width * scale))
  scaled.height = Math.max(1, Math.round(canvas.height * scale))
  const ctx = scaled.getContext('2d')
  if (!ctx) return canvas.toDataURL('image/jpeg', 0.92)

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, scaled.width, scaled.height)
  ctx.drawImage(canvas, 0, 0, scaled.width, scaled.height)

  const smallerPng = scaled.toDataURL('image/png')
  if (smallerPng.length <= MAX_DATA_URL_CHARS) return smallerPng
  return scaled.toDataURL('image/jpeg', 0.92)
}

async function tightenDataUrl(dataUrl: string): Promise<string> {
  if (dataUrl.length <= MAX_DATA_URL_CHARS) return dataUrl

  const img = new Image()
  img.src = dataUrl
  await img.decode()

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0)
  return encodeCapturedCanvas(canvas)
}

function clipToElement(el: HTMLElement, rect: ClientRect): ClientRect | null {
  const bounds = el.getBoundingClientRect()
  const x = Math.max(rect.x, bounds.left)
  const y = Math.max(rect.y, bounds.top)
  const right = Math.min(rect.x + rect.w, bounds.right)
  const bottom = Math.min(rect.y + rect.h, bounds.bottom)
  const w = right - x
  const h = bottom - y
  if (w <= 0 || h <= 0) return null
  return { x: x - bounds.left, y: y - bounds.top, w, h }
}
