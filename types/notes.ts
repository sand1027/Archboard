/**
 * A notebook that travels with the diagram.
 *
 * Three pages — functional, non-functional, assumptions — because those are the parts of a
 * design that get skipped, and a page with a name on it is harder to skip than a blank file.
 * Inside each page it is a writing surface rather than a form: real thinking about a system
 * does not arrive pre-broken into fields.
 *
 * Blocks hold plain text, never HTML. That keeps a stored document from being a place someone
 * can put markup, so hydrating one needs no sanitiser.
 */

export type NoteKind =
  | 'functional'
  | 'nonFunctional'
  | 'assumption'
  | 'tradeoff'
  /** Unstructured. Whatever you are learning, pasted or jotted as it happens. */
  | 'scratch'

export type PaperStyle = 'ruled' | 'unruled'

export type NoteFont = 'sans' | 'serif' | 'mono'

export type BlockType = 'heading' | 'subheading' | 'body' | 'bullet' | 'image'

export interface NoteBlock {
  id: string
  type: BlockType
  text: string
  /** Data URL or app path. Only on `image` blocks. */
  src?: string
  /**
   * How wide the image sits on the page, as a percent of the paper.
   *
   * Images only. Missing means full width — older notebooks never stored a size.
   */
  widthPct?: number
}

export interface NotePage {
  kind: NoteKind
  paper: PaperStyle
  font: NoteFont
  blocks: NoteBlock[]
  /**
   * The "Think about" questions for this page.
   *
   * Starts as the catalog in `PROMPTS`, then belongs to the notebook — so FR / NFR / Given /
   * Trade-offs can be rewritten per diagram instead of staying frozen in code.
   */
  prompts: NotePrompt[]
}

/** Persisted alongside the diagram. Always one page per kind once hydrated. */
export interface NotesDocument {
  pages: NotePage[]
}

/**
 * Page order, and the guarantee that every page exists.
 *
 * Ordered as the thinking runs: what it does, how well it must do it, what was taken as given,
 * and finally what was chosen and given up. Trade-offs sit last because they are the only page
 * you cannot write until the design exists.
 */
export const NOTE_KINDS: NoteKind[] = [
  'functional',
  'nonFunctional',
  'assumption',
  'tradeoff',
  'scratch',
]

// ─── layout ───────────────────────────────────────────────────────────────────

/**
 * The vertical rhythm, in pixels.
 *
 * Every block type occupies exactly one of these, differing by weight and size rather than by
 * line height. That is what lets the ruled lines line up under a heading as well as a
 * paragraph — spacing headings differently would leave the text drifting off the rules a few
 * lines down, which is the detail that makes fake paper look fake.
 */
export const NOTE_LINE_HEIGHT = 28

// ─── copy ─────────────────────────────────────────────────────────────────────

export const KIND_LABEL: Record<NoteKind, string> = {
  functional: 'Functional',
  nonFunctional: 'Non-functional',
  assumption: 'Assumptions',
  tradeoff: 'Trade-offs',
  scratch: 'Scratch',
}

/**
 * Short form, for the page tabs.
 *
 * FR / NFR stay abbreviated because those names are how people say them. Assumptions and
 * Trade-offs are spelled out: an earlier bar labelled them "Given" and "Trade", then truncated
 * both, so the pages looked as if they were not there.
 */
export const KIND_TAB: Record<NoteKind, string> = {
  functional: 'FR',
  nonFunctional: 'NFR',
  assumption: 'Assumptions',
  tradeoff: 'Trade-offs',
  scratch: 'Scratch',
}

export const BLOCK_LABEL: Record<BlockType, string> = {
  heading: 'Section',
  subheading: 'Subsection',
  body: 'Body',
  bullet: 'Bullet',
  image: 'Image',
}

export const PAPER_LABEL: Record<PaperStyle, string> = {
  ruled: 'Ruled',
  unruled: 'Plain',
}

export const FONT_LABEL: Record<NoteFont, string> = {
  sans: 'Sans',
  serif: 'Serif',
  mono: 'Mono',
}

/**
 * A prompt: the axis, and the question that actually teaches.
 *
 * Both, because one word is not guidance. "Latency" is a label you can nod at and move past;
 * "how slow is too slow, and at which percentile?" is the question that makes you go and find a
 * number. The label exists only so the collapsed strip fits — the question is the point.
 */
export interface NotePrompt {
  id: string
  /** Chip text for the collapsed strip. */
  label: string
  /** The question itself, and what gets written onto the page when it is picked. */
  question: string
}

/** A catalog entry, before it is copied onto a page and given an id. */
export type PromptSeed = Omit<NotePrompt, 'id'>

/**
 * What to think about on each page.
 *
 * The non-functional list is the set of axes a design gets judged on, and it is deliberately
 * longer than the others: it is the page people leave emptiest and the one interviewers push on
 * hardest.
 */
export const PROMPTS: Record<NoteKind, PromptSeed[]> = {
  functional: [
    { label: 'Capabilities', question: 'What can a user actually do?' },
    {
      label: 'Edge cases',
      question: 'What happens at the edges — empty, duplicate, already deleted?',
    },
    { label: 'Out of scope', question: 'What are you explicitly not building?' },
  ],
  nonFunctional: [
    { label: 'Scale', question: 'How many users, and how much traffic at peak?' },
    { label: 'Latency', question: 'How slow is too slow, and measured at which percentile?' },
    {
      label: 'Availability',
      question: 'What uptime is expected, and what does a failure look like to a user?',
    },
    { label: 'Consistency', question: 'What may go stale, and what must never be lost?' },
    {
      label: 'Durability',
      question: 'How many copies are kept, and could you survive losing a region?',
    },
    { label: 'Security', question: 'Who may see this, and how do you prove who they are?' },
    { label: 'Cost', question: 'What is the budget, and which component dominates the bill?' },
    {
      label: 'Operability',
      question: 'Who is paged at 3am, and what do they need to see to fix it?',
    },
  ],
  assumption: [
    {
      label: 'Given',
      question: 'What are you taking as given because you asked and were told?',
    },
    {
      label: 'Invented',
      question: 'Which numbers did you invent, and would the design change if they were 10× off?',
    },
    { label: 'Ignored', question: 'What are you deliberately ignoring for now?' },
  ],
  tradeoff: [
    { label: 'Alternatives', question: 'What else could have gone here, and why not?' },
    { label: 'Given up', question: 'What did this choice make worse?' },
    {
      label: 'First to break',
      question: 'Which component fails first under load, and what do you do then?',
    },
    {
      label: 'Correctness',
      question: 'Where did you trade correctness for speed, and can a user tell?',
    },
    { label: 'Build or buy', question: 'What are you building that you could rent?' },
    { label: 'Reversibility', question: 'Which of these would be expensive to undo later?' },
  ],
  // Empty on purpose. The point of a scratch page is that nothing is asking you anything.
  scratch: [],
}

/** Placeholder for the first empty block on each page. */
export const PLACEHOLDER: Record<NoteKind, string> = {
  functional: 'Users can upload a photo, up to 10MB…',
  nonFunctional: 'Feed loads under 200ms at p95…',
  assumption: '100M daily actives, 10 requests each…',
  tradeoff: 'Chose Redis over Memcached because…',
  scratch: 'Start typing. Anything at all.',
}

// ─── defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_PAPER: PaperStyle = 'unruled'
export const DEFAULT_FONT: NoteFont = 'sans'

/** Smallest useful picture on the page — below this it is a thumbnail you cannot read. */
export const MIN_IMAGE_WIDTH_PCT = 20
export const MAX_IMAGE_WIDTH_PCT = 100

export function clampImageWidthPct(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return MAX_IMAGE_WIDTH_PCT
  return Math.min(MAX_IMAGE_WIDTH_PCT, Math.max(MIN_IMAGE_WIDTH_PCT, Math.round(value)))
}

/**
 * True when a page has been left exactly as it was created.
 *
 * Used to keep the stored document free of a notebook nobody wrote in — including one where
 * the paper was switched and then switched back.
 */
export function isPageUntouched(page: NotePage): boolean {
  return (
    page.paper === DEFAULT_PAPER &&
    page.font === DEFAULT_FONT &&
    page.blocks.every(
      (block) => block.type === 'body' && block.text.trim() === '' && !block.src
    ) &&
    promptsMatchCatalog(page.kind, page.prompts ?? [])
  )
}

/**
 * True when the page still has the built-in questions, in order.
 *
 * Ids are ignored: they are minted per notebook and are not part of the catalog.
 */
export function promptsMatchCatalog(kind: NoteKind, prompts: NotePrompt[]): boolean {
  const catalog = PROMPTS[kind]
  if (prompts.length !== catalog.length) return false
  return prompts.every(
    (prompt, i) => prompt.label === catalog[i].label && prompt.question === catalog[i].question
  )
}
