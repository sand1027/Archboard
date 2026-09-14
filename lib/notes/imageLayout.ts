import type { NoteBlock } from '@/types/notes'

/**
 * How writing sits next to a picture.
 *
 * Only body and bullet lines wrap around an image. A heading is a new section,
 * so it always starts below, on the full width of the page.
 */
export function isWrapBlock(block: NoteBlock | undefined): boolean {
  return block?.type === 'body' || block?.type === 'bullet'
}

/**
 * The lines that flow around `blocks[imageIndex]`, and where the next full-width
 * block begins.
 *
 * Consecutive body/bullet lines after a picture wrap beside it, then continue
 * underneath once they pass its bottom — like a floated figure in a document.
 * The first heading or image after that is not part of the wrap.
 */
export function wrapRangeAfterImage(
  blocks: NoteBlock[],
  imageIndex: number
): { wrap: NoteBlock[]; nextIndex: number } {
  const wrap: NoteBlock[] = []
  let i = imageIndex + 1
  while (i < blocks.length && isWrapBlock(blocks[i])) {
    wrap.push(blocks[i])
    i += 1
  }
  return { wrap, nextIndex: i }
}

export function isFirstLineAfterImage(blocks: NoteBlock[], index: number): boolean {
  const prev = blocks[index - 1]
  return prev?.type === 'image' && isWrapBlock(blocks[index])
}
