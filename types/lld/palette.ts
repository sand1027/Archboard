// Palette entries.
//
// A palette holds two kinds of thing, so it is a discriminated union rather
// than a shape-only list: droppable shapes, and connector presets that arm the
// next connection you draw. Notation is only "correct" if the user can pick the
// relationship, so the connector legend has to be part of the palette.

import type { LldEdgeKind } from './edges'
import type {
  ActivityKind,
  AnnotationKind,
  ArtifactKind,
  DeployNodeKind,
  ClassStereotype,
  FragmentOperator,
  HttpMethod,
  ModuleLayer,
  SequenceLifelineKind,
  StateKind,
} from './shapes'

export type LldSpawn =
  | { shape: 'lldActor'; isPrimary?: boolean; isSystem?: boolean; label?: string }
  | { shape: 'lldUseCase'; label?: string; isAbstract?: boolean }
  | { shape: 'lldBoundary'; label?: string; stereotype?: string }
  | { shape: 'lldPackage'; label?: string }
  | { shape: 'lldObject'; className?: string; instanceName?: string; isMultiObject?: boolean }
  | { shape: 'lldDeployNode'; nodeKind: DeployNodeKind; label?: string; stereotype?: string }
  | { shape: 'lldArtifact'; artifactKind: ArtifactKind; label?: string }
  | { shape: 'lldComponent'; label?: string; stereotype?: string }
  | { shape: 'lldInterface'; direction: 'provided' | 'required'; label?: string }
  | { shape: 'lldClass'; stereotype: ClassStereotype; name?: string }
  | { shape: 'lldLifeline'; lifelineKind: SequenceLifelineKind; label?: string }
  | { shape: 'lldActivation' }
  | { shape: 'lldFragment'; operator: FragmentOperator }
  | { shape: 'lldTable'; tableKind: 'table' | 'view'; name?: string }
  | { shape: 'lldEndpoint'; method: HttpMethod; path?: string }
  | { shape: 'lldSchema'; role: 'request' | 'response'; statusCode?: number }
  | { shape: 'lldAnnotation'; annotationKind: AnnotationKind; detail?: string }
  | { shape: 'lldState'; stateKind: StateKind; label?: string }
  | { shape: 'lldActivity'; activityKind: ActivityKind; label?: string }
  | { shape: 'lldSwimlane'; orientation: 'horizontal' | 'vertical' }
  | { shape: 'lldModule'; layer: ModuleLayer; label?: string }
  | { shape: 'lldNote' }

interface PaletteEntryBase {
  id: string
  name: string
  description: string
  tags: string[]
}

export interface LldShapeEntry extends PaletteEntryBase {
  kind: 'shape'
  spawn: LldSpawn
}

export interface LldConnectorEntry extends PaletteEntryBase {
  kind: 'connector'
  edgeKind: LldEdgeKind
}

export type LldPaletteEntry = LldShapeEntry | LldConnectorEntry

export interface LldPaletteGroup {
  id: string
  label: string
  /** Connector groups render as a notation legend rather than a shape grid. */
  entries: LldPaletteEntry[]
}

export function isShapeEntry(entry: LldPaletteEntry): entry is LldShapeEntry {
  return entry.kind === 'shape'
}

export function isConnectorEntry(entry: LldPaletteEntry): entry is LldConnectorEntry {
  return entry.kind === 'connector'
}
