import { spawnShape } from '../spawnShape'
import { LIFELINE_PITCH, LIFELINE_TOP } from '../sequenceLayout'
import { toMermaidSequence } from '@/lib/export/lld/mermaidSequence'
import { generateId } from '@/lib/canvas/ids'
import type { LldEdge, LldShape } from '@/types/lld'
import type { LldDiagramSpec } from './types'

export const sequenceSpec: LldDiagramSpec<'sequence'> = {
  type: 'sequence',
  label: 'Seq',
  description: 'Ordered messages between participants',

  paletteGroups: [
    {
      id: 'participants',
      label: 'Participants',
      entries: [
        {
          kind: 'shape',
          id: 'seq-actor',
          name: 'Actor',
          description: 'Stick figure with a dashed lifeline',
          tags: ['actor', 'user', 'external', 'stick figure'],
          spawn: { shape: 'lldLifeline', lifelineKind: 'actor', label: 'User' },
        },
        {
          kind: 'shape',
          id: 'seq-participant',
          name: 'Participant',
          description: 'Box plus dashed vertical lifeline',
          tags: ['participant', 'object', 'lifeline'],
          spawn: { shape: 'lldLifeline', lifelineKind: 'participant' },
        },
        {
          kind: 'shape',
          id: 'seq-boundary',
          name: 'Boundary',
          description: 'UI or system edge',
          tags: ['boundary', 'ui'],
          spawn: { shape: 'lldLifeline', lifelineKind: 'boundary', label: 'Boundary' },
        },
        {
          kind: 'shape',
          id: 'seq-control',
          name: 'Control',
          description: 'Coordinating controller',
          tags: ['control', 'controller'],
          spawn: { shape: 'lldLifeline', lifelineKind: 'control', label: 'Controller' },
        },
        {
          kind: 'shape',
          id: 'seq-entity',
          name: 'Entity',
          description: 'Domain entity or store',
          tags: ['entity', 'model', 'store'],
          spawn: { shape: 'lldLifeline', lifelineKind: 'entity', label: 'Entity' },
        },
        {
          kind: 'shape',
          id: 'seq-activation',
          name: 'Activation bar',
          description: 'Execution occurrence on a lifeline',
          tags: ['activation', 'bar', 'execution', 'focus'],
          spawn: { shape: 'lldActivation' },
        },
      ],
    },
    {
      id: 'fragments',
      label: 'Combined fragments',
      entries: [
        {
          kind: 'shape',
          id: 'seq-alt',
          name: 'alt',
          description: 'Alternative branches',
          tags: ['alt', 'if', 'else', 'branch'],
          spawn: { shape: 'lldFragment', operator: 'alt' },
        },
        {
          kind: 'shape',
          id: 'seq-opt',
          name: 'opt',
          description: 'Optional block',
          tags: ['opt', 'optional'],
          spawn: { shape: 'lldFragment', operator: 'opt' },
        },
        {
          kind: 'shape',
          id: 'seq-loop',
          name: 'loop',
          description: 'Repeated block',
          tags: ['loop', 'while', 'for', 'repeat'],
          spawn: { shape: 'lldFragment', operator: 'loop' },
        },
        {
          kind: 'shape',
          id: 'seq-par',
          name: 'par',
          description: 'Parallel block',
          tags: ['par', 'parallel', 'concurrent'],
          spawn: { shape: 'lldFragment', operator: 'par' },
        },
      ],
    },
    {
      id: 'connectors',
      label: 'Messages',
      entries: [
        {
          kind: 'connector',
          id: 'seq-conn-sync',
          name: 'Synchronous call',
          description: 'Solid line, filled arrowhead',
          tags: ['sync', 'call', 'request'],
          edgeKind: 'msg-sync',
        },
        {
          kind: 'connector',
          id: 'seq-conn-async',
          name: 'Asynchronous call',
          description: 'Solid line, open arrowhead',
          tags: ['async', 'signal', 'event'],
          edgeKind: 'msg-async',
        },
        {
          kind: 'connector',
          id: 'seq-conn-return',
          name: 'Return',
          description: 'Dashed line, open arrowhead',
          tags: ['return', 'reply', 'response'],
          edgeKind: 'msg-return',
        },
        {
          kind: 'connector',
          id: 'seq-conn-create',
          name: 'Create',
          description: '«create» — brings a participant into existence',
          tags: ['create', 'new', 'instantiate'],
          edgeKind: 'msg-create',
        },
        {
          kind: 'connector',
          id: 'seq-conn-destroy',
          name: 'Destroy',
          description: '«destroy» — terminates a lifeline with an X',
          tags: ['destroy', 'delete', 'terminate'],
          edgeKind: 'msg-destroy',
        },
      ],
    },
  ],

  edgeKinds: ['msg-sync', 'msg-async', 'msg-return', 'msg-create', 'msg-destroy'],
  defaultEdgeKind: 'msg-sync',

  // Self-calls are legal, so no source !== target guard.
  isValidConnection: ({ source, target }) =>
    source.type === 'lldLifeline' && target.type === 'lldLifeline',

  exporters: [
    {
      id: 'mermaid-sequence',
      label: 'Mermaid',
      description: 'sequenceDiagram syntax',
      extension: 'mmd',
      serialize: toMermaidSequence,
    },
  ],

  seed: ({ component, connected }) => {
    const shapes: LldShape[] = []
    const edges: LldEdge[] = []

    const self = spawnShape(
      {
        shape: 'lldLifeline',
        lifelineKind: 'control',
        label: component ? String(component.data.label ?? 'Component') : 'System',
      },
      { x: 200, y: LIFELINE_TOP }
    )
    shapes.push(self)

    connected.forEach((peer, i) => {
      const lifeline = spawnShape(
        {
          shape: 'lldLifeline',
          lifelineKind: peerKind(String(peer.data.category ?? '')),
          label: String(peer.data.label ?? `Peer ${i + 1}`),
        },
        { x: 200 + LIFELINE_PITCH * (i + 1), y: LIFELINE_TOP }
      )
      shapes.push(lifeline)

      edges.push({
        id: generateId(),
        type: 'lldSequenceMessage',
        source: self.id,
        target: lifeline.id,
        data: { kind: 'msg-sync', order: i, label: 'request' },
      })
    })

    return { shapes, edges }
  },
}

function peerKind(category: string): 'actor' | 'entity' | 'participant' {
  if (category === 'clients' || category === 'actors') return 'actor'
  if (category === 'databases' || category === 'storage' || category === 'caching') return 'entity'
  return 'participant'
}
