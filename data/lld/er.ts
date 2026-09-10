import type { LldCatalogItem } from '@/types/lld'

export const erItems: LldCatalogItem[] = [
  {
    id: 'er-entity',
    name: 'Entity',
    description: 'ER entity with attributes',
    tab: 'er',
    tags: ['entity', 'table', 'er'],
    spawn: { kind: 'umlEntity', name: 'Entity' },
  },
  {
    id: 'er-weak',
    name: 'Weak Entity',
    description: 'Weak entity (double border)',
    tab: 'er',
    tags: ['weak', 'entity'],
    spawn: { kind: 'umlEntity', weak: true, name: 'WeakEntity' },
  },
  {
    id: 'er-relationship',
    name: 'Relationship',
    description: 'Relationship diamond',
    tab: 'er',
    tags: ['relationship', 'diamond'],
    spawn: { kind: 'shape', shapeType: 'diamond', defaultLabel: 'relates', w: 120, h: 80 },
  },
]
