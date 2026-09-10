// Low-level design (LLD) node and catalog types

export type BoardMode = 'hld' | 'lld'

export type LldLibraryTab = 'flowchart' | 'uml' | 'er' | 'sequence' | 'icons'

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

export interface LldCatalogItem {
  id: string
  name: string
  description: string
  tab: LldLibraryTab
  tags: string[]
  /** How to spawn the node on drop / click */
  spawn:
    | { kind: 'shape'; shapeType: string; defaultLabel?: string; w?: number; h?: number }
    | { kind: 'umlClass'; stereotype?: UmlClassStereotype; name?: string }
    | { kind: 'umlEntity'; weak?: boolean; name?: string }
    | { kind: 'umlLifeline'; lifelineKind: LifelineKind; label?: string }
    | { kind: 'icon'; iconName: string; label?: string }
    | { kind: 'note'; label?: string }
}
