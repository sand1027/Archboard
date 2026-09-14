import type { Point } from '@/lib/canvas/autoLayout'

/**
 * The text form of a diagram, as persisted.
 *
 * Positions are here rather than in `source` on purpose. Putting `@(x,y)` in the text was
 * the obvious alternative and it is a trap: every drag becomes a source diff, code review
 * fills with coordinate churn, and the document stops being about the architecture. Keeping
 * pins beside the text means the text says what the system *is* and this says where someone
 * happened to put the boxes.
 */
export interface DslDocument {
  source: string
  /**
   * Manual positions, keyed by DSL name rather than node id.
   *
   * Node ids are generated per compile, so a pin keyed by id would be orphaned by the next
   * keystroke. The name in the source is the stable identity.
   */
  pins: Record<string, Point>
  /**
   * Whether the text or the canvas is authoritative.
   *
   * A diagram someone has always drawn has no source, and one written as code should not be
   * silently reformatted by a stray canvas nudge — so the two directions are not symmetric
   * and the document has to record which way it flows.
   */
  enabled: boolean
}

export function emptyDslDocument(): DslDocument {
  return { source: '', pins: {}, enabled: false }
}
