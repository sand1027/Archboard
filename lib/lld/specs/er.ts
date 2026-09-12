import { spawnShape } from '../spawnShape'
import { toMermaidEr } from '@/lib/export/lld/mermaidEr'
import { toSqlDdl } from '@/lib/export/lld/sqlDdl'
import type { LldDiagramSpec } from './types'

export const erSpec: LldDiagramSpec<'er'> = {
  type: 'er',
  label: 'ER',
  description: 'Tables, columns and relationships',

  paletteGroups: [
    {
      id: 'relations',
      label: 'Relations',
      entries: [
        {
          kind: 'shape',
          id: 'er-table',
          name: 'Table',
          description: 'Header plus typed columns with PK / FK markers',
          tags: ['table', 'entity', 'relation', 'columns'],
          spawn: { shape: 'lldTable', tableKind: 'table' },
        },
        {
          kind: 'shape',
          id: 'er-view',
          name: 'View',
          description: 'Derived read-only projection',
          tags: ['view', 'query', 'derived'],
          spawn: { shape: 'lldTable', tableKind: 'view' },
        },
        {
          kind: 'shape',
          id: 'er-note',
          name: 'Note',
          description: 'Schema comment',
          tags: ['note', 'comment'],
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
          id: 'er-conn-1-1',
          name: 'One to one',
          description: "Crow's foot — exactly one at both ends",
          tags: ['one-to-one', '1:1'],
          edgeKind: 'er-one-to-one',
        },
        {
          kind: 'connector',
          id: 'er-conn-1-n',
          name: 'One to many',
          description: "Crow's foot fork at the many end",
          tags: ['one-to-many', '1:n', 'has many'],
          edgeKind: 'er-one-to-many',
        },
        {
          kind: 'connector',
          id: 'er-conn-n-m',
          name: 'Many to many',
          description: "Crow's foot at both ends",
          tags: ['many-to-many', 'n:m', 'join table'],
          edgeKind: 'er-many-to-many',
        },
        {
          kind: 'connector',
          id: 'er-conn-fk',
          name: 'FK reference',
          description: 'Column-to-column foreign key line',
          tags: ['fk', 'foreign key', 'reference'],
          edgeKind: 'er-fk-ref',
        },
      ],
    },
  ],

  edgeKinds: ['er-one-to-one', 'er-one-to-many', 'er-many-to-many', 'er-fk-ref'],
  defaultEdgeKind: 'er-one-to-many',

  isValidConnection: ({ source, target }) =>
    source.type === 'lldTable' && target.type === 'lldTable',

  exporters: [
    {
      id: 'mermaid-er',
      label: 'Mermaid',
      description: 'erDiagram syntax',
      extension: 'mmd',
      serialize: toMermaidEr,
    },
    {
      id: 'sql-ddl',
      label: 'SQL DDL',
      description: 'CREATE TABLE statements with keys and FKs',
      extension: 'sql',
      serialize: toSqlDdl,
    },
  ],

  seed: ({ component }) => {
    const name = snake(component ? String(component.data.label ?? 'record') : 'record')
    const table = spawnShape({ shape: 'lldTable', tableKind: 'table', name }, { x: 320, y: 220 })
    return { shapes: [table], edges: [] }
  },
}

function snake(s: string): string {
  return (
    s
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase() || 'record'
  )
}
