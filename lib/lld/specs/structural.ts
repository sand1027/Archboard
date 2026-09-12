import { spawnShape } from '../spawnShape'
import type { LldDiagramSpec } from './types'

/**
 * The four structural diagram types that share the object / component /
 * deployment shape family, plus the package diagram.
 *
 * Grouped in one file because each spec is small and they reference the same
 * shapes; splitting them would spread one vocabulary across four files.
 */

const NOTE = {
  kind: 'shape' as const,
  id: 'note',
  name: 'Note',
  description: 'Annotation',
  tags: ['note', 'comment', 'annotation'],
  spawn: { shape: 'lldNote' as const },
}

// ─── object diagram ──────────────────────────────────────────────────────────

export const objectSpec: LldDiagramSpec<'object'> = {
  type: 'object',
  label: 'Object',
  description: 'Instances and their values at a point in time',

  paletteGroups: [
    {
      id: 'instances',
      label: 'Instances',
      entries: [
        {
          kind: 'shape',
          id: 'obj-instance',
          name: 'Object',
          description: 'Instance specification — underlined name : Class',
          tags: ['object', 'instance', 'specification'],
          spawn: { shape: 'lldObject' },
        },
        {
          kind: 'shape',
          id: 'obj-anonymous',
          name: 'Anonymous object',
          description: 'Unnamed instance, rendered as : Class',
          tags: ['anonymous', 'instance', 'object'],
          spawn: { shape: 'lldObject', instanceName: '' },
        },
        {
          kind: 'shape',
          id: 'obj-multi',
          name: 'Multi-object',
          description: 'A collection of instances, drawn stacked',
          tags: ['multi', 'collection', 'set', 'many'],
          spawn: { shape: 'lldObject', isMultiObject: true },
        },
        { ...NOTE, id: 'obj-note' },
      ],
    },
    {
      id: 'connectors',
      label: 'Links',
      entries: [
        {
          kind: 'connector',
          id: 'obj-conn-link',
          name: 'Link',
          description: 'An instance of an association',
          tags: ['link', 'association', 'instance'],
          edgeKind: 'obj-link',
        },
      ],
    },
  ],

  edgeKinds: ['obj-link'],
  defaultEdgeKind: 'obj-link',
  isValidConnection: ({ source, target }) =>
    source.type === 'lldObject' && target.type === 'lldObject' && source.id !== target.id,
  exporters: [],

  seed: ({ component }) => {
    const obj = spawnShape(
      {
        shape: 'lldObject',
        className: component ? pascal(String(component.data.label ?? 'Entity')) : 'Entity',
      },
      { x: 320, y: 220 }
    )
    return { shapes: [obj], edges: [] }
  },
}

// ─── communication diagram ───────────────────────────────────────────────────

export const communicationSpec: LldDiagramSpec<'communication'> = {
  type: 'communication',
  label: 'Comm',
  description: 'Who talks to whom, with numbered messages',

  paletteGroups: [
    {
      id: 'participants',
      label: 'Participants',
      entries: [
        {
          kind: 'shape',
          id: 'comm-object',
          name: 'Object',
          description: 'Participating instance',
          tags: ['object', 'instance', 'participant'],
          spawn: { shape: 'lldObject' },
        },
        {
          kind: 'shape',
          id: 'comm-actor',
          name: 'Actor',
          description: 'External role initiating the interaction',
          tags: ['actor', 'user', 'role'],
          spawn: { shape: 'lldActor', isPrimary: true },
        },
        { ...NOTE, id: 'comm-note' },
      ],
    },
    {
      id: 'connectors',
      label: 'Messages',
      entries: [
        {
          kind: 'connector',
          id: 'comm-conn-message',
          name: 'Message',
          description: 'Hierarchically numbered call, e.g. 1, 1.1, 2',
          tags: ['message', 'call', 'sequence number'],
          edgeKind: 'comm-message',
        },
        {
          kind: 'connector',
          id: 'comm-conn-link',
          name: 'Link',
          description: 'Plain association between participants',
          tags: ['link', 'association'],
          edgeKind: 'obj-link',
        },
      ],
    },
  ],

  edgeKinds: ['comm-message', 'obj-link'],
  defaultEdgeKind: 'comm-message',
  isValidConnection: ({ source, target }) => {
    const ok = new Set(['lldObject', 'lldActor'])
    return ok.has(source.type ?? '') && ok.has(target.type ?? '') && source.id !== target.id
  },
  exporters: [],

  seed: () => ({ shapes: [], edges: [] }),
}

// ─── component diagram ───────────────────────────────────────────────────────

export const componentSpec: LldDiagramSpec<'component'> = {
  type: 'component',
  label: 'Component',
  description: 'Components and the interfaces they provide or need',

  paletteGroups: [
    {
      id: 'components',
      label: 'Components',
      entries: [
        {
          kind: 'shape',
          id: 'comp-component',
          name: 'Component',
          description: 'Rectangle with the two-tab component icon',
          tags: ['component', 'module', 'unit'],
          spawn: { shape: 'lldComponent' },
        },
        {
          kind: 'shape',
          id: 'comp-subsystem',
          name: 'Subsystem',
          description: '«subsystem» grouping of components',
          tags: ['subsystem', 'group'],
          spawn: { shape: 'lldComponent', stereotype: 'subsystem', label: 'Subsystem' },
        },
        {
          kind: 'shape',
          id: 'comp-package',
          name: 'Package',
          description: 'Namespace grouping',
          tags: ['package', 'namespace'],
          spawn: { shape: 'lldPackage' },
        },
        { ...NOTE, id: 'comp-note' },
      ],
    },
    {
      id: 'interfaces',
      label: 'Interfaces',
      entries: [
        {
          kind: 'shape',
          id: 'comp-provided',
          name: 'Provided',
          description: 'Lollipop — an interface this component offers',
          tags: ['provided', 'lollipop', 'interface', 'offers'],
          spawn: { shape: 'lldInterface', direction: 'provided' },
        },
        {
          kind: 'shape',
          id: 'comp-required',
          name: 'Required',
          description: 'Socket — an interface this component needs',
          tags: ['required', 'socket', 'interface', 'needs'],
          spawn: { shape: 'lldInterface', direction: 'required' },
        },
      ],
    },
    {
      id: 'connectors',
      label: 'Connectors',
      entries: [
        {
          kind: 'connector',
          id: 'comp-conn-assembly',
          name: 'Assembly',
          description: 'Wires a required interface to a provided one',
          tags: ['assembly', 'wire', 'connect'],
          edgeKind: 'comp-assembly',
        },
        {
          kind: 'connector',
          id: 'comp-conn-delegation',
          name: 'Delegation',
          description: 'Forwards a port to an internal part',
          tags: ['delegation', 'delegate', 'port'],
          edgeKind: 'comp-delegation',
        },
        {
          kind: 'connector',
          id: 'comp-conn-dependency',
          name: 'Dependency',
          description: 'Dashed open arrow',
          tags: ['dependency', 'uses'],
          edgeKind: 'comp-dependency',
        },
      ],
    },
  ],

  edgeKinds: ['comp-assembly', 'comp-delegation', 'comp-dependency'],
  defaultEdgeKind: 'comp-dependency',
  isValidConnection: ({ source, target }) => {
    const ok = new Set(['lldComponent', 'lldInterface', 'lldPackage'])
    return ok.has(source.type ?? '') && ok.has(target.type ?? '') && source.id !== target.id
  },
  exporters: [],

  seed: ({ component }) => {
    const c = spawnShape(
      { shape: 'lldComponent', label: component ? String(component.data.label ?? 'Component') : 'Component' },
      { x: 340, y: 220 }
    )
    return { shapes: [c], edges: [] }
  },
}

// ─── deployment diagram ──────────────────────────────────────────────────────

export const deploymentSpec: LldDiagramSpec<'deployment'> = {
  type: 'deployment',
  label: 'Deployment',
  description: 'Where artifacts run and how nodes connect',

  paletteGroups: [
    {
      id: 'targets',
      label: 'Deployment targets',
      entries: [
        {
          kind: 'shape',
          id: 'dep-device',
          name: 'Device',
          description: '3-D box — physical or virtual hardware',
          tags: ['device', 'hardware', 'server', 'machine', 'node'],
          spawn: { shape: 'lldDeployNode', nodeKind: 'device' },
        },
        {
          kind: 'shape',
          id: 'dep-runtime',
          name: 'Execution environment',
          description: '«execution environment» — a container or runtime',
          tags: ['runtime', 'container', 'jvm', 'docker', 'environment'],
          spawn: { shape: 'lldDeployNode', nodeKind: 'execution-environment' },
        },
        {
          kind: 'shape',
          id: 'dep-node',
          name: 'Node',
          description: 'Generic deployment target',
          tags: ['node', 'target'],
          spawn: { shape: 'lldDeployNode', nodeKind: 'node' },
        },
      ],
    },
    {
      id: 'artifacts',
      label: 'Artifacts',
      entries: [
        {
          kind: 'shape',
          id: 'dep-executable',
          name: 'Executable',
          description: 'Deployable binary or service bundle',
          tags: ['executable', 'jar', 'binary', 'service', 'artifact'],
          spawn: { shape: 'lldArtifact', artifactKind: 'executable' },
        },
        {
          kind: 'shape',
          id: 'dep-library',
          name: 'Library',
          description: 'Shared library dependency',
          tags: ['library', 'so', 'dll', 'dependency'],
          spawn: { shape: 'lldArtifact', artifactKind: 'library' },
        },
        {
          kind: 'shape',
          id: 'dep-database',
          name: 'Database artifact',
          description: 'Schema or data file',
          tags: ['database', 'schema', 'sql', 'data'],
          spawn: { shape: 'lldArtifact', artifactKind: 'database' },
        },
        {
          kind: 'shape',
          id: 'dep-document',
          name: 'Document',
          description: 'Configuration or documentation file',
          tags: ['document', 'config', 'file'],
          spawn: { shape: 'lldArtifact', artifactKind: 'document' },
        },
        {
          kind: 'shape',
          id: 'dep-artifact',
          name: 'Artifact',
          description: 'Generic «artifact»',
          tags: ['artifact', 'file'],
          spawn: { shape: 'lldArtifact', artifactKind: 'artifact' },
        },
        {
          kind: 'shape',
          id: 'dep-component',
          name: 'Component',
          description: 'Component deployed onto a node',
          tags: ['component', 'module'],
          spawn: { shape: 'lldComponent' },
        },
        { ...NOTE, id: 'dep-note' },
      ],
    },
    {
      id: 'connectors',
      label: 'Relationships',
      entries: [
        {
          kind: 'connector',
          id: 'dep-conn-comm',
          name: 'Communication path',
          description: 'Plain line between nodes, labelled with the transport',
          tags: ['communication', 'network', 'path', 'tcp', 'link'],
          edgeKind: 'deploy-communication',
        },
        {
          kind: 'connector',
          id: 'dep-conn-deploy',
          name: 'Deploy',
          description: '«deploy» — artifact runs on this node',
          tags: ['deploy', 'runs on', 'hosted'],
          edgeKind: 'deploy-deployment',
        },
        {
          kind: 'connector',
          id: 'dep-conn-manifest',
          name: 'Manifest',
          description: '«manifest» — artifact implements a component',
          tags: ['manifest', 'implements', 'realises'],
          edgeKind: 'deploy-manifest',
        },
      ],
    },
  ],

  edgeKinds: ['deploy-communication', 'deploy-deployment', 'deploy-manifest'],
  defaultEdgeKind: 'deploy-communication',
  isValidConnection: ({ source, target }) => {
    const ok = new Set(['lldDeployNode', 'lldArtifact', 'lldComponent'])
    return ok.has(source.type ?? '') && ok.has(target.type ?? '') && source.id !== target.id
  },
  exporters: [],

  seed: ({ component }) => {
    const node = spawnShape({ shape: 'lldDeployNode', nodeKind: 'device' }, { x: 340, y: 240 })
    const artifact = spawnShape(
      {
        shape: 'lldArtifact',
        artifactKind: 'executable',
        label: component ? `${kebab(String(component.data.label ?? 'service'))}.jar` : 'service.jar',
      },
      { x: 340, y: 250 }
    )
    return { shapes: [node, artifact], edges: [] }
  },
}

// ─── package diagram ─────────────────────────────────────────────────────────

export const packageSpec: LldDiagramSpec<'package'> = {
  type: 'package',
  label: 'Package',
  description: 'Namespaces and their dependencies',

  paletteGroups: [
    {
      id: 'packages',
      label: 'Packages',
      entries: [
        {
          kind: 'shape',
          id: 'pkg-package',
          name: 'Package',
          description: 'Tabbed folder namespace',
          tags: ['package', 'namespace', 'folder', 'module'],
          spawn: { shape: 'lldPackage' },
        },
        {
          kind: 'shape',
          id: 'pkg-class',
          name: 'Class',
          description: 'Type living inside a package',
          tags: ['class', 'type'],
          spawn: { shape: 'lldClass', stereotype: 'class' },
        },
        {
          kind: 'shape',
          id: 'pkg-component',
          name: 'Component',
          description: 'Component living inside a package',
          tags: ['component'],
          spawn: { shape: 'lldComponent' },
        },
        { ...NOTE, id: 'pkg-note' },
      ],
    },
    {
      id: 'connectors',
      label: 'Relationships',
      entries: [
        {
          kind: 'connector',
          id: 'pkg-conn-import',
          name: 'Import',
          description: '«import» — public members become visible',
          tags: ['import', 'uses', 'visibility'],
          edgeKind: 'pkg-import',
        },
        {
          kind: 'connector',
          id: 'pkg-conn-merge',
          name: 'Merge',
          description: '«merge» — contents are combined',
          tags: ['merge', 'combine'],
          edgeKind: 'pkg-merge',
        },
        {
          kind: 'connector',
          id: 'pkg-conn-nesting',
          name: 'Nesting',
          description: 'Circle-plus at the containing package',
          tags: ['nesting', 'contains', 'containment'],
          edgeKind: 'pkg-nesting',
        },
      ],
    },
  ],

  edgeKinds: ['pkg-import', 'pkg-merge', 'pkg-nesting'],
  defaultEdgeKind: 'pkg-import',
  isValidConnection: ({ source, target }) => source.id !== target.id,
  exporters: [],

  seed: () => {
    const pkg = spawnShape({ shape: 'lldPackage', label: 'domain' }, { x: 320, y: 220 })
    return { shapes: [pkg], edges: [] }
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

function kebab(s: string): string {
  return (
    s
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'service'
  )
}
