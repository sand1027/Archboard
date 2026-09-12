import type { LldDiagram, LldWorkspace } from '@/types/lld'
import { LLD_DIAGRAM_TYPES } from '@/types/lld'

export const LLD_WORKSPACE_SCHEMA_VERSION = 1

export interface LldWorkspaceDocument {
  schema: 'archboard.lld.workspace'
  version: number
  exportedAt: string
  workspace: LldWorkspace
}

export function workspaceToJson(workspace: LldWorkspace): string {
  const doc: LldWorkspaceDocument = {
    schema: 'archboard.lld.workspace',
    version: LLD_WORKSPACE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    workspace,
  }
  return JSON.stringify(doc, null, 2)
}

/**
 * Parse and validate an exported workspace.
 *
 * Returns null rather than throwing, and validates before returning anything so
 * a truncated file cannot be partially applied over good state.
 */
export function workspaceFromJson(raw: string): LldWorkspace | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!isRecord(parsed)) return null
  if (parsed.schema !== 'archboard.lld.workspace') return null

  const workspace = parsed.workspace
  if (!isRecord(workspace)) return null

  if (!Array.isArray(workspace.diagrams)) return null

  const diagrams: LldDiagram[] = []
  for (const d of workspace.diagrams) {
    const diagram = validateDiagram(d)
    if (!diagram) return null
    diagrams.push(diagram)
  }

  const now = new Date().toISOString()
  return {
    id: str(workspace.id) ?? str(workspace.scopeId) ?? 'unknown',
    scopeId: str(workspace.scopeId) ?? str(workspace.componentId) ?? 'unknown',
    componentId: str(workspace.componentId),
    diagramId: str(workspace.diagramId) ?? '',
    title: str(workspace.title) ?? 'Component',
    diagrams,
    activeDiagramId:
      typeof workspace.activeDiagramId === 'string' &&
      diagrams.some((d) => d.id === workspace.activeDiagramId)
        ? workspace.activeDiagramId
        : (diagrams[0]?.id ?? null),
    createdAt: str(workspace.createdAt) ?? now,
    updatedAt: now,
  }
}

function validateDiagram(input: unknown): LldDiagram | null {
  if (!isRecord(input)) return null
  if (typeof input.id !== 'string' || !input.id) return null
  if (typeof input.type !== 'string') return null
  if (!LLD_DIAGRAM_TYPES.includes(input.type as LldDiagram['type'])) return null
  if (!Array.isArray(input.shapes) || !Array.isArray(input.edges)) return null

  // Shapes and edges are trusted structurally beyond this point: they came from
  // our own serializer, and the renderers already tolerate missing optional
  // fields. What matters is that ids and the discriminant are present.
  for (const s of input.shapes) {
    if (!isRecord(s) || typeof s.id !== 'string' || typeof s.type !== 'string') return null
  }
  for (const e of input.edges) {
    if (!isRecord(e)) return null
    if (typeof e.id !== 'string' || typeof e.source !== 'string' || typeof e.target !== 'string') {
      return null
    }
  }

  return {
    id: input.id,
    type: input.type as LldDiagram['type'],
    name: str(input.name) ?? 'Untitled',
    shapes: input.shapes as LldDiagram['shapes'],
    edges: input.edges as LldDiagram['edges'],
    viewport: isRecord(input.viewport)
      ? {
          x: num(input.viewport.x) ?? 0,
          y: num(input.viewport.y) ?? 0,
          zoom: num(input.viewport.zoom) ?? 1,
        }
      : { x: 0, y: 0, zoom: 1 },
    erNotation: input.erNotation === 'uml' ? 'uml' : input.type === 'er' ? 'crowsfoot' : undefined,
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}
