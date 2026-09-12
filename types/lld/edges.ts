// LLD edge model.
//
// `kind` values are globally unique across all arms so a single flat NOTATION
// table can key on them. Adding a kind without notation is a compile error.

import type { Edge } from '@xyflow/react'
import type { LldEdgeStyle } from './style'

export type Multiplicity = '1' | '0..1' | '0..*' | '1..*' | '*'

export const MULTIPLICITIES: readonly Multiplicity[] = ['1', '0..1', '0..*', '1..*', '*']

export interface LldEdgeBase extends Record<string, unknown> {
  label?: string
  /** Per-edge escape hatch over the NOTATION default. */
  styleOverride?: Partial<LldEdgeStyle>
}

// ─── class relations ─────────────────────────────────────────────────────────

export type ClassRelationKind =
  | 'inheritance'
  | 'realization'
  | 'composition'
  | 'aggregation'
  | 'association'
  | 'dependency'

export interface ClassRelationData extends LldEdgeBase {
  kind: ClassRelationKind
  sourceMultiplicity?: Multiplicity
  targetMultiplicity?: Multiplicity
  sourceRole?: string
  targetRole?: string
  /** association only — adds an open arrowhead at the target. */
  isDirected?: boolean
}
export type ClassRelation = Edge<ClassRelationData, 'lldClassRelation'>

// ─── object / communication diagram ──────────────────────────────────────────

export interface ObjectLinkData extends LldEdgeBase {
  kind: 'obj-link'
  sourceRole?: string
  targetRole?: string
}
export type ObjectLink = Edge<ObjectLinkData, 'lldObjectLink'>

/**
 * Communication diagram message. Sequence numbering is hierarchical
 * ("1", "1.1", "2a"), so it is a string rather than a number.
 */
export interface CommunicationMessageData extends LldEdgeBase {
  kind: 'comm-message'
  sequence: string
  isReturn?: boolean
}
export type CommunicationMessage = Edge<CommunicationMessageData, 'lldCommMessage'>

// ─── deployment diagram ──────────────────────────────────────────────────────

export type DeploymentRelationKind =
  | 'deploy-communication'
  | 'deploy-deployment'
  | 'deploy-manifest'

export interface DeploymentRelationData extends LldEdgeBase {
  kind: DeploymentRelationKind
  /** Communication paths carry the transport, e.g. TCP/IP, HTTPS. */
  protocol?: string
}
export type DeploymentRelation = Edge<DeploymentRelationData, 'lldDeploymentRelation'>

// ─── component diagram ───────────────────────────────────────────────────────

export type ComponentRelationKind = 'comp-assembly' | 'comp-delegation' | 'comp-dependency'

export interface ComponentRelationData extends LldEdgeBase {
  kind: ComponentRelationKind
  interfaceName?: string
}
export type ComponentRelation = Edge<ComponentRelationData, 'lldComponentRelation'>

// ─── package diagram ─────────────────────────────────────────────────────────

export type PackageRelationKind = 'pkg-import' | 'pkg-merge' | 'pkg-nesting'

export interface PackageRelationData extends LldEdgeBase {
  kind: PackageRelationKind
}
export type PackageRelation = Edge<PackageRelationData, 'lldPackageRelation'>

// ─── use case relationships ──────────────────────────────────────────────────

export type UseCaseRelationKind =
  | 'uc-association'
  | 'uc-include'
  | 'uc-extend'
  | 'uc-generalization'
  | 'uc-dependency'

export interface UseCaseRelationData extends LldEdgeBase {
  kind: UseCaseRelationKind
  /** Association multiplicity, e.g. an actor driving 1..* use cases. */
  sourceMultiplicity?: Multiplicity
  targetMultiplicity?: Multiplicity
  /** «extend» only — which extension point on the base use case. */
  extensionPointId?: string
  /** «extend» only — the condition under which the extension runs. */
  condition?: string
  /** Association only; use case diagrams are usually undirected. */
  isDirected?: boolean
}
export type UseCaseRelation = Edge<UseCaseRelationData, 'lldUseCaseRelation'>

// ─── sequence messages ───────────────────────────────────────────────────────

export type SequenceMessageKind =
  | 'msg-sync'
  | 'msg-async'
  | 'msg-return'
  | 'msg-create'
  | 'msg-destroy'

export interface SequenceMessageData extends LldEdgeBase {
  kind: SequenceMessageKind
  /** Slot on the vertical time axis. Unique per diagram; gaps are allowed. */
  order: number
  fragmentId?: string
  operandId?: string
}
export type SequenceMessage = Edge<SequenceMessageData, 'lldSequenceMessage'>

// ─── ER relations ────────────────────────────────────────────────────────────

export type ErRelationKind =
  | 'er-one-to-one'
  | 'er-one-to-many'
  | 'er-many-to-many'
  | 'er-fk-ref'

export type ErCardinality = 'one' | 'zero-or-one' | 'one-or-many' | 'zero-or-many'

export interface ErRelationData extends LldEdgeBase {
  kind: ErRelationKind
  sourceCardinality: ErCardinality
  targetCardinality: ErCardinality
  /** Set for column-level FK lines. Handle ids are `col:{columnId}`. */
  sourceColumnId?: string
  targetColumnId?: string
  onDelete?: 'cascade' | 'restrict' | 'set-null' | 'no-action'
}
export type ErRelation = Edge<ErRelationData, 'lldErRelation'>

// ─── API links ───────────────────────────────────────────────────────────────

export type ApiLinkKind = 'api-request' | 'api-response' | 'api-annotation'

export interface ApiLinkData extends LldEdgeBase {
  kind: ApiLinkKind
  /** api-response only; also drives the edge label. */
  statusCode?: number
}
export type ApiLink = Edge<ApiLinkData, 'lldApiLink'>

// ─── state transitions ───────────────────────────────────────────────────────

export interface StateTransitionData extends LldEdgeBase {
  kind: 'state-transition'
  event?: string
  guard?: string
  action?: string
}
export type StateTransition = Edge<StateTransitionData, 'lldStateTransition'>

// ─── activity flow ───────────────────────────────────────────────────────────

export interface ActivityFlowData extends LldEdgeBase {
  kind: 'activity-flow'
  condition?: string
}
export type ActivityFlow = Edge<ActivityFlowData, 'lldActivityFlow'>

// ─── internal dependency ─────────────────────────────────────────────────────

export interface InternalDependencyData extends LldEdgeBase {
  kind: 'internal-dependency'
  protocol?: string
}
export type InternalDependency = Edge<InternalDependencyData, 'lldInternalDependency'>

// ─── union ───────────────────────────────────────────────────────────────────

export type LldEdge =
  | ObjectLink
  | CommunicationMessage
  | DeploymentRelation
  | ComponentRelation
  | PackageRelation
  | UseCaseRelation
  | ClassRelation
  | SequenceMessage
  | ErRelation
  | ApiLink
  | StateTransition
  | ActivityFlow
  | InternalDependency

export type LldEdgeType = NonNullable<LldEdge['type']>

export type LldEdgeData = NonNullable<LldEdge['data']>

export type LldEdgeKind = LldEdgeData['kind']

/** Compose a state transition label: `event [guard] / action`. */
export function formatTransitionLabel(d: StateTransitionData): string {
  const parts: string[] = []
  if (d.event) parts.push(d.event)
  if (d.guard) parts.push(`[${d.guard}]`)
  if (d.action) parts.push(`/ ${d.action}`)
  return parts.join(' ')
}
