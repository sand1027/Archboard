'use client'

import { NOTE_LINE_HEIGHT, type NoteFont, type PaperStyle } from '@/types/notes'

/**
 * The page itself: cream stock, an optional set of rules, and the font choice.
 *
 * Ruled lines are a repeating gradient rather than rendered elements, so they cost nothing and
 * cannot fall out of step with the text. What makes them line up is that every block type
 * occupies exactly one `NOTE_LINE_HEIGHT` — the gradient starts at the same top padding the
 * first line of text does, and both advance by the same amount from there.
 */

/** System stacks only. A notebook that waits on a font download is a notebook that flashes. */
export const FONT_CLASS: Record<NoteFont, string> = {
  sans: 'font-sans',
  serif: 'font-serif',
  mono: 'font-mono',
}

/** Where the first line of text sits, and therefore where the first rule sits. */
const PAPER_PADDING_TOP = 16

export interface NotesPaperProps {
  paper: PaperStyle
  font: NoteFont
  /**
   * Called when the bare page is pressed rather than a line of text.
   *
   * Without this the page is only editable in the 28px strip its first line occupies, and the
   * rest of the sheet does nothing — which reads as a read-only page rather than an empty one.
   */
  onPressEmptyArea: () => void
  children: React.ReactNode
}

export default function NotesPaper({ paper, font, onPressEmptyArea, children }: NotesPaperProps) {
  const ruled = paper === 'ruled'

  return (
    <div
      onMouseDown={(event) => {
        // Only when the press missed every block. Letting it through otherwise would move the
        // caret to the end of the page on every click into the middle of a sentence.
        if ((event.target as HTMLElement).closest('[data-block-id]')) return
        event.preventDefault()
        onPressEmptyArea()
      }}
      className={[
        // Tall enough that there is always page below the text to click on.
        'min-h-full cursor-text px-5 pb-24',
        // Warmer than the app's white so the page reads as paper laid on a surface.
        'bg-[#fffdf7]',
        FONT_CLASS[font],
      ].join(' ')}
      style={{
        paddingTop: PAPER_PADDING_TOP,
        ...(ruled
          ? {
              // The line sits at the *bottom* of each 28px band, which is where a baseline
              // rule belongs — drawing it at the top would strike through the text.
              backgroundImage: `repeating-linear-gradient(
                to bottom,
                transparent 0px,
                transparent ${NOTE_LINE_HEIGHT - 1}px,
                #dbeafe ${NOTE_LINE_HEIGHT - 1}px,
                #dbeafe ${NOTE_LINE_HEIGHT}px
              )`,
              /*
               * Both set to content-box, and no position offset.
               *
               * The origin makes the gradient start where the text starts, which is what aligns
               * the two. Adding a padding-sized offset on top — the obvious-looking thing — would
               * shift the rules a second time and leave every line sitting below its text.
               */
              backgroundClip: 'content-box',
              backgroundOrigin: 'content-box',
            }
          : {}),
      }}
    >
      {children}
    </div>
  )
}
