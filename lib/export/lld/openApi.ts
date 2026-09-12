import type {
  ApiAnnotationShapeData,
  ApiEndpointShapeData,
  ApiLinkData,
  ApiSchemaShapeData,
  LldDiagram,
  LldShape,
  SchemaField,
} from '@/types/lld'
import type { ExportContext } from '@/lib/lld/specs/types'

// A typed subset of OpenAPI 3.0 — enough for what the diagram can express,
// without an `any` in sight.

export interface OpenApiSchema {
  type?: string
  format?: string
  items?: OpenApiSchema
  properties?: Record<string, OpenApiSchema>
  required?: string[]
  description?: string
}

export interface OpenApiMediaType {
  schema: OpenApiSchema
}

export interface OpenApiRequestBody {
  required: boolean
  content: Record<string, OpenApiMediaType>
}

export interface OpenApiResponse {
  description: string
  content?: Record<string, OpenApiMediaType>
}

export interface OpenApiOperation {
  operationId?: string
  summary?: string
  description?: string
  requestBody?: OpenApiRequestBody
  responses: Record<string, OpenApiResponse>
  security?: Array<Record<string, string[]>>
  'x-rate-limit'?: string
  'x-cache'?: string
  'x-middleware'?: string[]
}

export interface OpenApiDocument {
  openapi: '3.0.3'
  info: { title: string; version: string; description?: string }
  paths: Record<string, Record<string, OpenApiOperation>>
  components?: { securitySchemes?: Record<string, OpenApiSecurityScheme> }
}

export interface OpenApiSecurityScheme {
  type: 'http' | 'apiKey'
  scheme?: string
  bearerFormat?: string
  name?: string
  in?: 'header' | 'query' | 'cookie'
}

type EndpointShape = Extract<LldShape, { type: 'lldEndpoint' }>
type SchemaShape = Extract<LldShape, { type: 'lldSchema' }>
type AnnotationShape = Extract<LldShape, { type: 'lldAnnotation' }>

export function toOpenApi(diagram: LldDiagram, ctx?: Partial<ExportContext>): OpenApiDocument {
  const endpoints = diagram.shapes.filter((s): s is EndpointShape => s.type === 'lldEndpoint')
  const schemas = new Map(
    diagram.shapes
      .filter((s): s is SchemaShape => s.type === 'lldSchema')
      .map((s) => [s.id, s])
  )
  const annotations = new Map(
    diagram.shapes
      .filter((s): s is AnnotationShape => s.type === 'lldAnnotation')
      .map((s) => [s.id, s])
  )

  const doc: OpenApiDocument = {
    openapi: '3.0.3',
    info: {
      title: ctx?.title ? `${ctx.title} API` : (ctx?.diagramName ?? 'API'),
      version: '1.0.0',
    },
    paths: {},
  }

  let needsBearer = false

  for (const endpoint of endpoints) {
    const data = endpoint.data as ApiEndpointShapeData
    const path = normalisePath(data.path)
    const method = data.method.toLowerCase()

    const operation: OpenApiOperation = { responses: {} }
    if (data.operationId) operation.operationId = data.operationId
    if (data.summary) operation.summary = data.summary

    const links = diagram.edges.filter(
      (e) => e.type === 'lldApiLink' && e.source === endpoint.id
    )

    const middleware: string[] = []

    for (const link of links) {
      const linkData = link.data as ApiLinkData | undefined
      if (!linkData) continue

      const schema = schemas.get(link.target)
      if (schema) {
        const sd = schema.data as ApiSchemaShapeData
        if (sd.role === 'request') {
          operation.requestBody = {
            required: true,
            content: { [sd.contentType || 'application/json']: { schema: objectSchema(sd.fields) } },
          }
        } else {
          const code = String(linkData.statusCode ?? sd.statusCode ?? 200)
          operation.responses[code] = {
            description: sd.label || statusText(Number(code)),
            content: {
              [sd.contentType || 'application/json']: { schema: objectSchema(sd.fields) },
            },
          }
        }
        continue
      }

      const annotation = annotations.get(link.target)
      if (annotation) {
        const ad = annotation.data as ApiAnnotationShapeData
        if (ad.annotationKind === 'auth') {
          needsBearer = true
          operation.security = [{ bearerAuth: [] }]
        } else if (ad.annotationKind === 'rate-limit') {
          operation['x-rate-limit'] = ad.detail
        } else if (ad.annotationKind === 'cache') {
          operation['x-cache'] = ad.detail
        } else {
          middleware.push(ad.detail || ad.label)
        }
      }
    }

    if (middleware.length > 0) operation['x-middleware'] = middleware

    // OpenAPI requires at least one response.
    if (Object.keys(operation.responses).length === 0) {
      operation.responses['200'] = { description: 'OK' }
    }

    doc.paths[path] ??= {}
    doc.paths[path][method] = operation
  }

  if (needsBearer) {
    doc.components = {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    }
  }

  return doc
}

export function toOpenApiJson(diagram: LldDiagram, ctx?: Partial<ExportContext>): string {
  return JSON.stringify(toOpenApi(diagram, ctx), null, 2)
}

function objectSchema(fields: SchemaField[]): OpenApiSchema {
  const properties: Record<string, OpenApiSchema> = {}
  const required: string[] = []

  for (const f of fields) {
    if (!f.name.trim()) continue
    properties[f.name] = fieldSchema(f.type)
    if (f.description) properties[f.name].description = f.description
    if (f.required) required.push(f.name)
  }

  const schema: OpenApiSchema = { type: 'object', properties }
  if (required.length > 0) schema.required = required
  return schema
}

function fieldSchema(rawType: string): OpenApiSchema {
  const type = rawType.trim()

  if (type.endsWith('[]')) {
    return { type: 'array', items: fieldSchema(type.slice(0, -2)) }
  }
  const generic = type.match(/^(?:Array|List)<(.+)>$/i)
  if (generic) {
    return { type: 'array', items: fieldSchema(generic[1]) }
  }

  switch (type.toLowerCase()) {
    case 'string':
    case 'text':
      return { type: 'string' }
    case 'int':
    case 'integer':
    case 'int32':
      return { type: 'integer', format: 'int32' }
    case 'long':
    case 'int64':
    case 'bigint':
      return { type: 'integer', format: 'int64' }
    case 'float':
    case 'double':
    case 'number':
    case 'decimal':
      return { type: 'number' }
    case 'bool':
    case 'boolean':
      return { type: 'boolean' }
    case 'uuid':
      return { type: 'string', format: 'uuid' }
    case 'date':
      return { type: 'string', format: 'date' }
    case 'datetime':
    case 'timestamp':
    case 'timestamptz':
      return { type: 'string', format: 'date-time' }
    case 'email':
      return { type: 'string', format: 'email' }
    case 'object':
    case 'json':
    case 'jsonb':
      return { type: 'object' }
    default:
      // Unknown named type — describe it rather than guessing wrong.
      return { type: 'object', description: type }
  }
}

/** Ensure a leading slash and normalise `:id` to OpenAPI `{id}`. */
function normalisePath(path: string): string {
  const p = (path || '/').trim()
  const withSlash = p.startsWith('/') ? p : `/${p}`
  return withSlash.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}')
}

function statusText(code: number): string {
  const map: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  }
  return map[code] ?? 'Response'
}
