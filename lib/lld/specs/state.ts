import { spawnShape } from '../spawnShape'
import { toMermaidState } from '@/lib/export/lld/mermaidState'
import { generateId } from '@/lib/canvas/ids'
import type { LldDiagramSpec } from './types'

export const stateSpec: LldDiagramSpec<'state'> = {
  type: 'state',
  label: 'State',
  description: 'States and event-driven transitions',

  paletteGroups: [
    {
      id: 'states',
      label: 'States',
      entries: [
        {
          kind: 'shape' as const,
          id: 'st-initial',
          name: 'Initial',
          description: 'Entry pseudo-state',
          tags: ['initial', 'start', 'entry'],
          spawn: { shape: 'lldState', stateKind: 'initial' },
        },
        {
          kind: 'shape' as const,
          id: 'st-state',
          name: 'State',
          description: 'Named state with entry/exit actions',
          tags: ['state', 'status'],
          spawn: { shape: 'lldState', stateKind: 'state' },
        },
        {
          kind: 'shape' as const,
          id: 'st-choice',
          name: 'Choice',
          description: 'Guarded branch point',
          tags: ['choice', 'decision', 'branch'],
          spawn: { shape: 'lldState', stateKind: 'choice' },
        },
        {
          kind: 'shape' as const,
          id: 'st-composite',
          name: 'Composite state',
          description: 'State containing nested substates',
          tags: ['composite', 'nested', 'substate', 'region'],
          spawn: { shape: 'lldState', stateKind: 'composite' },
        },
        {
          kind: 'shape' as const,
          id: 'st-submachine',
          name: 'Submachine',
          description: 'Reference to another state machine',
          tags: ['submachine', 'reference', 'include'],
          spawn: { shape: 'lldState', stateKind: 'submachine' },
        },
        {
          kind: 'shape' as const,
          id: 'st-final',
          name: 'Final',
          description: 'Terminal state',
          tags: ['final', 'end', 'terminal'],
          spawn: { shape: 'lldState', stateKind: 'final' },
        },
      ],
    },
    {
      id: 'pseudostates',
      label: 'Pseudostates',
      entries: [
        {
          kind: 'shape' as const,
          id: 'st-history-shallow',
          name: 'Shallow history',
          description: 'H — resumes the last active substate',
          tags: ['history', 'shallow', 'resume', 'H'],
          spawn: { shape: 'lldState', stateKind: 'history-shallow' },
        },
        {
          kind: 'shape' as const,
          id: 'st-history-deep',
          name: 'Deep history',
          description: 'H* — resumes the full nested configuration',
          tags: ['history', 'deep', 'resume'],
          spawn: { shape: 'lldState', stateKind: 'history-deep' },
        },
        {
          kind: 'shape' as const,
          id: 'st-junction',
          name: 'Junction',
          description: 'Merges or splits transition paths',
          tags: ['junction', 'merge', 'split'],
          spawn: { shape: 'lldState', stateKind: 'junction' },
        },
        {
          kind: 'shape' as const,
          id: 'st-fork',
          name: 'Fork',
          description: 'Splits into concurrent regions',
          tags: ['fork', 'concurrent', 'split', 'bar'],
          spawn: { shape: 'lldState', stateKind: 'fork' },
        },
        {
          kind: 'shape' as const,
          id: 'st-join',
          name: 'Join',
          description: 'Synchronises concurrent regions',
          tags: ['join', 'sync', 'bar'],
          spawn: { shape: 'lldState', stateKind: 'join' },
        },
        {
          kind: 'shape' as const,
          id: 'st-entry-point',
          name: 'Entry point',
          description: 'Named entry on a composite state boundary',
          tags: ['entry', 'point', 'boundary'],
          spawn: { shape: 'lldState', stateKind: 'entry-point' },
        },
        {
          kind: 'shape' as const,
          id: 'st-exit-point',
          name: 'Exit point',
          description: 'Named exit on a composite state boundary',
          tags: ['exit', 'point', 'boundary'],
          spawn: { shape: 'lldState', stateKind: 'exit-point' },
        },
        {
          kind: 'shape' as const,
          id: 'st-terminate',
          name: 'Terminate',
          description: 'X — the state machine ends its own life',
          tags: ['terminate', 'kill', 'stop'],
          spawn: { shape: 'lldState', stateKind: 'terminate' },
        },
      ],
    },
    {
      id: 'annotations',
      label: 'Annotations',
      entries: [
        {
          kind: 'shape' as const,
          id: 'st-note',
          name: 'Note',
          description: 'Comment',
          tags: ['note'],
          spawn: { shape: 'lldNote' },
        },
      ],
    },
    {
      id: 'connectors',
      label: 'Transitions',
      entries: [
        {
          kind: 'connector' as const,
          id: 'st-conn-transition',
          name: 'Transition',
          description: 'Labelled event [guard] / action',
          tags: ['transition', 'event', 'guard'],
          edgeKind: 'state-transition' as const,
        },
      ],
    },
  ],

  edgeKinds: ['state-transition'],
  defaultEdgeKind: 'state-transition',

  isValidConnection: ({ source, target }) =>
    source.type === 'lldState' && target.type === 'lldState',

  exporters: [
    {
      id: 'mermaid-state',
      label: 'Mermaid',
      description: 'stateDiagram-v2 syntax',
      extension: 'mmd',
      serialize: toMermaidState,
    },
  ],

  seed: () => {
    const initial = spawnShape({ shape: 'lldState', stateKind: 'initial' }, { x: 260, y: 160 })
    const idle = spawnShape(
      { shape: 'lldState', stateKind: 'state', label: 'Idle' },
      { x: 260, y: 260 }
    )
    return {
      shapes: [initial, idle],
      edges: [
        {
          id: generateId(),
          type: 'lldStateTransition',
          source: initial.id,
          target: idle.id,
          data: { kind: 'state-transition' },
        },
      ],
    }
  },
}
