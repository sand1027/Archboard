import type {
  LldDiagram,
  LldDiagramType,
  LldEdgeKind,
  LldPaletteGroup,
  LldShape,
} from '@/types/lld'
import type { ArchitectureNode } from '@/types/diagram'

export interface ConnectionContext {
  source: LldShape
  target: LldShape
  sourceHandle: string | null
  targetHandle: string | null
  diagram: LldDiagram
}

export interface ExportContext {
  diagramName: string
  /** Workspace title — the component label when attached. */
  title: string
}

export interface LldExporterDescriptor {
  id: string
  label: string
  description: string
  extension: 'mmd' | 'puml' | 'sql' | 'json'
  serialize: (diagram: LldDiagram, ctx: ExportContext) => string
}

export interface SeedContext {
  /** Absent for the standalone LLD board, which is attached to nothing. */
  component?: ArchitectureNode
  /** HLD nodes directly connected to `component`, in edge order. */
  connected: ArchitectureNode[]
}

export type SeedResult = Pick<LldDiagram, 'shapes' | 'edges'>

/**
 * Everything that varies between diagram types, in one place.
 *
 * One canvas component and one palette component read this, which is what keeps
 * seven diagram types from becoming seven copies of the editor.
 */
export interface LldDiagramSpec<T extends LldDiagramType = LldDiagramType> {
  type: T
  label: string
  description: string
  paletteGroups: LldPaletteGroup[]
  /** Populates the edge-kind dropdown in the inspector. */
  edgeKinds: LldEdgeKind[]
  defaultEdgeKind: LldEdgeKind
  isValidConnection: (ctx: ConnectionContext) => boolean
  exporters: LldExporterDescriptor[]
  seed: (ctx: SeedContext) => SeedResult
}

export const NO_SEED: SeedResult = { shapes: [], edges: [] }
