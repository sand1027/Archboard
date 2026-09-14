'use client'

import { useCallback, useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ConnectionMode,
  SelectionMode,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeChange,
  type NodeTypes,
  type OnConnect,
} from '@xyflow/react'
import { generateId } from '@/lib/canvas/ids'
import { DND_MIME } from '@/lib/canvas/dnd'
import { LldMarkerDefs, type MarkerPair } from '@/lib/canvas/markers'
import { NOTATION, cardinalityMarker } from '@/lib/canvas/notation'
import { useCanvasDrop } from '@/hooks/useCanvasDrop'
import { useEditingText } from '@/hooks/useEditingText'
import { spawnShape } from '@/lib/lld/spawnShape'
import { edgeTypeForKind, findPaletteShape, getSpec } from '@/lib/lld/specs'
import {
  LIFELINE_TOP,
  deriveActivations,
  destroyedLifelines,
  nextOrder,
  requiredLifelineHeight,
  sequenceMessages,
} from '@/lib/lld/sequenceLayout'
import { useLldStore } from '@/store/lldStore'
import { LldDiagramProvider } from './LldDiagramContext'
import LldEdgeRenderer from './LldEdgeRenderer'
import LldSequenceMessageEdge from './LldSequenceMessageEdge'
import ClassShapeNode from './nodes/ClassShapeNode'
import {
  ArtifactShapeNode,
  ComponentShapeNode,
  DeployNodeShapeNode,
  InterfaceShapeNode,
  ObjectShapeNode,
} from './nodes/StructuralNodes'
import {
  ActorShapeNode,
  LldPackageShapeNode,
  SystemBoundaryShapeNode,
  UseCaseShapeNode,
} from './nodes/UseCaseNodes'
import ErTableShapeNode from './nodes/ErTableShapeNode'
import InternalModuleShapeNode from './nodes/InternalModuleShapeNode'
import { FragmentShapeNode, LifelineShapeNode } from './nodes/SequenceNodes'
import { ActivationShapeNode } from './nodes/FlowShapes'
import {
  ApiAnnotationShapeNode,
  ApiEndpointShapeNode,
  ApiSchemaShapeNode,
} from './nodes/ApiNodes'
import {
  ActivityShapeNode,
  LldNoteShapeNode,
  StateShapeNode,
  SwimlaneShapeNode,
} from './nodes/FlowNodes'
import type { ErRelationData, LldDiagram, LldEdge, LldShape } from '@/types/lld'

// Module-level so React Flow does not remount every node on each render.
const nodeTypes: NodeTypes = {
  lldObject: ObjectShapeNode,
  lldDeployNode: DeployNodeShapeNode,
  lldArtifact: ArtifactShapeNode,
  lldComponent: ComponentShapeNode,
  lldInterface: InterfaceShapeNode,
  lldActor: ActorShapeNode,
  lldUseCase: UseCaseShapeNode,
  lldBoundary: SystemBoundaryShapeNode,
  lldPackage: LldPackageShapeNode,
  lldClass: ClassShapeNode,
  lldLifeline: LifelineShapeNode,
  lldActivation: ActivationShapeNode,
  lldFragment: FragmentShapeNode,
  lldTable: ErTableShapeNode,
  lldEndpoint: ApiEndpointShapeNode,
  lldSchema: ApiSchemaShapeNode,
  lldAnnotation: ApiAnnotationShapeNode,
  lldState: StateShapeNode,
  lldActivity: ActivityShapeNode,
  lldSwimlane: SwimlaneShapeNode,
  lldModule: InternalModuleShapeNode,
  lldNote: LldNoteShapeNode,
}

const edgeTypes: EdgeTypes = {
  lldObjectLink: LldEdgeRenderer,
  lldCommMessage: LldEdgeRenderer,
  lldDeploymentRelation: LldEdgeRenderer,
  lldComponentRelation: LldEdgeRenderer,
  lldPackageRelation: LldEdgeRenderer,
  lldUseCaseRelation: LldEdgeRenderer,
  lldClassRelation: LldEdgeRenderer,
  lldErRelation: LldEdgeRenderer,
  lldApiLink: LldEdgeRenderer,
  lldStateTransition: LldEdgeRenderer,
  lldActivityFlow: LldEdgeRenderer,
  lldInternalDependency: LldEdgeRenderer,
  lldSequenceMessage: LldSequenceMessageEdge,
}

const GRID = 16

interface LldCanvasProps {
  scopeId: string
  diagram: LldDiagram
}

export default function LldCanvas({ scopeId, diagram }: LldCanvasProps) {
  const spec = getSpec(diagram.type)
  const { screenToFlowPosition } = useReactFlow()

  const addShape = useLldStore((s) => s.addShape)
  const applyShapeChanges = useLldStore((s) => s.applyShapeChanges)
  const applyEdgeChangesFor = useLldStore((s) => s.applyEdgeChangesFor)
  const addEdgeToStore = useLldStore((s) => s.addEdge)
  const setViewport = useLldStore((s) => s.setViewport)
  const pushHistory = useLldStore((s) => s.pushHistory)
  const armedEdgeKind = useLldStore((s) => s.armedEdgeKind)
  const editingText = useEditingText()

  const snapshot = useCallback(
    () => pushHistory(scopeId, diagram.id),
    [pushHistory, scopeId, diagram.id]
  )

  const isSequence = diagram.type === 'sequence'

  // ── sequence derivations ──────────────────────────────────────────────────
  const nodes = useMemo(() => {
    if (!isSequence) return diagram.shapes as Node[]

    const activations = deriveActivations(diagram.shapes, diagram.edges)
    const destroyed = destroyedLifelines(diagram.edges)
    const messageCount = sequenceMessages(diagram.edges).length
    const minHeight = requiredLifelineHeight(messageCount)

    return diagram.shapes.map((shape) => {
      if (shape.type !== 'lldLifeline') return shape
      const top = shape.position.y
      const height = Math.max(shape.height ?? 0, minHeight)
      return {
        ...shape,
        height,
        style: { ...shape.style, height },
        data: {
          ...shape.data,
          // Derived, not stored — the legacy `activations` field was dead data.
          __activations: activations
            .filter((a) => a.lifelineId === shape.id)
            .map((a) => ({ start: a.startY - top, end: a.endY - top, depth: a.depth })),
          __destroyed: destroyed.has(shape.id),
        },
      }
    }) as Node[]
  }, [isSequence, diagram.shapes, diagram.edges])

  // Only the (glyph, colour) pairs actually in use reach <defs>.
  const markerPairs = useMemo<MarkerPair[]>(() => {
    const pairs: MarkerPair[] = []
    const push = (id: string | undefined, color: string) => {
      if (id && id !== 'none') pairs.push({ id: id as MarkerPair['id'], color })
    }

    for (const edge of diagram.edges) {
      const kind = edge.data?.kind
      if (!kind) continue
      const style = { ...NOTATION[kind], ...edge.data?.styleOverride }

      for (const color of [style.stroke, '#3B82F6']) {
        push(style.startMarker, color)
        push(style.endMarker, color)

        if (kind.startsWith('er-') && kind !== 'er-fk-ref') {
          const er = edge.data as ErRelationData
          push(cardinalityMarker(er.sourceCardinality), color)
          push(cardinalityMarker(er.targetCardinality), color)
        }
      }
    }
    return pairs
  }, [diagram.edges])

  // ── drag and drop, sharing the HLD plumbing ───────────────────────────────
  const { onDragOver, onDrop } = useCanvasDrop([
    {
      mime: DND_MIME.lldShape,
      onDrop: (itemId, position) => {
        const entry = findPaletteShape(diagram.type, itemId)
        if (!entry) return
        snapshot()
        // Lifelines must land on the shared time axis regardless of drop Y.
        const at =
          entry.spawn.shape === 'lldLifeline' ? { x: position.x, y: LIFELINE_TOP } : position
        addShape(scopeId, diagram.id, spawnShape(entry.spawn, at))
      },
    },
  ])

  // ── connections ───────────────────────────────────────────────────────────
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      const source = diagram.shapes.find((s) => s.id === connection.source)
      const target = diagram.shapes.find((s) => s.id === connection.target)
      if (!source || !target) return false

      return spec.isValidConnection({
        source,
        target,
        sourceHandle: connection.sourceHandle ?? null,
        targetHandle: connection.targetHandle ?? null,
        diagram,
      })
    },
    [diagram, spec]
  )

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target) return

      // A connector preset armed in the palette wins over the spec default.
      const kind =
        armedEdgeKind && spec.edgeKinds.includes(armedEdgeKind)
          ? armedEdgeKind
          : spec.defaultEdgeKind
      snapshot()

      const base = {
        id: generateId(),
        type: edgeTypeForKind(kind),
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
      }

      let edge: LldEdge

      if (diagram.type === 'sequence') {
        edge = { ...base, data: { kind, order: nextOrder(diagram.edges) } } as LldEdge
      } else if (diagram.type === 'er') {
        // Column handles are `col:{columnId}` — carry them into the relation so
        // SQL export can emit a precise FK.
        const sourceColumnId = columnIdFromHandle(connection.sourceHandle)
        const targetColumnId = columnIdFromHandle(connection.targetHandle)
        edge = {
          ...base,
          data: {
            kind,
            sourceCardinality: 'one',
            targetCardinality: 'zero-or-many',
            sourceColumnId,
            targetColumnId,
          },
        } as LldEdge
      } else if (diagram.type === 'api') {
        const target = diagram.shapes.find((s) => s.id === connection.target)
        const resolved =
          target?.type === 'lldAnnotation'
            ? 'api-annotation'
            : target?.type === 'lldSchema' && target.data.role === 'request'
              ? 'api-request'
              : 'api-response'
        const statusCode =
          target?.type === 'lldSchema' && target.data.role === 'response'
            ? (target.data.statusCode ?? 200)
            : undefined
        edge = {
          ...base,
          type: edgeTypeForKind(resolved),
          data: { kind: resolved, statusCode },
        } as LldEdge
      } else {
        edge = { ...base, data: { kind } } as LldEdge
      }

      addEdgeToStore(scopeId, diagram.id, edge)
    },
    [spec, diagram, snapshot, addEdgeToStore, scopeId, armedEdgeKind]
  )

  // ── changes ───────────────────────────────────────────────────────────────
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Lifelines reorder horizontally but never leave the time axis.
      const clamped = isSequence
        ? changes.map((change) => {
            if (change.type !== 'position' || !change.position) return change
            const shape = diagram.shapes.find((s) => s.id === change.id)
            if (shape?.type !== 'lldLifeline') return change
            return { ...change, position: { ...change.position, y: LIFELINE_TOP } }
          })
        : changes

      const removing = clamped.some((c) => c.type === 'remove')
      if (removing) snapshot()

      applyShapeChanges(scopeId, diagram.id, clamped)
    },
    [isSequence, diagram.shapes, diagram.id, scopeId, applyShapeChanges, snapshot]
  )

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof applyEdgeChangesFor>[2]) => {
      if (changes.some((c) => c.type === 'remove')) snapshot()
      applyEdgeChangesFor(scopeId, diagram.id, changes)
    },
    [scopeId, diagram.id, applyEdgeChangesFor, snapshot]
  )

  return (
    <LldDiagramProvider
      scopeId={scopeId}
      diagramId={diagram.id}
      diagramType={diagram.type}
      erNotation={diagram.erNotation ?? 'crowsfoot'}
    >
      <div className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={diagram.edges as Edge[]}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onMoveEnd={(_, viewport) => setViewport(scopeId, diagram.id, viewport)}
          defaultViewport={diagram.viewport}
          // No markerEnd here on purpose — NOTATION owns arrowheads.
          defaultEdgeOptions={{ animated: false }}
          snapToGrid
          snapGrid={[GRID, GRID]}
          connectionMode={ConnectionMode.Loose}
          connectionRadius={45}
          selectionMode={SelectionMode.Partial}
          multiSelectionKeyCode="Shift"
          deleteKeyCode={editingText ? null : ['Backspace', 'Delete']}
          minZoom={0.1}
          maxZoom={4}
          elevateNodesOnSelect={false}
          proOptions={{ hideAttribution: true }}
          className="bg-white"
        >
          <LldMarkerDefs pairs={markerPairs} />

          <Background variant={BackgroundVariant.Dots} gap={GRID} size={1} color="#E5E7EB" />
          <Controls showInteractive={false} className="!shadow-sm" />
          <MiniMap
            pannable
            zoomable
            nodeColor={minimapColor}
            nodeStrokeColor={() => '#CBD5E1'}
            className="!rounded-xl !border !border-slate-200"
          />

          {diagram.shapes.length === 0 && (
            <Panel position="top-center" className="!mt-16">
              <div className="max-w-sm rounded-2xl border border-slate-200 bg-white/95 px-6 py-5 text-center shadow-lg shadow-slate-200/50">
                <p className="text-sm font-semibold text-slate-800">{spec.label} diagram</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  {spec.description}. Drag a shape from the palette to start.
                </p>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </LldDiagramProvider>
  )
}

function columnIdFromHandle(handle: string | null | undefined): string | undefined {
  if (!handle?.startsWith('col:')) return undefined
  return handle.slice(4).replace(/-in$/, '')
}

function minimapColor(node: Node): string {
  const map: Record<string, string> = {
    lldObject: '#EDE9FE',
    lldDeployNode: '#E0F2FE',
    lldArtifact: '#FEF9C3',
    lldComponent: '#DDD6FE',
    lldInterface: '#F1F5F9',
    lldActor: '#FEF3C7',
    lldUseCase: '#DBEAFE',
    lldBoundary: '#F8FAFC',
    lldPackage: '#F1F5F9',
    lldClass: '#DBEAFE',
    lldTable: '#DCFCE7',
    lldLifeline: '#E0E7FF',
    lldFragment: '#F1F5F9',
    lldEndpoint: '#FEF3C7',
    lldSchema: '#F3E8FF',
    lldAnnotation: '#FFEDD5',
    lldState: '#CFFAFE',
    lldActivity: '#E0F2FE',
    lldSwimlane: '#F8FAFC',
    lldModule: '#EDE9FE',
    lldNote: '#FEF9C3',
  }
  return map[node.type ?? ''] ?? '#E2E8F0'
}
