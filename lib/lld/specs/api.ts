import { spawnShape } from '../spawnShape'
import { toOpenApiJson } from '@/lib/export/lld/openApi'
import type { LldDiagramSpec } from './types'

export const apiSpec: LldDiagramSpec<'api'> = {
  type: 'api',
  label: 'API contract',
  description: 'Endpoints, schemas and status codes',

  paletteGroups: [
    {
      id: 'endpoints',
      label: 'Endpoints',
      entries: (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map((method) => ({
        kind: 'shape' as const,
        id: `api-${method.toLowerCase()}`,
        name: method,
        description: `${method} endpoint`,
        tags: ['endpoint', method.toLowerCase(), 'http'],
        spawn: { shape: 'lldEndpoint' as const, method },
      })),
    },
    {
      id: 'schemas',
      label: 'Schemas',
      entries: [
        {
          kind: 'shape' as const,
          id: 'api-request',
          name: 'Request',
          description: 'Request body schema',
          tags: ['request', 'body', 'payload'],
          spawn: { shape: 'lldSchema', role: 'request' },
        },
        ...[200, 201, 400, 401, 404, 500].map((code) => ({
          kind: 'shape' as const,
          id: `api-res-${code}`,
          name: `Response ${code}`,
          description: `${code} response schema`,
          tags: ['response', String(code)],
          spawn: { shape: 'lldSchema' as const, role: 'response' as const, statusCode: code },
        })),
      ],
    },
    {
      id: 'annotations',
      label: 'Middleware',
      entries: [
        {
          kind: 'shape' as const,
          id: 'api-auth',
          name: 'Auth',
          description: 'Authentication requirement',
          tags: ['auth', 'jwt', 'security'],
          spawn: { shape: 'lldAnnotation', annotationKind: 'auth' },
        },
        {
          kind: 'shape' as const,
          id: 'api-rate-limit',
          name: 'Rate limit',
          description: 'Throughput cap',
          tags: ['rate', 'limit', 'throttle'],
          spawn: { shape: 'lldAnnotation', annotationKind: 'rate-limit' },
        },
        {
          kind: 'shape' as const,
          id: 'api-cache',
          name: 'Cache',
          description: 'Response caching policy',
          tags: ['cache', 'ttl'],
          spawn: { shape: 'lldAnnotation', annotationKind: 'cache' },
        },
        {
          kind: 'shape' as const,
          id: 'api-middleware',
          name: 'Middleware',
          description: 'Other request pipeline step',
          tags: ['middleware', 'pipeline'],
          spawn: { shape: 'lldAnnotation', annotationKind: 'middleware' },
        },
        {
          kind: 'shape' as const,
          id: 'api-note',
          name: 'Note',
          description: 'Comment',
          tags: ['note'],
          spawn: { shape: 'lldNote' },
        },
      ],
    },
    {
      id: 'connectors',
      label: 'Links',
      entries: [
        {
          kind: 'connector' as const,
          id: 'api-conn-request',
          name: 'Request',
          description: 'Endpoint to its request body schema',
          tags: ['request', 'body'],
          edgeKind: 'api-request' as const,
        },
        {
          kind: 'connector' as const,
          id: 'api-conn-response',
          name: 'Response',
          description: 'Endpoint to a response schema, labelled by status',
          tags: ['response', 'status'],
          edgeKind: 'api-response' as const,
        },
        {
          kind: 'connector' as const,
          id: 'api-conn-annotation',
          name: 'Annotation',
          description: 'Endpoint to an auth or middleware tag',
          tags: ['annotation', 'auth', 'middleware'],
          edgeKind: 'api-annotation' as const,
        },
      ],
    },
  ],

  edgeKinds: ['api-request', 'api-response', 'api-annotation'],
  defaultEdgeKind: 'api-response',

  // Contracts fan out from an endpoint; schemas never link to each other.
  isValidConnection: ({ source, target }) =>
    source.type === 'lldEndpoint' &&
    (target.type === 'lldSchema' || target.type === 'lldAnnotation'),

  exporters: [
    {
      id: 'openapi',
      label: 'OpenAPI 3.0',
      description: 'JSON specification',
      extension: 'json',
      serialize: toOpenApiJson,
    },
  ],

  seed: ({ component }) => {
    const endpoint = spawnShape(
      {
        shape: 'lldEndpoint',
        method: 'GET',
        path: `/${kebab(component ? String(component.data.label ?? 'resource') : 'resource')}`,
      },
      { x: 300, y: 200 }
    )
    return { shapes: [endpoint], edges: [] }
  },
}

function kebab(s: string): string {
  return (
    s
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'resource'
  )
}
