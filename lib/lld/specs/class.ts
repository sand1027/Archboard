import { spawnShape } from '../spawnShape'
import { toMermaidClass } from '@/lib/export/lld/mermaidClass'
import { toPlantUmlClass } from '@/lib/export/lld/plantUmlClass'
import type { LldDiagramSpec } from './types'

export const classSpec: LldDiagramSpec<'class'> = {
  type: 'class',
  label: 'UML',
  description: 'Types, members and their relationships',

  paletteGroups: [
    {
      id: 'types',
      label: 'Types',
      entries: [
        {
          kind: 'shape',
          id: 'cls-class',
          name: 'Class',
          description: 'Three compartments: name / fields / methods',
          tags: ['class', 'type', 'oop'],
          spawn: { shape: 'lldClass', stereotype: 'class' },
        },
        {
          kind: 'shape',
          id: 'cls-interface',
          name: 'Interface',
          description: '«interface» stereotype header',
          tags: ['interface', 'contract', 'protocol'],
          spawn: { shape: 'lldClass', stereotype: 'interface' },
        },
        {
          kind: 'shape',
          id: 'cls-abstract',
          name: 'Abstract class',
          description: '«abstract», italic name',
          tags: ['abstract', 'base'],
          spawn: { shape: 'lldClass', stereotype: 'abstract' },
        },
        {
          kind: 'shape',
          id: 'cls-enum',
          name: 'Enum',
          description: 'Name plus value list',
          tags: ['enum', 'values', 'enumeration'],
          spawn: { shape: 'lldClass', stereotype: 'enum' },
        },
        {
          kind: 'shape',
          id: 'cls-struct',
          name: 'Struct / Record',
          description: 'Value type with no behaviour',
          tags: ['struct', 'record', 'value'],
          spawn: { shape: 'lldClass', stereotype: 'struct' },
        },
        {
          kind: 'shape',
          id: 'cls-datatype',
          name: 'Data type',
          description: '«datatype» — value semantics',
          tags: ['datatype', 'value', 'type'],
          spawn: { shape: 'lldClass', stereotype: 'datatype', name: 'Money' },
        },
        {
          kind: 'shape',
          id: 'cls-primitive',
          name: 'Primitive',
          description: '«primitive» — language built-in',
          tags: ['primitive', 'builtin'],
          spawn: { shape: 'lldClass', stereotype: 'primitive', name: 'Integer' },
        },
        {
          kind: 'shape',
          id: 'cls-utility',
          name: 'Utility',
          description: '«utility» — static helpers only',
          tags: ['utility', 'static', 'helper'],
          spawn: { shape: 'lldClass', stereotype: 'utility', name: 'MathUtils' },
        },
        {
          kind: 'shape',
          id: 'cls-exception',
          name: 'Exception',
          description: '«exception» — error type',
          tags: ['exception', 'error', 'throwable'],
          spawn: { shape: 'lldClass', stereotype: 'exception', name: 'NotFoundError' },
        },
        {
          kind: 'shape',
          id: 'cls-template',
          name: 'Template',
          description: 'Parameterised class with a dashed parameter box',
          tags: ['template', 'generic', 'parameterised'],
          spawn: { shape: 'lldClass', stereotype: 'template', name: 'Repository' },
        },
        {
          kind: 'shape',
          id: 'cls-note',
          name: 'Note',
          description: 'Comment',
          tags: ['note', 'comment'],
          spawn: { shape: 'lldNote' },
        },
      ],
    },
    {
      id: 'analysis',
      label: 'Analysis stereotypes',
      entries: [
        {
          kind: 'shape',
          id: 'cls-boundary',
          name: 'Boundary',
          description: '«boundary» — talks to the outside world',
          tags: ['boundary', 'ui', 'robustness', 'analysis'],
          spawn: { shape: 'lldClass', stereotype: 'boundary', name: 'OrderView' },
        },
        {
          kind: 'shape',
          id: 'cls-control',
          name: 'Control',
          description: '«control» — coordinates a use case',
          tags: ['control', 'controller', 'robustness', 'analysis'],
          spawn: { shape: 'lldClass', stereotype: 'control', name: 'OrderController' },
        },
        {
          kind: 'shape',
          id: 'cls-entity',
          name: 'Entity',
          description: '«entity» — persistent domain concept',
          tags: ['entity', 'domain', 'robustness', 'analysis'],
          spawn: { shape: 'lldClass', stereotype: 'entity', name: 'Order' },
        },
      ],
    },
    {
      id: 'connectors',
      label: 'Relationships',
      entries: [
        {
          kind: 'connector',
          id: 'cls-conn-inheritance',
          name: 'Inheritance',
          description: 'Hollow triangle, solid line — extends',
          tags: ['inheritance', 'generalization', 'extends'],
          edgeKind: 'inheritance',
        },
        {
          kind: 'connector',
          id: 'cls-conn-realization',
          name: 'Realization',
          description: 'Hollow triangle, dashed line — implements',
          tags: ['realization', 'implements', 'interface'],
          edgeKind: 'realization',
        },
        {
          kind: 'connector',
          id: 'cls-conn-composition',
          name: 'Composition',
          description: 'Filled diamond at the owner',
          tags: ['composition', 'owns', 'part-of'],
          edgeKind: 'composition',
        },
        {
          kind: 'connector',
          id: 'cls-conn-aggregation',
          name: 'Aggregation',
          description: 'Hollow diamond at the owner',
          tags: ['aggregation', 'has-a'],
          edgeKind: 'aggregation',
        },
        {
          kind: 'connector',
          id: 'cls-conn-association',
          name: 'Association',
          description: 'Plain line with optional multiplicity',
          tags: ['association', 'relates'],
          edgeKind: 'association',
        },
        {
          kind: 'connector',
          id: 'cls-conn-dependency',
          name: 'Dependency',
          description: 'Open arrow, dashed line — uses',
          tags: ['dependency', 'uses'],
          edgeKind: 'dependency',
        },
      ],
    },
  ],

  edgeKinds: [
    'inheritance',
    'realization',
    'composition',
    'aggregation',
    'association',
    'dependency',
  ],
  defaultEdgeKind: 'association',

  isValidConnection: ({ source, target }) =>
    source.type === 'lldClass' && target.type === 'lldClass',

  exporters: [
    {
      id: 'mermaid-class',
      label: 'Mermaid',
      description: 'classDiagram syntax',
      extension: 'mmd',
      serialize: toMermaidClass,
    },
    {
      id: 'plantuml-class',
      label: 'PlantUML',
      description: '@startuml class syntax',
      extension: 'puml',
      serialize: toPlantUmlClass,
    },
  ],

  seed: ({ component }) => {
    const label = component ? String(component.data.label ?? 'Service') : 'Service'
    const cls = spawnShape(
      { shape: 'lldClass', stereotype: 'class', name: `${pascal(label)}Service` },
      { x: 320, y: 220 }
    )
    return { shapes: [cls], edges: [] }
  },
}

function pascal(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
}
