import { downloadBlob, safeName } from '@/lib/export/exportDiagram'
import { KIND_LABEL, type NotePage } from '@/types/notes'

/**
 * Notes as a PDF you can take out of the app.
 *
 * Typeset from the stored blocks rather than screenshotting the sidebar: a
 * cropped panel is hard to read, and the point of export is a document, not a
 * picture of the editor.
 */

export type PdfRun =
  | { kind: 'empty'; text: string }
  | { kind: 'section'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'subheading'; text: string }
  | { kind: 'body'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'image'; src: string; caption: string }

export function pageHasNotes(page: NotePage): boolean {
  return page.blocks.some((block) => block.type === 'image' || block.text.trim() !== '')
}

export function flattenNotesForPdf(pages: NotePage[]): PdfRun[] {
  const written = pages.filter(pageHasNotes)
  if (written.length === 0) {
    return [{ kind: 'empty', text: 'No notes yet.' }]
  }

  const runs: PdfRun[] = []
  for (const page of written) {
    runs.push({ kind: 'section', text: KIND_LABEL[page.kind] })
    for (const block of page.blocks) {
      if (block.type === 'image' && block.src) {
        runs.push({ kind: 'image', src: block.src, caption: block.text.trim() })
        continue
      }
      const text = block.text.trim()
      if (!text) continue
      if (block.type === 'heading') runs.push({ kind: 'heading', text })
      else if (block.type === 'subheading') runs.push({ kind: 'subheading', text })
      else if (block.type === 'bullet') runs.push({ kind: 'bullet', text })
      else runs.push({ kind: 'body', text })
    }
  }
  return runs
}

export function notesPdfFilename(diagramName: string): string {
  const trimmed = diagramName.trim()
  return trimmed ? `${safeName(trimmed)}-notes.pdf` : 'notes.pdf'
}

export async function exportNotesPdf(pages: NotePage[], diagramName: string): Promise<void> {
  const blob = await buildNotesPdfBlob(pages, diagramName)
  downloadBlob(blob, notesPdfFilename(diagramName))
}

export async function buildNotesPdfBlob(pages: NotePage[], diagramName: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 54
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const ensure = (needed: number) => {
    if (y + needed <= pageHeight - margin) return
    doc.addPage()
    y = margin
  }

  const title = diagramName.trim() || 'Untitled Diagram'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(15, 23, 42)
  const titleLines = doc.splitTextToSize(title, contentWidth) as string[]
  ensure(titleLines.length * 22 + 16)
  doc.text(titleLines, margin, y)
  y += titleLines.length * 22

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text('Notes', margin, y)
  y += 18

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.75)
  doc.line(margin, y, pageWidth - margin, y)
  y += 22

  for (const run of flattenNotesForPdf(pages)) {
    if (run.kind === 'empty') {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(11)
      doc.setTextColor(100, 116, 139)
      ensure(16)
      doc.text(run.text, margin, y)
      y += 16
      continue
    }

    if (run.kind === 'section') {
      y += 8
      ensure(32)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(15, 118, 110)
      doc.text(run.text, margin, y)
      y += 8
      doc.setDrawColor(204, 251, 241)
      doc.line(margin, y, pageWidth - margin, y)
      y += 16
      continue
    }

    if (run.kind === 'image') {
      const image = await rasterizeImage(run.src)
      if (image) {
        const maxH = 280
        const scale = Math.min(contentWidth / image.width, maxH / image.height, 1)
        const w = image.width * scale
        const h = image.height * scale
        const captionH = run.caption ? 14 : 0
        ensure(h + captionH + 16)
        doc.addImage(image.dataUrl, 'PNG', margin, y, w, h)
        y += h + 8
        if (run.caption) {
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(9)
          doc.setTextColor(100, 116, 139)
          const captionLines = doc.splitTextToSize(run.caption, contentWidth) as string[]
          for (const line of captionLines) {
            ensure(12)
            doc.text(line, margin, y)
            y += 12
          }
        }
        y += 8
      } else if (run.caption) {
        writeWrapped(doc, {
          text: `[Image] ${run.caption}`,
          size: 11,
          bold: false,
          italic: true,
          color: [100, 116, 139],
          indent: 0,
          leading: 15,
          contentWidth,
          margin,
          ensure: (n) => ensure(n),
          getY: () => y,
          setY: (next) => {
            y = next
          },
        })
      }
      continue
    }

    const style =
      run.kind === 'heading'
        ? { size: 14, bold: true, italic: false, color: [15, 23, 42] as const, indent: 0, leading: 20 }
        : run.kind === 'subheading'
          ? { size: 12, bold: true, italic: false, color: [51, 65, 85] as const, indent: 10, leading: 17 }
          : run.kind === 'bullet'
            ? { size: 11, bold: false, italic: false, color: [30, 41, 59] as const, indent: 14, leading: 16 }
            : { size: 11, bold: false, italic: false, color: [30, 41, 59] as const, indent: 0, leading: 16 }

    const text = run.kind === 'bullet' ? `-  ${run.text}` : run.text
    writeWrapped(doc, {
      text,
      ...style,
      contentWidth,
      margin,
      ensure: (n) => ensure(n),
      getY: () => y,
      setY: (next) => {
        y = next
      },
    })
    if (run.kind === 'heading') y += 4
  }

  return doc.output('blob')
}

function writeWrapped(
  doc: import('jspdf').jsPDF,
  opts: {
    text: string
    size: number
    bold: boolean
    italic: boolean
    color: readonly [number, number, number]
    indent: number
    leading: number
    contentWidth: number
    margin: number
    ensure: (needed: number) => void
    getY: () => number
    setY: (y: number) => void
  }
) {
  doc.setFont('helvetica', opts.italic ? 'italic' : opts.bold ? 'bold' : 'normal')
  doc.setFontSize(opts.size)
  doc.setTextColor(opts.color[0], opts.color[1], opts.color[2])
  const width = opts.contentWidth - opts.indent
  const lines = doc.splitTextToSize(opts.text, width) as string[]
  for (const line of lines) {
    opts.ensure(opts.leading)
    doc.text(line, opts.margin + opts.indent, opts.getY())
    opts.setY(opts.getY() + opts.leading)
  }
}

async function rasterizeImage(
  src: string
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (typeof window === 'undefined') return null

  const url = src.startsWith('/') ? `${window.location.origin}${src}` : src

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const width = img.naturalWidth || img.width
      const height = img.naturalHeight || img.height
      if (!width || !height) {
        resolve(null)
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0)
      try {
        resolve({ dataUrl: canvas.toDataURL('image/png'), width, height })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}
