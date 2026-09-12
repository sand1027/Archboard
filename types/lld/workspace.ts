// LLD workspace containers.

import type { Viewport } from '@/types/architecture'
import type { LldShape } from './shapes'
import type { LldEdge } from './edges'

export type LldDiagramType =
  | 'usecase'
  | 'class'
  | 'object'
  | 'package'
  | 'component'
  | 'deployment'
  | 'communication'
  | 'sequence'
  | 'er'
  | 'api'
  | 'state'
  | 'activity'
  | 'internal'

export const LLD_DIAGRAM_TYPES: readonly LldDiagramType[] = [
  'usecase',
  'class',
  'object',
  'package',
  'component',
  'deployment',
  'communication',
  'sequence',
  'er',
  'api',
  'state',
  'activity',
  'internal',
]

/** ER diagrams support crow's-foot or UML multiplicity notation, per diagram. */
export type ErNotationStyle = 'crowsfoot' | 'uml'

export interface LldDiagram {
  id: string
  type: LldDiagramType
  name: string
  shapes: LldShape[]
  edges: LldEdge[]
  viewport: Viewport
  /** Only read by ER diagrams. Defaults to 'crowsfoot'. */
  erNotation?: ErNotationStyle
}

/**
 * Store key for the standalone LLD board — the mode reached from the navbar tab,
 * not attached to any HLD component. Attaching to a component is additive: a
 * workspace simply gains a `componentId`.
 */
export const STANDALONE_LLD_SCOPE = '__board__'

export interface LldWorkspace {
  id: string
  /** Store key: an HLD node id, or STANDALONE_LLD_SCOPE for the unattached board. */
  scopeId: string
  /** Set only when this workspace details a specific HLD component. */
  componentId?: string
  /** FK → diagrams.id */
  diagramId: string
  /** Shown in the header; the component label when attached. */
  title: string
  diagrams: LldDiagram[]
  activeDiagramId: string | null
  createdAt: string
  updatedAt: string
}

export function isStandaloneScope(scopeId: string): boolean {
  return scopeId === STANDALONE_LLD_SCOPE
}

export interface LldDiagramSnapshot {
  shapes: LldShape[]
  edges: LldEdge[]
}

export function emptyDiagram(
  id: string,
  type: LldDiagramType,
  name: string
): LldDiagram {
  return {
    id,
    type,
    name,
    shapes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    ...(type === 'er' ? { erNotation: 'crowsfoot' as ErNotationStyle } : {}),
  }
}
