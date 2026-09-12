import type { LldEdgeKind, LldEdgeStyle, LldMarkerId, ErCardinality } from '@/types/lld'

/**
 * The single source of truth for how every LLD relationship is drawn.
 *
 * Typed as a total Record (not Partial), so adding an LldEdgeKind without
 * notation fails to compile rather than silently falling back to a generic
 * arrow — which is what the pre-existing RELATION_STYLES table does today.
 */

const STROKE = '#334155'
const BASE = { stroke: STROKE, strokeWidth: 1.5 } as const

export const NOTATION: Record<LldEdgeKind, LldEdgeStyle> = {
  // ── object / communication ────────────────────────────────────────────────
  'obj-link': {
    ...BASE,
    line: 'solid',
    path: 'straight',
    startMarker: 'none',
    endMarker: 'none',
  },
  'comm-message': {
    ...BASE,
    line: 'solid',
    path: 'straight',
    startMarker: 'none',
    endMarker: 'arrow-filled',
  },

  // ── deployment ────────────────────────────────────────────────────────────
  // A communication path is a plain association between nodes; «deploy» and
  // «manifest» are dashed dependencies distinguished by their keyword.
  'deploy-communication': {
    ...BASE,
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'none',
  },
  'deploy-deployment': {
    ...BASE,
    line: 'dashed',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'arrow-open',
  },
  'deploy-manifest': {
    ...BASE,
    line: 'dashed',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'arrow-open',
  },

  // ── component ─────────────────────────────────────────────────────────────
  'comp-assembly': {
    ...BASE,
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'port-provided',
  },
  'comp-delegation': {
    ...BASE,
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'arrow-open',
  },
  'comp-dependency': {
    ...BASE,
    line: 'dashed',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'arrow-open',
  },

  // ── package ───────────────────────────────────────────────────────────────
  'pkg-import': {
    ...BASE,
    line: 'dashed',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'arrow-open',
  },
  'pkg-merge': {
    ...BASE,
    line: 'dashed',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'arrow-open',
  },
  'pkg-nesting': {
    ...BASE,
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'circle-plus',
  },

  // ── use case ──────────────────────────────────────────────────────────────
  // Association is a plain undirected line; include/extend are dashed
  // dependencies distinguished only by their stereotype label, so the label is
  // load-bearing notation here rather than decoration.
  'uc-association': {
    ...BASE,
    line: 'solid',
    path: 'straight',
    startMarker: 'none',
    endMarker: 'none',
  },
  'uc-include': {
    ...BASE,
    line: 'dashed',
    path: 'straight',
    startMarker: 'none',
    endMarker: 'arrow-open',
  },
  'uc-extend': {
    ...BASE,
    line: 'dashed',
    path: 'straight',
    startMarker: 'none',
    endMarker: 'arrow-open',
  },
  'uc-generalization': {
    ...BASE,
    line: 'solid',
    path: 'straight',
    startMarker: 'none',
    endMarker: 'triangle-hollow',
  },
  'uc-dependency': {
    ...BASE,
    line: 'dashed',
    path: 'straight',
    startMarker: 'none',
    endMarker: 'arrow-open',
  },

  // ── class ─────────────────────────────────────────────────────────────────
  inheritance: {
    ...BASE,
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'triangle-hollow',
  },
  realization: {
    ...BASE,
    line: 'dashed',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'triangle-hollow',
  },
  composition: {
    ...BASE,
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'diamond-filled',
    endMarker: 'none',
  },
  aggregation: {
    ...BASE,
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'diamond-hollow',
    endMarker: 'none',
  },
  association: {
    ...BASE,
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'none',
  },
  dependency: {
    ...BASE,
    line: 'dashed',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'arrow-open',
  },

  // ── sequence ──────────────────────────────────────────────────────────────
  'msg-sync': {
    ...BASE,
    line: 'solid',
    path: 'straight',
    startMarker: 'none',
    endMarker: 'arrow-filled',
  },
  'msg-async': {
    ...BASE,
    line: 'solid',
    path: 'straight',
    startMarker: 'none',
    endMarker: 'arrow-open',
  },
  'msg-return': {
    ...BASE,
    line: 'dashed',
    path: 'straight',
    startMarker: 'none',
    endMarker: 'arrow-open',
  },
  'msg-create': {
    ...BASE,
    line: 'dashed',
    path: 'straight',
    startMarker: 'none',
    endMarker: 'arrow-open',
  },
  'msg-destroy': {
    ...BASE,
    line: 'dashed',
    path: 'straight',
    startMarker: 'none',
    endMarker: 'cross-destroy',
  },

  // ── ER ────────────────────────────────────────────────────────────────────
  // Endpoint glyphs are overridden per-edge from cardinality (see
  // cardinalityMarker); these are the defaults for a freshly drawn relation.
  'er-one-to-one': {
    ...BASE,
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'crowsfoot-one',
    endMarker: 'crowsfoot-one',
  },
  'er-one-to-many': {
    ...BASE,
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'crowsfoot-one',
    endMarker: 'crowsfoot-one-many',
  },
  'er-many-to-many': {
    ...BASE,
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'crowsfoot-one-many',
    endMarker: 'crowsfoot-one-many',
  },
  'er-fk-ref': {
    ...BASE,
    line: 'dotted',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'arrow-open',
  },

  // ── API ───────────────────────────────────────────────────────────────────
  'api-request': {
    ...BASE,
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'arrow-open',
  },
  'api-response': {
    ...BASE,
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'arrow-open',
  },
  'api-annotation': {
    ...BASE,
    line: 'dotted',
    path: 'straight',
    startMarker: 'none',
    endMarker: 'none',
  },

  // ── state / activity / internal ───────────────────────────────────────────
  'state-transition': {
    ...BASE,
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'arrow-filled',
  },
  'activity-flow': {
    ...BASE,
    line: 'solid',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'arrow-filled',
  },
  'internal-dependency': {
    ...BASE,
    line: 'dashed',
    path: 'smoothstep',
    startMarker: 'none',
    endMarker: 'arrow-open',
  },
}

/** ER crow's-foot glyph for one endpoint's cardinality. */
export function cardinalityMarker(c: ErCardinality): LldMarkerId {
  switch (c) {
    case 'one':
      return 'crowsfoot-one'
    case 'zero-or-one':
      return 'crowsfoot-zero-one'
    case 'one-or-many':
      return 'crowsfoot-one-many'
    case 'zero-or-many':
      return 'crowsfoot-zero-many'
  }
}

/** UML-style multiplicity text, for ER diagrams set to `erNotation: 'uml'`. */
export function cardinalityLabel(c: ErCardinality): string {
  switch (c) {
    case 'one':
      return '1'
    case 'zero-or-one':
      return '0..1'
    case 'one-or-many':
      return '1..*'
    case 'zero-or-many':
      return '0..*'
  }
}

/** Human-readable name, used by inspector dropdowns. */
export const EDGE_KIND_LABEL: Record<LldEdgeKind, string> = {
  'obj-link': 'Link',
  'comm-message': 'Message',
  'deploy-communication': 'Communication path',
  'deploy-deployment': 'Deploy',
  'deploy-manifest': 'Manifest',
  'comp-assembly': 'Assembly',
  'comp-delegation': 'Delegation',
  'comp-dependency': 'Dependency',
  'pkg-import': 'Import',
  'pkg-merge': 'Merge',
  'pkg-nesting': 'Nesting',
  'uc-association': 'Association',
  'uc-include': 'Include',
  'uc-extend': 'Extend',
  'uc-generalization': 'Generalization',
  'uc-dependency': 'Dependency',
  inheritance: 'Inheritance',
  realization: 'Realization',
  composition: 'Composition',
  aggregation: 'Aggregation',
  association: 'Association',
  dependency: 'Dependency',
  'msg-sync': 'Synchronous call',
  'msg-async': 'Asynchronous call',
  'msg-return': 'Return',
  'msg-create': 'Create',
  'msg-destroy': 'Destroy',
  'er-one-to-one': 'One to one',
  'er-one-to-many': 'One to many',
  'er-many-to-many': 'Many to many',
  'er-fk-ref': 'FK reference',
  'api-request': 'Request schema',
  'api-response': 'Response schema',
  'api-annotation': 'Annotation',
  'state-transition': 'Transition',
  'activity-flow': 'Control flow',
  'internal-dependency': 'Dependency',
}
