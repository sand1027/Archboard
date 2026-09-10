import type { LldCatalogItem } from '@/types/lld'

export const sequenceItems: LldCatalogItem[] = [
  {
    id: 'seq-actor',
    name: 'Actor',
    description: 'Sequence diagram actor',
    tab: 'sequence',
    tags: ['actor', 'user', 'sequence'],
    spawn: { kind: 'umlLifeline', lifelineKind: 'actor', label: 'Actor' },
  },
  {
    id: 'seq-object',
    name: 'Object',
    description: 'Object / participant lifeline',
    tab: 'sequence',
    tags: ['object', 'lifeline', 'sequence'],
    spawn: { kind: 'umlLifeline', lifelineKind: 'object', label: 'Object' },
  },
  {
    id: 'seq-boundary',
    name: 'Boundary',
    description: 'Boundary stereotype',
    tab: 'sequence',
    tags: ['boundary', 'ui'],
    spawn: { kind: 'umlLifeline', lifelineKind: 'boundary', label: 'Boundary' },
  },
  {
    id: 'seq-control',
    name: 'Control',
    description: 'Control stereotype',
    tab: 'sequence',
    tags: ['control', 'controller'],
    spawn: { kind: 'umlLifeline', lifelineKind: 'control', label: 'Control' },
  },
  {
    id: 'seq-entity',
    name: 'Entity',
    description: 'Entity stereotype',
    tab: 'sequence',
    tags: ['entity', 'model'],
    spawn: { kind: 'umlLifeline', lifelineKind: 'entity', label: 'Entity' },
  },
]
