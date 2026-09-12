import { spawnShape } from '../spawnShape'
import { toPlantUmlUseCase } from '@/lib/export/lld/plantUmlUseCase'
import type { LldDiagramSpec } from './types'

/**
 * UML use case diagram.
 *
 * Notation follows the UML spec: actors are stick figures outside the subject,
 * use cases are horizontal ellipses inside it, and include/extend are dashed
 * dependencies distinguished by their stereotype.
 */
export const usecaseSpec: LldDiagramSpec<'usecase'> = {
  type: 'usecase',
  label: 'Use case',
  description: 'Actors, goals and system scope',

  paletteGroups: [
    {
      id: 'actors',
      label: 'Actors',
      entries: [
        {
          kind: 'shape',
          id: 'uc-actor',
          name: 'Actor',
          description: 'Stick figure — a role interacting with the system',
          tags: ['actor', 'user', 'role', 'primary', 'stick figure'],
          spawn: { shape: 'lldActor', isPrimary: true },
        },
        {
          kind: 'shape',
          id: 'uc-actor-system',
          name: 'External system',
          description: 'Non-human actor drawn as a boxed «actor»',
          tags: ['system', 'external', 'secondary', 'service', 'actor'],
          spawn: { shape: 'lldActor', isSystem: true, isPrimary: false },
        },
      ],
    },
    {
      id: 'behaviour',
      label: 'Behaviour',
      entries: [
        {
          kind: 'shape',
          id: 'uc-usecase',
          name: 'Use case',
          description: 'Horizontal ellipse — a unit of observable value',
          tags: ['use case', 'goal', 'ellipse', 'oval', 'function'],
          spawn: { shape: 'lldUseCase' },
        },
        {
          kind: 'shape',
          id: 'uc-usecase-abstract',
          name: 'Abstract use case',
          description: 'Italic name — extended or included, never invoked directly',
          tags: ['abstract', 'use case', 'base'],
          spawn: { shape: 'lldUseCase', isAbstract: true, label: 'Abstract use case' },
        },
      ],
    },
    {
      id: 'scope',
      label: 'Scope',
      entries: [
        {
          kind: 'shape',
          id: 'uc-boundary',
          name: 'System boundary',
          description: 'Subject rectangle — use cases inside, actors outside',
          tags: ['boundary', 'subject', 'system', 'scope', 'rectangle'],
          spawn: { shape: 'lldBoundary' },
        },
        {
          kind: 'shape',
          id: 'uc-package',
          name: 'Package',
          description: 'Tabbed folder grouping related use cases',
          tags: ['package', 'group', 'namespace', 'folder'],
          spawn: { shape: 'lldPackage' },
        },
        {
          kind: 'shape',
          id: 'uc-note',
          name: 'Note',
          description: 'Annotation',
          tags: ['note', 'comment', 'annotation'],
          spawn: { shape: 'lldNote' },
        },
      ],
    },
    {
      id: 'connectors',
      label: 'Relationships',
      entries: [
        {
          kind: 'connector',
          id: 'uc-conn-association',
          name: 'Association',
          description: 'Plain line — an actor participates in a use case',
          tags: ['association', 'participates', 'line'],
          edgeKind: 'uc-association',
        },
        {
          kind: 'connector',
          id: 'uc-conn-include',
          name: 'Include',
          description: '«include» — base always performs the included use case',
          tags: ['include', 'reuse', 'mandatory'],
          edgeKind: 'uc-include',
        },
        {
          kind: 'connector',
          id: 'uc-conn-extend',
          name: 'Extend',
          description: '«extend» — optional behaviour at an extension point',
          tags: ['extend', 'optional', 'conditional', 'extension point'],
          edgeKind: 'uc-extend',
        },
        {
          kind: 'connector',
          id: 'uc-conn-generalization',
          name: 'Generalization',
          description: 'Hollow triangle — specialises an actor or use case',
          tags: ['generalization', 'inherits', 'specialises'],
          edgeKind: 'uc-generalization',
        },
        {
          kind: 'connector',
          id: 'uc-conn-dependency',
          name: 'Dependency',
          description: 'Dashed open arrow',
          tags: ['dependency', 'uses'],
          edgeKind: 'uc-dependency',
        },
      ],
    },
  ],

  edgeKinds: [
    'uc-association',
    'uc-include',
    'uc-extend',
    'uc-generalization',
    'uc-dependency',
  ],
  defaultEdgeKind: 'uc-association',

  isValidConnection: ({ source, target }) => {
    const connectable = new Set(['lldActor', 'lldUseCase', 'lldPackage'])
    if (!connectable.has(source.type ?? '') || !connectable.has(target.type ?? '')) return false
    // The boundary is scenery, and a shape never relates to itself here.
    return source.id !== target.id
  },

  exporters: [
    {
      id: 'plantuml-usecase',
      label: 'PlantUML',
      description: '@startuml use case syntax',
      extension: 'puml',
      serialize: toPlantUmlUseCase,
    },
  ],

  seed: ({ component }) => {
    const subject = spawnShape(
      { shape: 'lldBoundary', label: component ? String(component.data.label ?? 'System') : 'System' },
      { x: 420, y: 260 }
    )
    const actor = spawnShape({ shape: 'lldActor', isPrimary: true, label: 'User' }, { x: 120, y: 240 })
    const useCase = spawnShape({ shape: 'lldUseCase', label: 'Primary goal' }, { x: 420, y: 220 })

    return { shapes: [subject, actor, useCase], edges: [] }
  },
}
