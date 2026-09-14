import { describe, expect, it } from 'vitest'
import { emptyPage } from '@/store/notesStore'
import type { NotePage } from '@/types/notes'
import { flattenNotesForPdf, notesPdfFilename, pageHasNotes, buildNotesPdfBlob } from './exportPdf'

function page(
  kind: NotePage['kind'],
  blocks: NotePage['blocks']
): NotePage {
  return { ...emptyPage(kind), blocks }
}

describe('pageHasNotes', () => {
  it('is false for a blank body', () => {
    expect(pageHasNotes(emptyPage('functional'))).toBe(false)
  })

  it('is true when there is writing', () => {
    expect(
      pageHasNotes(page('functional', [{ id: '1', type: 'body', text: 'Users can upload' }]))
    ).toBe(true)
  })

  it('is true for an image with no caption', () => {
    expect(
      pageHasNotes(
        page('scratch', [{ id: '1', type: 'image', text: '', src: 'data:image/png;base64,xx' }])
      )
    ).toBe(true)
  })
})

describe('flattenNotesForPdf', () => {
  it('says the notebook is empty when nothing was written', () => {
    expect(flattenNotesForPdf([emptyPage('functional'), emptyPage('scratch')])).toEqual([
      { kind: 'empty', text: 'No notes yet.' },
    ])
  })

  it('skips blank pages and blank blocks', () => {
    const runs = flattenNotesForPdf([
      page('functional', [
        { id: '1', type: 'heading', text: 'Upload' },
        { id: '2', type: 'body', text: '   ' },
        { id: '3', type: 'body', text: 'Up to 10MB' },
      ]),
      emptyPage('nonFunctional'),
      page('assumption', [{ id: '4', type: 'bullet', text: '100M DAU' }]),
    ])

    expect(runs).toEqual([
      { kind: 'section', text: 'Functional' },
      { kind: 'heading', text: 'Upload' },
      { kind: 'body', text: 'Up to 10MB' },
      { kind: 'section', text: 'Assumptions' },
      { kind: 'bullet', text: '100M DAU' },
    ])
  })

  it('keeps image captions', () => {
    expect(
      flattenNotesForPdf([
        page('scratch', [
          { id: '1', type: 'image', text: 'HLD crop', src: 'data:image/png;base64,xx' },
        ]),
      ])
    ).toEqual([
      { kind: 'section', text: 'Scratch' },
      { kind: 'image', src: 'data:image/png;base64,xx', caption: 'HLD crop' },
    ])
  })
})

describe('notesPdfFilename', () => {
  it('slugs the diagram name', () => {
    expect(notesPdfFilename('User Scaling')).toBe('user-scaling-notes.pdf')
  })

  it('falls back when the diagram is unnamed', () => {
    expect(notesPdfFilename('  ')).toBe('notes.pdf')
  })
})

describe('buildNotesPdfBlob', () => {
  it('writes a PDF with the notes in it', async () => {
    const blob = await buildNotesPdfBlob(
      [
        page('functional', [
          { id: '1', type: 'heading', text: 'Upload' },
          { id: '2', type: 'body', text: 'Up to 10MB' },
        ]),
      ],
      'User Scaling'
    )
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('%PDF')
    expect(blob.size).toBeGreaterThan(200)
  })
})
