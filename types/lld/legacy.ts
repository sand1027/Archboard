// Legacy LLD node data types.
//
// Retained because the global board and data/templates still contain umlClass /
// umlEntity / umlLifeline / icon nodes. Superseded by types/lld/shapes.ts; these
// go away with the one-time node migration.

export type BoardMode = 'hld' | 'lld'

export type RelationKind =
  | 'association'
  | 'inheritance'
  | 'composition'
  | 'aggregation'
  | 'dependency'
  | 'realization'
  | 'one-to-one'
  | 'one-to-many'
  | 'many-to-many'
  | 'message-sync'
  | 'message-async'
  | 'message-return'

export type UmlClassStereotype = 'class' | 'interface' | 'enum' | 'abstract' | 'package'

export interface UmlClassNodeData extends Record<string, unknown> {
  name: string
  stereotype?: UmlClassStereotype
  attributes: string[]
  methods: string[]
  isAbstract?: boolean
  fill?: string
  stroke?: string
  width?: number
  height?: number
}

export type EntityAttrKind = 'pk' | 'fk' | 'attr'

export interface EntityAttribute {
  name: string
  type?: string
  kind: EntityAttrKind
}

export interface UmlEntityNodeData extends Record<string, unknown> {
  name: string
  weak?: boolean
  attributes: EntityAttribute[]
  fill?: string
  stroke?: string
  width?: number
  height?: number
}

export type LifelineKind = 'actor' | 'object' | 'boundary' | 'control' | 'entity'

export interface UmlLifelineNodeData extends Record<string, unknown> {
  label: string
  kind: LifelineKind
  /** Vertical extent of the dashed life line below the head */
  lifeHeight?: number
  /** Activation bars as [startY, endY] in node-local coords */
  activations?: Array<{ start: number; end: number }>
  fill?: string
  stroke?: string
  width?: number
  height?: number
}

export interface IconNodeData extends Record<string, unknown> {
  label: string
  /** Lucide icon name key */
  iconName: string
  color?: string
  fill?: string
  stroke?: string
  width?: number
  height?: number
}

