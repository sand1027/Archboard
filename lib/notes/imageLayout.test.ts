import { describe, expect, it } from 'vitest'
import { emptyBlock } from '@/store/notesStore'
import { isFirstLineAfterImage, isWrapBlock, wrapRangeAfterImage } from './imageLayout'

const image = emptyBlock('image', 'shot', 'data:image/png;base64,xx')
const body = (text: string) => emptyBlock('body', text)
const heading = emptyBlock('heading', 'Next')

describe('isWrapBlock', () => {
  it('lets body and bullets wrap around a picture', () => {
    expect(isWrapBlock(body('hi'))).toBe(true)
    expect(isWrapBlock(emptyBlock('bullet', 'item'))).toBe(true)
  })

  it('keeps headings and images on their own row', () => {
    expect(isWrapBlock(heading)).toBe(false)
    expect(isWrapBlock(image)).toBe(false)
  })
})

describe('wrapRangeAfterImage', () => {
  it('takes the bodies that follow a picture', () => {
    const blocks = [image, body('beside'), body('below')]
    expect(wrapRangeAfterImage(blocks, 0).wrap.map((b) => b.text)).toEqual(['beside', 'below'])
    expect(wrapRangeAfterImage(blocks, 0).nextIndex).toBe(3)
  })

  it('stops before a heading so that line can sit under the picture at full width', () => {
    const blocks = [image, body('beside'), heading, body('after')]
    const range = wrapRangeAfterImage(blocks, 0)
    expect(range.wrap.map((b) => b.text)).toEqual(['beside'])
    expect(range.nextIndex).toBe(2)
  })

  it('has nothing to wrap when the next block is a heading', () => {
    expect(wrapRangeAfterImage([image, heading], 0)).toEqual({ wrap: [], nextIndex: 1 })
  })
})

describe('isFirstLineAfterImage', () => {
  it('is the first body after a picture', () => {
    const blocks = [image, body('beside'), body('below')]
    expect(isFirstLineAfterImage(blocks, 1)).toBe(true)
    expect(isFirstLineAfterImage(blocks, 2)).toBe(false)
  })
})
