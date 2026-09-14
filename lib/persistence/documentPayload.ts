/**
 * The Archboard document: one shape, one migration path, one place.
 *
 * Before this module the "boards vs legacy flat" hydration branch was written
 * three times (useDiagramPersistence, DiagramEditor, HistorySidebar) and could
 * drift. Everything now funnels through migrateDocument + applyDocument.
 *
 * Storage is unchanged: diagrams.data is a single jsonb column, so adding LLD
 * workspaces needs no schema migration.
 */

import { useDiagramStore } from '@/store/diagramStore'
import { useLldStore } from '@/store/lldStore'
import { useUiStore } from '@/store/uiStore'
import { generateId } from '@/lib/canvas/ids'
import { normaliseNodesConnectable } from '@/lib/canvas/nodeConnectivity'
import { useEstimateStore } from '@/store/estimateStore'
import { normaliseWorkload, sanitiseOverrides } from '@/lib/estimate/workload'
import { normalisePins, useDslStore } from '@/store/dslStore'
import { normalisePages, useNotesStore } from '@/store/notesStore'
import type { BoardMode, BoardSnapshot } from '@/types/diagram'
import type { LldWorkspace } from '@/types/lld'
import type { WorkloadDocument } from '@/types/estimate'
import type { DslDocument } from '@/types/dslDocument'
import { isPageUntouched, type NotesDocument } from '@/types/notes'

export const DOCUMENT_VERSION = 5

export interface ArchboardDocument {
  version: number
  activeBoard: BoardMode
  boards: { hld: BoardSnapshot; lld: BoardSnapshot }
  /** Keyed by HLD componentId. */
  lldWorkspaces: Record<string, LldWorkspace>
  /**
   * Capacity workload. Part of the design, so it travels with the diagram rather than
   * living in browser-local settings. Absent on documents written before v4.
   */
  workload?: WorkloadDocument
  /**
   * The notebook — functional, non-functional and assumption pages.
   *
   * Additive and unversioned: nothing branches on `version`, so an optional key that needs no
   * migration logic does not need a bump. Absent on any diagram nobody wrote notes in.
   */
  notes?: NotesDocument
  /**
   * The HLD text source and its position pins. Absent on documents written before v5, and
   * on any diagram that has only ever been drawn.
   *
   * Additive, like `workload` before it — the nodes and edges remain the rendered truth, so
   * a document with no `dsl` key opens exactly as it did.
   */
  dsl?: DslDocument
}

export function emptyBoard(name: string): BoardSnapshot {
  return {
    diagramId: generateId(),
    diagramName: name,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }
}

/** Snapshot both stores into a persistable document. */
export function buildDocument(): ArchboardDocument {
  const { activeBoard, boards } = useDiagramStore.getState().getPersistPayload()
  return {
    version: DOCUMENT_VERSION,
    activeBoard,
    boards,
    lldWorkspaces: useLldStore.getState().getPersistPayload(),
    workload: useEstimateStore.getState().getPersistPayload(),
    // Undefined when nothing has been written, so the key is absent rather than empty.
    notes: useNotesStore.getState().getPersistPayload(),
    dsl: dslPayload(),
  }
}

/**
 * The DSL document, or nothing.
 *
 * Omitted entirely when the diagram was never authored as text, so a drawn diagram's stored
 * JSON does not grow an empty key.
 */
function dslPayload(): DslDocument | undefined {
  const payload = useDslStore.getState().getPersistPayload()
  if (!payload.enabled && !payload.source) return undefined
  return payload
}

/**
 * Normalise any historical payload shape into the current one.
 *
 * Handles, in order:
 *   v3  { version, activeBoard, boards, lldWorkspaces }  → pass through
 *   v2  { activeBoard, boards }                          → add empty workspaces
 *   v1  { nodes, edges, viewport }                       → wrap as boards.hld
 *
 * Returns null when the input carries no recoverable diagram content, so the
 * caller can fall back to defaults rather than clobbering good state.
 */
export function migrateDocument(raw: unknown): ArchboardDocument | null {
  if (!isRecord(raw)) return null

  // v2 / v3 — board-shaped.
  if (isRecord(raw.boards) && (isRecord(raw.boards.hld) || isRecord(raw.boards.lld))) {
    const activeBoard: BoardMode = raw.activeBoard === 'lld' ? 'lld' : 'hld'
    return {
      version: DOCUMENT_VERSION,
      activeBoard,
      boards: {
        hld: normaliseBoard(raw.boards.hld, 'Untitled Diagram', 'hld'),
        lld: normaliseBoard(raw.boards.lld, 'Untitled LLD', 'lld'),
      },
      lldWorkspaces: normaliseWorkspaces(raw.lldWorkspaces),
      workload: normaliseWorkloadDoc(raw.workload),
      notes: normaliseNotesDoc(raw.notes),
      dsl: normaliseDslDoc(raw.dsl),
    }
  }

  // v1 — flat legacy diagram.
  if (Array.isArray(raw.nodes) && Array.isArray(raw.edges)) {
    return {
      version: DOCUMENT_VERSION,
      activeBoard: 'hld',
      boards: {
        hld: {
          diagramId: str(raw.id) ?? generateId(),
          diagramName: str(raw.name) ?? 'Untitled Diagram',
          nodes: raw.nodes as BoardSnapshot['nodes'],
          edges: raw.edges as BoardSnapshot['edges'],
          viewport: normaliseViewport(raw.viewport),
        },
        lld: emptyBoard('Untitled LLD'),
      },
      lldWorkspaces: normaliseWorkspaces(raw.lldWorkspaces),
      workload: normaliseWorkloadDoc(raw.workload),
      notes: normaliseNotesDoc(raw.notes),
      dsl: normaliseDslDoc(raw.dsl),
    }
  }

  return null
}

/** Push a document into both stores plus the UI board mode. */
export function applyDocument(doc: ArchboardDocument): void {
  useDiagramStore.getState().hydrateBoards({
    activeBoard: doc.activeBoard,
    boards: doc.boards,
  })
  useLldStore.getState().hydrate(doc.lldWorkspaces)
  // Undefined for pre-v4 documents; hydrate falls back to the default workload.
  useEstimateStore.getState().hydrate(doc.workload)
  // Undefined for any diagram with no requirements written; hydrate clears to empty.
  useNotesStore.getState().hydrate(doc.notes)
  // Undefined for pre-v5 documents and for any diagram that has only ever been drawn.
  useDslStore.getState().hydrate(doc.dsl)
  useUiStore.getState().setBoardMode(doc.activeBoard)
}

/** Convenience for the common "parse unknown, apply if usable" flow. */
export function applyRawDocument(raw: unknown): boolean {
  const doc = migrateDocument(raw)
  if (!doc) return false
  applyDocument(doc)
  return true
}

/** Drop workspaces whose HLD component no longer exists. */
export function orphanedWorkspaceIds(
  workspaces: Record<string, LldWorkspace>,
  hldNodeIds: Set<string>
): string[] {
  return Object.values(workspaces)
    .filter((ws) => ws.componentId !== undefined && !hldNodeIds.has(ws.componentId))
    .map((ws) => ws.scopeId)
}

// ─── normalisers ─────────────────────────────────────────────────────────────

function normaliseBoard(
  input: unknown,
  fallbackName: string,
  board: BoardMode
): BoardSnapshot {
  if (!isRecord(input)) return emptyBoard(fallbackName)
  return {
    diagramId: str(input.diagramId) ?? generateId(),
    diagramName: str(input.diagramName) ?? fallbackName,
    nodes: Array.isArray(input.nodes)
      ? normaliseNodesConnectable(input.nodes as BoardSnapshot['nodes'])
      : [],
    // Only the HLD board's handles changed shape; the legacy LLD board still
    // uses paired handles, so leave its edges alone.
    edges: Array.isArray(input.edges)
      ? board === 'hld'
        ? migrateEdges(input.edges)
        : (input.edges as BoardSnapshot['edges'])
      : [],
    viewport: normaliseViewport(input.viewport),
  }
}


function normaliseViewport(input: unknown): BoardSnapshot['viewport'] {
  if (!isRecord(input)) return { x: 0, y: 0, zoom: 1 }
  return {
    x: num(input.x) ?? 0,
    y: num(input.y) ?? 0,
    zoom: num(input.zoom) ?? 1,
  }
}

/**
 * Accept a stored workload only if it is shaped like one.
 *
 * Returning undefined rather than a default lets hydrate() own the fallback, so there is
 * one definition of "default workload" instead of two that can drift.
 */
function normaliseWorkloadDoc(input: unknown): WorkloadDocument | undefined {
  if (!isRecord(input)) return undefined

  return {
    inputs: normaliseWorkload(input.inputs),
    overrides: sanitiseOverrides(input.overrides),
  }
}

/**
 * Accept a stored DSL document only if it is shaped like one.
 *
 * `enabled` defaults to whether there is any source at all: a document written by an older
 * client that somehow carries text but no flag should still open as code rather than looking
 * like an empty editor next to a full canvas.
 */
/**
 * Accept a stored notebook only if it is shaped like one.
 *
 * `normalisePages` guarantees three pages in a fixed order and drops unknown block types, so
 * what comes back is always renderable. Undefined for a notebook nobody wrote in, which keeps
 * the key out of documents that never used the feature.
 */
function normaliseNotesDoc(input: unknown): NotesDocument | undefined {
  if (!isRecord(input)) return undefined

  const pages = normalisePages(input.pages)
  return pages.every(isPageUntouched) ? undefined : { pages }
}

function normaliseDslDoc(input: unknown): DslDocument | undefined {
  if (!isRecord(input)) return undefined

  const source = typeof input.source === 'string' ? input.source : ''
  const pins = normalisePins(input.pins)
  const enabled = typeof input.enabled === 'boolean' ? input.enabled : source.length > 0

  if (!source && !enabled && Object.keys(pins).length === 0) return undefined
  return { source, pins, enabled }
}

function normaliseWorkspaces(input: unknown): Record<string, LldWorkspace> {
  if (!isRecord(input)) return {}

  const out: Record<string, LldWorkspace> = {}
  for (const [scopeId, value] of Object.entries(input)) {
    if (!isRecord(value) || !Array.isArray(value.diagrams)) continue

    const diagrams = value.diagrams.filter(
      (d): d is LldWorkspace['diagrams'][number] =>
        isRecord(d) && typeof d.id === 'string' && Array.isArray(d.shapes) && Array.isArray(d.edges)
    )

    const now = new Date().toISOString()
    out[scopeId] = {
      id: str(value.id) ?? scopeId,
      scopeId: str(value.scopeId) ?? scopeId,
      componentId: str(value.componentId),
      diagramId: str(value.diagramId) ?? '',
      title: str(value.title) ?? str(value.componentLabel) ?? 'Low-level design',
      diagrams,
      activeDiagramId:
        typeof value.activeDiagramId === 'string' &&
        diagrams.some((d) => d.id === value.activeDiagramId)
          ? value.activeDiagramId
          : (diagrams[0]?.id ?? null),
      createdAt: str(value.createdAt) ?? now,
      updatedAt: str(value.updatedAt) ?? now,
    }
  }
  return out
}

/**
 * Architecture nodes briefly carried paired handles per side (`t` source over
 * `t-in` target). They now expose one handle per side, since the canvas runs in
 * ConnectionMode.Loose. Edges still pointing at a `-in` handle would reference a
 * node that no longer exists and silently stop rendering, so rewrite them.
 */
function migrateEdges(edges: unknown[]): BoardSnapshot['edges'] {
  return edges.map((edge) => {
    if (!isRecord(edge)) return edge as BoardSnapshot['edges'][number]

    const source = stripLegacyInHandle(edge.sourceHandle)
    const target = stripLegacyInHandle(edge.targetHandle)
    const data = stripAutoLineStyle(edge.data)

    if (
      source === edge.sourceHandle &&
      target === edge.targetHandle &&
      data === edge.data
    ) {
      return edge as BoardSnapshot['edges'][number]
    }

    return {
      ...edge,
      sourceHandle: source,
      targetHandle: target,
      data,
    } as BoardSnapshot['edges'][number]
  })
}

/**
 * `t-in` → `t`, and drop anything unresolvable.
 *
 * The `body` handle covers a whole icon but only mounts while a connector preset
 * is armed. An edge that stored it becomes unanchored the moment the preset is
 * cleared: React Flow cannot find the handle, so the endpoint collapses toward
 * the canvas origin and the edge renders as a long curve to nowhere. Clearing the
 * id lets the edge fall back to floating geometry, which is always resolvable.
 */
function stripLegacyInHandle(handle: unknown): unknown {
  if (typeof handle !== 'string') return handle
  if (handle === 'body') return undefined

  const match = /^([trbl])-in$/.exec(handle)
  if (match) return match[1]

  // Side handles are the only ids architecture nodes expose.
  return /^[trbl]$/.test(handle) ? handle : undefined
}

/**
 * Drop an `edgeLineStyle` of 'bezier' that was stamped automatically.
 *
 * Every connection used to inherit the default edge preset, which was 'bezier',
 * so the field records a default rather than a decision. Clearing it lets the
 * edge follow the notation table's orthogonal routing. Any other value was picked
 * deliberately in the inspector and is preserved.
 */
function stripAutoLineStyle(data: unknown): unknown {
  if (!isRecord(data)) return data
  if (data.edgeLineStyle !== 'bezier') return data
  const { edgeLineStyle: _drop, ...rest } = data
  return rest
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
