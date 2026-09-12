// LLD shape model.
//
// The discriminated union IS the React Flow node union, keyed on `type`.
// Geometry (position / width / height) lives at the node level where React Flow
// owns it; `data` carries only domain metadata. See docs/lld/design.md §3.1.

import type { Node } from '@xyflow/react'

/** xyflow v12 requires node data to be index-signature compatible. */
export interface LldShapeBase extends Record<string, unknown> {
  label: string
  fill?: string
  stroke?: string
  /** Inspector-only annotation; not rendered on canvas. */
  note?: string
}

// ─── class diagram ───────────────────────────────────────────────────────────

export type Visibility = 'public' | 'private' | 'protected' | 'package'

export const VISIBILITY_SIGIL: Record<Visibility, string> = {
  public: '+',
  private: '-',
  protected: '#',
  package: '~',
}

export type ClassStereotype =
  | 'class'
  | 'interface'
  | 'abstract'
  | 'enum'
  | 'struct'
  // Analysis stereotypes (Jacobson / robustness diagrams)
  | 'boundary'
  | 'control'
  | 'entity'
  // Language-level classifiers
  | 'utility'
  | 'primitive'
  | 'datatype'
  | 'exception'
  | 'template'

export interface ClassField {
  id: string
  name: string
  type?: string
  visibility: Visibility
  isStatic?: boolean
}

export interface MethodParam {
  name: string
  type?: string
}

export interface ClassMethod {
  id: string
  name: string
  params: MethodParam[]
  returnType?: string
  visibility: Visibility
  isStatic?: boolean
  isAbstract?: boolean
}

export interface ClassShapeData extends LldShapeBase {
  stereotype: ClassStereotype
  fields: ClassField[]
  methods: ClassMethod[]
  /** Only meaningful when stereotype === 'enum'. */
  enumValues: string[]
  /** e.g. "<T extends Entity>" */
  generics?: string
}
export type ClassShape = Node<ClassShapeData, 'lldClass'>

// ─── use case diagram ────────────────────────────────────────────────────────

/**
 * Actor — the standard "stick man". UML also allows a custom icon for
 * non-human actors, which `isSystem` selects.
 */
export interface UseCaseActorShapeData extends LldShapeBase {
  /** Secondary actors are conventionally drawn to the right of the subject. */
  isPrimary?: boolean
  /** External system rather than a person; drawn as a boxed icon. */
  isSystem?: boolean
}
export type UseCaseActorShape = Node<UseCaseActorShapeData, 'lldActor'>

/** A named point in a use case's flow that an «extend» can attach to. */
export interface ExtensionPoint {
  id: string
  name: string
  location?: string
}

export interface UseCaseShapeData extends LldShapeBase {
  /** Horizontal ellipse per UML. */
  extensionPoints: ExtensionPoint[]
  /** Optional short goal statement shown under the name. */
  summary?: string
  isAbstract?: boolean
}
export type UseCaseShape = Node<UseCaseShapeData, 'lldUseCase'>

/**
 * Subject / system boundary: a rectangle with its name in the upper corner,
 * use cases inside and actors outside.
 */
export interface SystemBoundaryShapeData extends LldShapeBase {
  /** e.g. «system», «subsystem» */
  stereotype?: string
}
export type SystemBoundaryShape = Node<SystemBoundaryShapeData, 'lldBoundary'>

export interface LldPackageShapeData extends LldShapeBase {
  stereotype?: string
}
export type LldPackageShape = Node<LldPackageShapeData, 'lldPackage'>

// ─── sequence diagram ────────────────────────────────────────────────────────

export type SequenceLifelineKind = 'actor' | 'participant' | 'boundary' | 'control' | 'entity'

export interface SequenceLifelineShapeData extends LldShapeBase {
  lifelineKind: SequenceLifelineKind
  /** Set when a create-message brings this participant into existence. */
  createdByMessageId?: string
  destroyedByMessageId?: string
}
export type SequenceLifelineShape = Node<SequenceLifelineShapeData, 'lldLifeline'>

export interface SequenceActivationShapeData extends LldShapeBase {
  /** Lifeline this bar belongs to, when the user drops it onto one. */
  lifelineId?: string
}
export type SequenceActivationShape = Node<SequenceActivationShapeData, 'lldActivation'>

export type FragmentOperator = 'alt' | 'opt' | 'loop' | 'par' | 'critical' | 'ref'

export interface FragmentOperand {
  id: string
  guard: string
}

export interface SequenceFragmentShapeData extends LldShapeBase {
  operator: FragmentOperator
  /** One compartment per operand. `alt` has ≥2; `opt`/`loop` have 1. */
  operands: FragmentOperand[]
}
export type SequenceFragmentShape = Node<SequenceFragmentShapeData, 'lldFragment'>

// ─── ER / schema diagram ─────────────────────────────────────────────────────

export interface ErColumn {
  id: string
  name: string
  type: string
  isPk?: boolean
  isFk?: boolean
  isUnique?: boolean
  isNullable?: boolean
  defaultValue?: string
  references?: { tableId: string; columnId: string }
}

export interface ErIndex {
  id: string
  name: string
  columnIds: string[]
  isUnique?: boolean
}

export interface ErTableShapeData extends LldShapeBase {
  tableKind: 'table' | 'view'
  columns: ErColumn[]
  indexes: ErIndex[]
  /** SELECT body; only for tableKind === 'view'. */
  viewQuery?: string
}
export type ErTableShape = Node<ErTableShapeData, 'lldTable'>

// ─── API contract diagram ────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface ApiEndpointShapeData extends LldShapeBase {
  method: HttpMethod
  path: string
  summary?: string
  operationId?: string
}
export type ApiEndpointShape = Node<ApiEndpointShapeData, 'lldEndpoint'>

export interface SchemaField {
  id: string
  name: string
  type: string
  required?: boolean
  description?: string
}

export interface ApiSchemaShapeData extends LldShapeBase {
  role: 'request' | 'response'
  /** Only for role === 'response'. */
  statusCode?: number
  contentType: string
  fields: SchemaField[]
}
export type ApiSchemaShape = Node<ApiSchemaShapeData, 'lldSchema'>

export type AnnotationKind = 'auth' | 'rate-limit' | 'middleware' | 'cache'

export interface ApiAnnotationShapeData extends LldShapeBase {
  annotationKind: AnnotationKind
  detail: string
}
export type ApiAnnotationShape = Node<ApiAnnotationShapeData, 'lldAnnotation'>

// ─── state diagram ───────────────────────────────────────────────────────────

export type StateKind =
  | 'initial'
  | 'state'
  | 'final'
  | 'choice'
  // Composite / submachine states
  | 'composite'
  | 'submachine'
  // Pseudostates
  | 'history-shallow'
  | 'history-deep'
  | 'entry-point'
  | 'exit-point'
  | 'terminate'
  | 'junction'
  | 'fork'
  | 'join'

export interface StateShapeData extends LldShapeBase {
  stateKind: StateKind
  entryAction?: string
  exitAction?: string
  doActivity?: string
}
export type StateShape = Node<StateShapeData, 'lldState'>

// ─── activity diagram ────────────────────────────────────────────────────────

export type ActivityKind =
  | 'start'
  | 'end'
  | 'action'
  | 'decision'
  | 'merge'
  | 'fork'
  | 'join'
  // Classic flowchart primitives
  | 'data'
  | 'document'
  | 'predefined'
  | 'connector'
  | 'manual-input'
  | 'manual-operation'
  | 'delay'
  | 'or'
  | 'summing-junction'
  | 'stored-data'
  | 'internal-storage'
  | 'database'
  | 'off-page'
  | 'display'
  | 'tape'
  | 'multi-document'
  | 'preparation'
  | 'extract'
  | 'loop-limit'
  // UML activity-specific
  | 'send-signal'
  | 'receive-signal'
  | 'time-event'
  | 'object-node'
  | 'final-flow'

export interface ActivityShapeData extends LldShapeBase {
  activityKind: ActivityKind
  /** fork/join render as a bar; this picks the axis. */
  orientation?: 'horizontal' | 'vertical'
}
export type ActivityShape = Node<ActivityShapeData, 'lldActivity'>

export interface SwimlaneShapeData extends LldShapeBase {
  orientation: 'horizontal' | 'vertical'
}
export type SwimlaneShape = Node<SwimlaneShapeData, 'lldSwimlane'>

// ─── object diagram / communication diagram ──────────────────────────────────

export interface ObjectSlot {
  id: string
  name: string
  value: string
  type?: string
}

/**
 * Instance specification. UML underlines the `name : Class` header to
 * distinguish an instance from its classifier.
 */
export interface ObjectShapeData extends LldShapeBase {
  /** Blank for an anonymous instance, which UML renders as `: Class`. */
  instanceName: string
  className: string
  slots: ObjectSlot[]
  isMultiObject?: boolean
}
export type ObjectShape = Node<ObjectShapeData, 'lldObject'>

// ─── deployment diagram ──────────────────────────────────────────────────────

export type DeployNodeKind = 'device' | 'execution-environment' | 'node'

/** 3-D box. `device` is hardware; `execution-environment` is a runtime. */
export interface DeployNodeShapeData extends LldShapeBase {
  nodeKind: DeployNodeKind
  stereotype?: string
  /** e.g. "4 vCPU / 16 GB" */
  spec?: string
}
export type DeployNodeShape = Node<DeployNodeShapeData, 'lldDeployNode'>

export type ArtifactKind = 'artifact' | 'document' | 'database' | 'library' | 'executable'

/** Rectangle with the document (dog-eared page) icon in the top-right. */
export interface ArtifactShapeData extends LldShapeBase {
  artifactKind: ArtifactKind
  /** e.g. "orders-api.jar" */
  fileName?: string
}
export type ArtifactShape = Node<ArtifactShapeData, 'lldArtifact'>

// ─── component diagram ───────────────────────────────────────────────────────

/** Rectangle with the component icon; ports carry provided/required interfaces. */
export interface ComponentShapeData extends LldShapeBase {
  stereotype?: string
  ports: ModulePort[]
  /** Render the two-tab component icon rather than the «component» keyword. */
  showIcon?: boolean
}
export type ComponentShape = Node<ComponentShapeData, 'lldComponent'>

/** Lollipop (provided) or socket (required) interface. */
export interface InterfaceShapeData extends LldShapeBase {
  direction: 'provided' | 'required'
}
export type InterfaceShape = Node<InterfaceShapeData, 'lldInterface'>

// ─── component-internal diagram ──────────────────────────────────────────────

export type ModuleLayer = 'controller' | 'service' | 'repository' | 'adapter' | 'domain' | 'custom'

export type PortSide = 'top' | 'right' | 'bottom' | 'left'

export interface ModulePort {
  id: string
  name: string
  side: PortSide
  /** 0–1 along the chosen side. */
  offset: number
  direction: 'provided' | 'required'
}

export interface InternalModuleShapeData extends LldShapeBase {
  layer: ModuleLayer
  technology?: string
  ports: ModulePort[]
}
export type InternalModuleShape = Node<InternalModuleShapeData, 'lldModule'>

// ─── shared ──────────────────────────────────────────────────────────────────

export interface LldNoteShapeData extends LldShapeBase {
  text: string
}
export type LldNoteShape = Node<LldNoteShapeData, 'lldNote'>

// ─── union ───────────────────────────────────────────────────────────────────

export type LldShape =
  | ObjectShape
  | DeployNodeShape
  | ArtifactShape
  | ComponentShape
  | InterfaceShape
  | UseCaseActorShape
  | UseCaseShape
  | SystemBoundaryShape
  | LldPackageShape
  | ClassShape
  | SequenceLifelineShape
  | SequenceActivationShape
  | SequenceFragmentShape
  | ErTableShape
  | ApiEndpointShape
  | ApiSchemaShape
  | ApiAnnotationShape
  | StateShape
  | ActivityShape
  | SwimlaneShape
  | InternalModuleShape
  | LldNoteShape

export type LldShapeType = NonNullable<LldShape['type']>

export type LldShapeData = LldShape['data']

/** Narrow a shape by its `type` discriminant. */
export function isShapeOfType<T extends LldShapeType>(
  shape: LldShape,
  type: T
): shape is Extract<LldShape, { type: T }> {
  return shape.type === type
}
