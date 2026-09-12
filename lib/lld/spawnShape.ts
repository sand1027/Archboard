import { generateId, generatePrefixedId } from '@/lib/canvas/ids'
import {
  assertNever,
  type ClassStereotype,
  type FragmentOperator,
  type LldShape,
  type LldShapeType,
  type LldSpawn,
} from '@/types/lld'

/**
 * Default box per shape type. Kept in one table so palette drops, seeding and
 * click-to-add all agree on geometry.
 */
export const SHAPE_SIZE: Record<LldShapeType, { w: number; h: number }> = {
  lldObject: { w: 200, h: 116 },
  lldDeployNode: { w: 260, h: 180 },
  lldArtifact: { w: 200, h: 84 },
  lldComponent: { w: 220, h: 104 },
  lldInterface: { w: 120, h: 44 },
  lldActor: { w: 72, h: 96 },
  lldUseCase: { w: 176, h: 76 },
  lldBoundary: { w: 460, h: 340 },
  lldPackage: { w: 220, h: 160 },
  lldClass: { w: 220, h: 168 },
  lldLifeline: { w: 140, h: 420 },
  lldActivation: { w: 14, h: 120 },
  lldFragment: { w: 420, h: 220 },
  lldTable: { w: 240, h: 168 },
  lldEndpoint: { w: 260, h: 84 },
  lldSchema: { w: 240, h: 156 },
  lldAnnotation: { w: 200, h: 64 },
  lldState: { w: 168, h: 84 },
  lldActivity: { w: 168, h: 76 },
  lldSwimlane: { w: 640, h: 200 },
  lldModule: { w: 200, h: 104 },
  lldNote: { w: 180, h: 112 },
}

/** Pseudostates and flowchart markers that must stay square / fixed. */
const FIXED_SIZE: Partial<Record<string, { w: number; h: number }>> = {
  initial: { w: 32, h: 32 },
  final: { w: 32, h: 32 },
  choice: { w: 96, h: 72 },
  start: { w: 120, h: 48 },
  end: { w: 120, h: 48 },
  decision: { w: 140, h: 96 },
  merge: { w: 140, h: 96 },
  fork: { w: 200, h: 12 },
  join: { w: 200, h: 12 },
  data: { w: 168, h: 76 },
  document: { w: 168, h: 92 },
  predefined: { w: 168, h: 76 },
  connector: { w: 48, h: 48 },
  'off-page': { w: 100, h: 72 },
  'summing-junction': { w: 56, h: 56 },
  or: { w: 56, h: 56 },
  delay: { w: 140, h: 68 },
  'send-signal': { w: 152, h: 60 },
  'receive-signal': { w: 152, h: 60 },
  'time-event': { w: 56, h: 64 },
  'final-flow': { w: 36, h: 36 },
  // State machine pseudostates
  'history-shallow': { w: 34, h: 34 },
  'history-deep': { w: 34, h: 34 },
  'entry-point': { w: 24, h: 24 },
  'exit-point': { w: 24, h: 24 },
  terminate: { w: 34, h: 34 },
  junction: { w: 20, h: 20 },
  composite: { w: 300, h: 200 },
  submachine: { w: 240, h: 96 },
}

const WHITE = '#ffffff'
const SLATE = '#334155'

export function shapeSizeFor(spawn: LldSpawn): { w: number; h: number } {
  if (spawn.shape === 'lldState') return FIXED_SIZE[spawn.stateKind] ?? SHAPE_SIZE.lldState
  if (spawn.shape === 'lldActivity') return FIXED_SIZE[spawn.activityKind] ?? SHAPE_SIZE.lldActivity
  return SHAPE_SIZE[spawn.shape]
}

/**
 * Build a fully-formed LldShape from a palette spawn descriptor.
 *
 * `position` is the drop point in flow coordinates; the shape is centred on it,
 * except lifelines which hang downward from it.
 */
export function spawnShape(spawn: LldSpawn, position: { x: number; y: number }): LldShape {
  const id = generateId()
  const { w, h } = shapeSizeFor(spawn)

  // Lifelines extend downward from the drop point; everything else centres.
  const pos =
    spawn.shape === 'lldLifeline'
      ? { x: position.x - w / 2, y: position.y }
      : { x: position.x - w / 2, y: position.y - h / 2 }

  const box = { position: pos, width: w, height: h, style: { width: w, height: h } }

  switch (spawn.shape) {
    case 'lldObject':
      return {
        ...box,
        id,
        type: 'lldObject',
        connectable: true,
        zIndex: 10,
        data: {
          label: '',
          instanceName: spawn.instanceName ?? 'instance',
          className: spawn.className ?? 'Class',
          slots: [],
          isMultiObject: spawn.isMultiObject,
          fill: WHITE,
          stroke: SLATE,
        },
      }

    case 'lldDeployNode':
      return {
        ...box,
        id,
        type: 'lldDeployNode',
        connectable: true,
        // Nodes contain artifacts, so they sit behind them.
        zIndex: 1,
        data: {
          label: spawn.label ?? defaultNodeLabel(spawn.nodeKind),
          nodeKind: spawn.nodeKind,
          stereotype: spawn.stereotype,
          fill: '#F8FAFC',
          stroke: SLATE,
        },
      }

    case 'lldArtifact':
      return {
        ...box,
        id,
        type: 'lldArtifact',
        connectable: true,
        zIndex: 10,
        data: {
          label: spawn.label ?? defaultArtifactLabel(spawn.artifactKind),
          artifactKind: spawn.artifactKind,
          fill: WHITE,
          stroke: SLATE,
        },
      }

    case 'lldComponent':
      return {
        ...box,
        id,
        type: 'lldComponent',
        connectable: true,
        zIndex: 10,
        data: {
          label: spawn.label ?? 'Component',
          stereotype: spawn.stereotype,
          ports: [],
          showIcon: true,
          fill: WHITE,
          stroke: SLATE,
        },
      }

    case 'lldInterface':
      return {
        ...box,
        id,
        type: 'lldInterface',
        connectable: true,
        zIndex: 12,
        data: {
          label: spawn.label ?? 'IService',
          direction: spawn.direction,
          stroke: SLATE,
        },
      }

    case 'lldActor':
      return {
        ...box,
        id,
        type: 'lldActor',
        connectable: true,
        zIndex: 12,
        data: {
          label: spawn.label ?? (spawn.isSystem ? 'External System' : 'Actor'),
          isPrimary: spawn.isPrimary ?? !spawn.isSystem,
          isSystem: spawn.isSystem,
          stroke: SLATE,
        },
      }

    case 'lldUseCase':
      return {
        ...box,
        id,
        type: 'lldUseCase',
        connectable: true,
        zIndex: 12,
        data: {
          label: spawn.label ?? 'Use case',
          extensionPoints: [],
          isAbstract: spawn.isAbstract,
          fill: WHITE,
          stroke: SLATE,
        },
      }

    case 'lldBoundary':
      return {
        ...box,
        id,
        type: 'lldBoundary',
        connectable: false,
        // Behind use cases so it reads as the subject frame.
        zIndex: 0,
        data: {
          label: spawn.label ?? 'System',
          stereotype: spawn.stereotype,
          fill: 'transparent',
          stroke: SLATE,
        },
      }

    case 'lldPackage':
      return {
        ...box,
        id,
        type: 'lldPackage',
        connectable: true,
        zIndex: 1,
        data: {
          label: spawn.label ?? 'package',
          fill: 'transparent',
          stroke: SLATE,
        },
      }

    case 'lldClass': {
      const isEnum = spawn.stereotype === 'enum'
      return {
        ...box,
        id,
        type: 'lldClass',
        connectable: true,
        zIndex: 10,
        data: {
          label: spawn.name ?? defaultClassName(spawn.stereotype),
          stereotype: spawn.stereotype,
          fields: isEnum
            ? []
            : [
                {
                  id: generatePrefixedId('f'),
                  name: 'id',
                  type: 'string',
                  visibility: 'private',
                },
              ],
          methods:
            isEnum || spawn.stereotype === 'struct'
              ? []
              : [
                  {
                    id: generatePrefixedId('m'),
                    name: 'execute',
                    params: [],
                    returnType: 'void',
                    visibility: 'public',
                    isAbstract: spawn.stereotype === 'abstract' || undefined,
                  },
                ],
          enumValues: isEnum ? ['ACTIVE', 'INACTIVE'] : [],
          fill: WHITE,
          stroke: SLATE,
        },
      }
    }

    case 'lldLifeline':
      return {
        ...box,
        id,
        type: 'lldLifeline',
        connectable: true,
        zIndex: 10,
        data: {
          label: spawn.label ?? 'Participant',
          lifelineKind: spawn.lifelineKind,
          fill: WHITE,
          stroke: SLATE,
        },
      }

    case 'lldActivation':
      return {
        ...box,
        id,
        type: 'lldActivation',
        connectable: false,
        zIndex: 12,
        data: { label: '', fill: '#E2E8F0', stroke: '#64748B' },
      }

    case 'lldFragment':
      return {
        ...box,
        id,
        type: 'lldFragment',
        connectable: false,
        selectable: true,
        // Below lifelines so it reads as a background frame.
        zIndex: 1,
        data: {
          label: '',
          operator: spawn.operator,
          operands:
            spawn.operator === 'alt'
              ? [
                  { id: generatePrefixedId('op'), guard: 'condition' },
                  { id: generatePrefixedId('op'), guard: 'else' },
                ]
              : [{ id: generatePrefixedId('op'), guard: guardFor(spawn.operator) }],
          fill: 'transparent',
          stroke: SLATE,
        },
      }

    case 'lldTable':
      return {
        ...box,
        id,
        type: 'lldTable',
        connectable: true,
        zIndex: 10,
        data: {
          label: spawn.name ?? (spawn.tableKind === 'view' ? 'my_view' : 'my_table'),
          tableKind: spawn.tableKind,
          columns: [
            { id: generatePrefixedId('c'), name: 'id', type: 'uuid', isPk: true },
            { id: generatePrefixedId('c'), name: 'created_at', type: 'timestamptz' },
          ],
          indexes: [],
          fill: WHITE,
          stroke: SLATE,
        },
      }

    case 'lldEndpoint':
      return {
        ...box,
        id,
        type: 'lldEndpoint',
        connectable: true,
        zIndex: 10,
        data: {
          label: '',
          method: spawn.method,
          path: spawn.path ?? '/resource',
          fill: WHITE,
          stroke: SLATE,
        },
      }

    case 'lldSchema':
      return {
        ...box,
        id,
        type: 'lldSchema',
        connectable: true,
        zIndex: 10,
        data: {
          label: spawn.role === 'request' ? 'Request' : `Response ${spawn.statusCode ?? 200}`,
          role: spawn.role,
          statusCode: spawn.role === 'response' ? (spawn.statusCode ?? 200) : undefined,
          contentType: 'application/json',
          fields: [
            { id: generatePrefixedId('sf'), name: 'id', type: 'string', required: true },
          ],
          fill: WHITE,
          stroke: SLATE,
        },
      }

    case 'lldAnnotation':
      return {
        ...box,
        id,
        type: 'lldAnnotation',
        connectable: true,
        zIndex: 10,
        data: {
          label: annotationLabel(spawn.annotationKind),
          annotationKind: spawn.annotationKind,
          detail: spawn.detail ?? annotationDetail(spawn.annotationKind),
          fill: '#FFFBEB',
          stroke: '#D97706',
        },
      }

    case 'lldState':
      return {
        ...box,
        id,
        type: 'lldState',
        connectable: true,
        zIndex: 10,
        data: {
          label: spawn.label ?? defaultStateLabel(spawn.stateKind),
          stateKind: spawn.stateKind,
          fill: WHITE,
          stroke: SLATE,
        },
      }

    case 'lldActivity':
      return {
        ...box,
        id,
        type: 'lldActivity',
        connectable: true,
        zIndex: 10,
        data: {
          label: spawn.label ?? defaultActivityLabel(spawn.activityKind),
          activityKind: spawn.activityKind,
          orientation: 'horizontal',
          fill: WHITE,
          stroke: SLATE,
        },
      }

    case 'lldSwimlane':
      return {
        ...box,
        id,
        type: 'lldSwimlane',
        connectable: false,
        zIndex: 0,
        data: {
          label: 'Lane',
          orientation: spawn.orientation,
          fill: 'transparent',
          stroke: '#CBD5E1',
        },
      }

    case 'lldModule':
      return {
        ...box,
        id,
        type: 'lldModule',
        connectable: true,
        zIndex: 10,
        data: {
          label: spawn.label ?? defaultModuleLabel(spawn.layer),
          layer: spawn.layer,
          ports: [],
          fill: WHITE,
          stroke: SLATE,
        },
      }

    case 'lldNote':
      return {
        ...box,
        id,
        type: 'lldNote',
        connectable: false,
        zIndex: 20,
        data: {
          label: 'Note',
          text: '',
          fill: '#FFFBEB',
          stroke: '#D97706',
        },
      }

    default:
      return assertNever(spawn)
  }
}

// ─── defaults ────────────────────────────────────────────────────────────────

function defaultClassName(s: ClassStereotype): string {
  switch (s) {
    case 'interface':
      return 'IService'
    case 'abstract':
      return 'BaseEntity'
    case 'enum':
      return 'Status'
    case 'struct':
      return 'Point'
    default:
      return 'ClassName'
  }
}

function guardFor(op: FragmentOperator): string {
  if (op === 'loop') return 'while condition'
  if (op === 'opt') return 'condition'
  if (op === 'critical') return 'atomic'
  if (op === 'ref') return 'interaction'
  return ''
}

function annotationLabel(k: string): string {
  switch (k) {
    case 'auth':
      return 'Auth'
    case 'rate-limit':
      return 'Rate limit'
    case 'cache':
      return 'Cache'
    default:
      return 'Middleware'
  }
}

function annotationDetail(k: string): string {
  switch (k) {
    case 'auth':
      return 'requires JWT'
    case 'rate-limit':
      return '100 req/min'
    case 'cache':
      return 'TTL 60s'
    default:
      return 'request logging'
  }
}

function defaultNodeLabel(k: string): string {
  if (k === 'device') return 'Device'
  if (k === 'execution-environment') return 'Runtime'
  return 'Node'
}

function defaultArtifactLabel(k: string): string {
  switch (k) {
    case 'document':
      return 'document.pdf'
    case 'database':
      return 'schema.sql'
    case 'library':
      return 'lib.so'
    case 'executable':
      return 'service.jar'
    default:
      return 'artifact'
  }
}

function defaultStateLabel(k: string): string {
  if (k === 'initial') return ''
  if (k === 'final') return ''
  if (k === 'choice') return ''
  if (k === 'junction' || k === 'terminate') return ''
  if (k === 'history-shallow') return 'H'
  if (k === 'history-deep') return 'H*'
  if (k === 'entry-point' || k === 'exit-point') return ''
  if (k === 'fork' || k === 'join') return ''
  if (k === 'composite') return 'Composite state'
  if (k === 'submachine') return 'Submachine'
  return 'State'
}

function defaultActivityLabel(k: string): string {
  switch (k) {
    case 'start':
      return 'Start'
    case 'end':
      return 'End'
    case 'data':
      return 'Input'
    case 'document':
      return 'Document'
    case 'predefined':
      return 'Subroutine'
    case 'connector':
      return 'A'
    case 'off-page':
      return 'A'
    case 'manual-input':
      return 'Manual input'
    case 'manual-operation':
      return 'Manual step'
    case 'delay':
      return 'Wait'
    case 'or':
      return ''
    case 'summing-junction':
      return ''
    case 'stored-data':
      return 'Stored data'
    case 'internal-storage':
      return 'Storage'
    case 'database':
      return 'Database'
    case 'display':
      return 'Display'
    case 'tape':
      return 'Sequential data'
    case 'multi-document':
      return 'Documents'
    case 'preparation':
      return 'Prepare'
    case 'extract':
      return 'Extract'
    case 'loop-limit':
      return 'Loop'
    case 'send-signal':
      return 'Send signal'
    case 'receive-signal':
      return 'Receive signal'
    case 'time-event':
      return 'After 5s'
    case 'object-node':
      return 'Object'
    case 'final-flow':
      return ''
    case 'decision':
      return 'Condition?'
    case 'merge':
      return ''
    case 'fork':
    case 'join':
      return ''
    default:
      return 'Action'
  }
}

function defaultModuleLabel(layer: string): string {
  switch (layer) {
    case 'controller':
      return 'Controller'
    case 'service':
      return 'Service'
    case 'repository':
      return 'Repository'
    case 'adapter':
      return 'Adapter'
    case 'domain':
      return 'Domain'
    default:
      return 'Module'
  }
}
