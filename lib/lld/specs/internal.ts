import { spawnShape } from '../spawnShape'
import type { LldDiagramSpec } from './types'

export const internalSpec: LldDiagramSpec<'internal'> = {
  type: 'internal',
  label: 'Internals',
  description: 'Layers and ports inside this component',

  paletteGroups: [
    {
      id: 'layers',
      label: 'Layers',
      entries: [
        {
          kind: 'shape' as const,
          id: 'int-controller',
          name: 'Controller',
          description: 'Inbound request handling',
          tags: ['controller', 'handler', 'inbound'],
          spawn: { shape: 'lldModule', layer: 'controller' },
        },
        {
          kind: 'shape' as const,
          id: 'int-service',
          name: 'Service',
          description: 'Business logic',
          tags: ['service', 'logic', 'usecase'],
          spawn: { shape: 'lldModule', layer: 'service' },
        },
        {
          kind: 'shape' as const,
          id: 'int-repository',
          name: 'Repository',
          description: 'Persistence access',
          tags: ['repository', 'dao', 'persistence'],
          spawn: { shape: 'lldModule', layer: 'repository' },
        },
        {
          kind: 'shape' as const,
          id: 'int-adapter',
          name: 'Adapter',
          description: 'Outbound integration',
          tags: ['adapter', 'client', 'outbound'],
          spawn: { shape: 'lldModule', layer: 'adapter' },
        },
        {
          kind: 'shape' as const,
          id: 'int-domain',
          name: 'Domain',
          description: 'Core model, no dependencies',
          tags: ['domain', 'model', 'core'],
          spawn: { shape: 'lldModule', layer: 'domain' },
        },
        {
          kind: 'shape' as const,
          id: 'int-custom',
          name: 'Module',
          description: 'Generic sub-module',
          tags: ['module', 'component'],
          spawn: { shape: 'lldModule', layer: 'custom' },
        },
      ],
    },
    {
      id: 'annotations',
      label: 'Annotations',
      entries: [
        {
          kind: 'shape' as const,
          id: 'int-note',
          name: 'Note',
          description: 'Comment',
          tags: ['note'],
          spawn: { shape: 'lldNote' },
        },
      ],
    },
    {
      id: 'connectors',
      label: 'Dependencies',
      entries: [
        {
          kind: 'connector' as const,
          id: 'int-conn-dependency',
          name: 'Dependency',
          description: 'Dashed open arrow between layers',
          tags: ['dependency', 'uses', 'calls'],
          edgeKind: 'internal-dependency' as const,
        },
      ],
    },
  ],

  edgeKinds: ['internal-dependency'],
  defaultEdgeKind: 'internal-dependency',

  isValidConnection: ({ source, target }) =>
    source.type === 'lldModule' && target.type === 'lldModule' && source.id !== target.id,

  exporters: [],

  seed: () => {
    const controller = spawnShape({ shape: 'lldModule', layer: 'controller' }, { x: 300, y: 140 })
    const service = spawnShape({ shape: 'lldModule', layer: 'service' }, { x: 300, y: 280 })
    const repo = spawnShape({ shape: 'lldModule', layer: 'repository' }, { x: 300, y: 420 })
    return { shapes: [controller, service, repo], edges: [] }
  },
}
