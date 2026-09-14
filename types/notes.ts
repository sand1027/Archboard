/**
 * Requirements notes — the part of a system design interview that happens before any box is
 * drawn.
 *
 * Structured rather than freeform on purpose. A blank text area is a worse tool for learning
 * than a checklist: the value is in being asked "what happens when a write fails?" at the
 * moment you would otherwise have skipped it. So requirements are typed items with prompts
 * attached, not a notepad.
 */

export type RequirementKind = 'functional' | 'nonFunctional' | 'assumption'

/**
 * The axes a non-functional requirement usually falls along.
 *
 * Loose on purpose — `other` exists because a taxonomy that forces a bad fit teaches the
 * taxonomy rather than the system.
 */
export type NfrCategory =
  | 'scalability'
  | 'availability'
  | 'latency'
  | 'consistency'
  | 'security'
  | 'cost'
  | 'durability'
  | 'maintainability'
  | 'other'

export interface RequirementItem {
  id: string
  kind: RequirementKind
  title: string
  /** The detail: a number, a trade-off, the reasoning. */
  body: string
  /** Set for non-functional items only. */
  category?: NfrCategory
  /** Ticked when the design actually addresses it. */
  done: boolean
  createdAt: string
  updatedAt: string
}

/** Persisted alongside the diagram. */
export interface NotesDocument {
  items: RequirementItem[]
}

// ─── copy ─────────────────────────────────────────────────────────────────────

export const KIND_LABEL: Record<RequirementKind, string> = {
  functional: 'Functional',
  nonFunctional: 'Non-functional',
  assumption: 'Assumptions',
}

export const NFR_CATEGORY_LABEL: Record<NfrCategory, string> = {
  scalability: 'Scalability',
  availability: 'Availability',
  latency: 'Latency',
  consistency: 'Consistency',
  security: 'Security',
  cost: 'Cost',
  durability: 'Durability',
  maintainability: 'Maintainability',
  other: 'Other',
}

export const NFR_CATEGORIES = Object.keys(NFR_CATEGORY_LABEL) as NfrCategory[]

/**
 * Three prompts per tab.
 *
 * Three because the point is to start thinking, not to fill in a form — a list of twelve gets
 * skimmed and ignored. These are the questions that most often go unasked.
 */
export const PROMPTS: Record<RequirementKind, string[]> = {
  functional: [
    'What can a user actually do?',
    'What happens at the edges — empty, duplicate, deleted?',
    'What is explicitly out of scope?',
  ],
  nonFunctional: [
    'How many users, and how much traffic at peak?',
    'How slow is too slow, and measured at which percentile?',
    'What may go stale, and what must never be lost?',
  ],
  assumption: [
    'What are you taking as given because you asked and were told?',
    'Which numbers did you invent, and would the design change if they were 10× off?',
    'What are you deliberately ignoring for now?',
  ],
}

/** Placeholder text per tab, so an empty card suggests its own shape. */
export const TITLE_PLACEHOLDER: Record<RequirementKind, string> = {
  functional: 'Users can upload a photo',
  nonFunctional: 'Feed loads in under 200ms at p95',
  assumption: '100M daily actives, 10 requests each',
}

export const BODY_PLACEHOLDER: Record<RequirementKind, string> = {
  functional: 'Up to 10MB, JPEG or PNG. Rejected files return a reason.',
  nonFunctional: 'Measured at the API edge, excluding client render.',
  assumption: 'Given by the interviewer. Peak is 3× average.',
}
