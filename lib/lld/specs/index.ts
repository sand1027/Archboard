import {
  isShapeEntry,
  type LldDiagramType,
  type LldEdgeKind,
  type LldEdgeType,
  type LldPaletteEntry,
  type LldShapeEntry,
} from '@/types/lld'
import type { LldDiagramSpec } from './types'
import { usecaseSpec } from './usecase'
import {
  communicationSpec,
  componentSpec,
  deploymentSpec,
  objectSpec,
  packageSpec,
} from './structural'
import { classSpec } from './class'
import { sequenceSpec } from './sequence'
import { erSpec } from './er'
import { apiSpec } from './api'
import { stateSpec } from './state'
import { activitySpec } from './activity'
import { internalSpec } from './internal'

export type * from './types'

/**
 * The mapped type makes a missing diagram type a compile error, so the registry
 * cannot drift from LldDiagramType.
 */
export const LLD_DIAGRAM_SPECS: { [K in LldDiagramType]: LldDiagramSpec<K> } = {
  usecase: usecaseSpec,
  class: classSpec,
  object: objectSpec,
  package: packageSpec,
  component: componentSpec,
  deployment: deploymentSpec,
  communication: communicationSpec,
  sequence: sequenceSpec,
  er: erSpec,
  api: apiSpec,
  state: stateSpec,
  activity: activitySpec,
  internal: internalSpec,
}

export function getSpec<T extends LldDiagramType>(type: T): LldDiagramSpec<T> {
  return LLD_DIAGRAM_SPECS[type]
}

/** Flattened palette entries for a diagram type, for search. */
export function paletteEntriesFor(type: LldDiagramType): LldPaletteEntry[] {
  return LLD_DIAGRAM_SPECS[type].paletteGroups.flatMap((g) => g.entries)
}

/** Shape entries only — what a drag payload can resolve to. */
export function paletteShapesFor(type: LldDiagramType): LldShapeEntry[] {
  return paletteEntriesFor(type).filter(isShapeEntry)
}

export function findPaletteShape(
  type: LldDiagramType,
  entryId: string
): LldShapeEntry | undefined {
  return paletteShapesFor(type).find((i) => i.id === entryId)
}

export function searchPalette(type: LldDiagramType, query: string): LldPaletteEntry[] | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  return paletteEntriesFor(type).filter(
    (i) =>
      i.name.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.tags.some((t) => t.toLowerCase().includes(q))
  )
}

/** React Flow edge `type` that carries a given edge kind. */
export function edgeTypeForKind(kind: LldEdgeKind): LldEdgeType {
  switch (kind) {
    case 'obj-link':
      return 'lldObjectLink'
    case 'comm-message':
      return 'lldCommMessage'
    case 'deploy-communication':
    case 'deploy-deployment':
    case 'deploy-manifest':
      return 'lldDeploymentRelation'
    case 'comp-assembly':
    case 'comp-delegation':
    case 'comp-dependency':
      return 'lldComponentRelation'
    case 'pkg-import':
    case 'pkg-merge':
    case 'pkg-nesting':
      return 'lldPackageRelation'
    case 'uc-association':
    case 'uc-include':
    case 'uc-extend':
    case 'uc-generalization':
    case 'uc-dependency':
      return 'lldUseCaseRelation'
    case 'inheritance':
    case 'realization':
    case 'composition':
    case 'aggregation':
    case 'association':
    case 'dependency':
      return 'lldClassRelation'
    case 'msg-sync':
    case 'msg-async':
    case 'msg-return':
    case 'msg-create':
    case 'msg-destroy':
      return 'lldSequenceMessage'
    case 'er-one-to-one':
    case 'er-one-to-many':
    case 'er-many-to-many':
    case 'er-fk-ref':
      return 'lldErRelation'
    case 'api-request':
    case 'api-response':
    case 'api-annotation':
      return 'lldApiLink'
    case 'state-transition':
      return 'lldStateTransition'
    case 'activity-flow':
      return 'lldActivityFlow'
    case 'internal-dependency':
      return 'lldInternalDependency'
  }
}
