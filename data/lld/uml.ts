import type { LldCatalogItem } from '@/types/lld'

export const umlItems: LldCatalogItem[] = [
  {
    id: 'uml-class',
    name: 'Class',
    description: 'UML class with attributes & methods',
    tab: 'uml',
    tags: ['class', 'uml', 'oop'],
    spawn: { kind: 'umlClass', stereotype: 'class', name: 'ClassName' },
  },
  {
    id: 'uml-interface',
    name: 'Interface',
    description: 'UML interface',
    tab: 'uml',
    tags: ['interface', 'uml'],
    spawn: { kind: 'umlClass', stereotype: 'interface', name: 'IService' },
  },
  {
    id: 'uml-enum',
    name: 'Enum',
    description: 'Enumeration type',
    tab: 'uml',
    tags: ['enum', 'uml'],
    spawn: { kind: 'umlClass', stereotype: 'enum', name: 'Status' },
  },
  {
    id: 'uml-abstract',
    name: 'Abstract Class',
    description: 'Abstract base class',
    tab: 'uml',
    tags: ['abstract', 'uml'],
    spawn: { kind: 'umlClass', stereotype: 'abstract', name: 'BaseEntity' },
  },
  {
    id: 'uml-package',
    name: 'Package',
    description: 'Package / namespace',
    tab: 'uml',
    tags: ['package', 'namespace'],
    spawn: { kind: 'umlClass', stereotype: 'package', name: 'domain' },
  },
  {
    id: 'uml-note',
    name: 'UML Note',
    description: 'Comment note',
    tab: 'uml',
    tags: ['note'],
    spawn: { kind: 'note', label: 'Note' },
  },
]
