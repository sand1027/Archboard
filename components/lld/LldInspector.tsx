'use client'

import { MousePointer2 } from 'lucide-react'
import { EDGE_KIND_LABEL } from '@/lib/canvas/notation'
import { getSpec, edgeTypeForKind } from '@/lib/lld/specs'
import { generatePrefixedId } from '@/lib/canvas/ids'
import { useLldStore } from '@/store/lldStore'
import {
  MULTIPLICITIES,
  type ClassShapeData,
  type ErTableShapeData,
  type LldDiagram,
  type LldEdge,
  type LldEdgeKind,
  type LldShape,
  type PortSide,
} from '@/types/lld'

/**
 * Property inspector. Dispatches on the selected shape/edge discriminant, with
 * the edge-kind dropdown populated from the active diagram's spec so an ER
 * relation can never be set to a class stereotype.
 */
export default function LldInspector({
  scopeId,
  diagram,
}: {
  scopeId: string
  diagram: LldDiagram
}) {
  const selectedShapes = diagram.shapes.filter((s) => s.selected)
  const selectedEdges = diagram.edges.filter((e) => e.selected)

  const shape = selectedShapes.length === 1 ? selectedShapes[0] : null
  const edge = selectedEdges.length === 1 ? selectedEdges[0] : null
  const multi = selectedShapes.length + selectedEdges.length > 1

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-200/80 bg-slate-50/80 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Properties
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">
          {shape
            ? shapeTitle(shape)
            : edge
              ? (EDGE_KIND_LABEL[edge.data?.kind as LldEdgeKind] ?? 'Connection')
              : multi
                ? `${selectedShapes.length + selectedEdges.length} selected`
                : diagram.name}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {shape && <ShapeInspector scopeId={scopeId} diagram={diagram} shape={shape} />}
        {edge && <EdgeInspector scopeId={scopeId} diagram={diagram} edge={edge} />}
        {!shape && !edge && !multi && <DiagramInspector scopeId={scopeId} diagram={diagram} />}
        {multi && (
          <p className="p-4 text-xs text-slate-500">
            {selectedShapes.length} shape(s) and {selectedEdges.length} connection(s) selected.
            Press Delete to remove them.
          </p>
        )}
      </div>
    </div>
  )
}

// ─── diagram-level ───────────────────────────────────────────────────────────

function DiagramInspector({
  scopeId,
  diagram,
}: {
  scopeId: string
  diagram: LldDiagram
}) {
  const renameDiagram = useLldStore((s) => s.renameDiagram)
  const setErNotation = useLldStore((s) => s.setErNotation)
  const spec = getSpec(diagram.type)

  return (
    <div className="space-y-4 p-4">
      <Field label="Diagram name">
        <input
          className="field-input"
          value={diagram.name}
          onChange={(e) => renameDiagram(scopeId, diagram.id, e.target.value)}
        />
      </Field>

      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Type
        </p>
        <p className="text-sm text-slate-800">{spec.label}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{spec.description}</p>
      </div>

      {diagram.type === 'er' && (
        <Field label="Relationship notation">
          <select
            className="field-input"
            value={diagram.erNotation ?? 'crowsfoot'}
            onChange={(e) =>
              setErNotation(scopeId, diagram.id, e.target.value as 'crowsfoot' | 'uml')
            }
          >
            <option value="crowsfoot">Crow&apos;s foot</option>
            <option value="uml">UML multiplicity</option>
          </select>
        </Field>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p className="text-xs text-slate-600">
          {diagram.shapes.length} shape{diagram.shapes.length === 1 ? '' : 's'} ·{' '}
          {diagram.edges.length} connection{diagram.edges.length === 1 ? '' : 's'}
        </p>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-400">
        Select a shape or connection to edit it. Double-click any shape on the canvas to edit it in
        place.
      </p>
    </div>
  )
}

// ─── shapes ──────────────────────────────────────────────────────────────────

function ShapeInspector({
  scopeId,
  diagram,
  shape,
}: {
  scopeId: string
  diagram: LldDiagram
  shape: LldShape
}) {
  const updateShape = useLldStore((s) => s.updateShape)
  const removeShape = useLldStore((s) => s.removeShape)
  const set = (data: Partial<LldShape['data']>) =>
    updateShape(scopeId, diagram.id, shape.id, data)

  return (
    <div className="space-y-4 p-4">
      <Field label="Label">
        <input
          className="field-input"
          value={String(shape.data.label ?? '')}
          onChange={(e) => set({ label: e.target.value })}
        />
      </Field>

      {shape.type === 'lldActor' && (
        <>
          <Checkbox
            label="External system (non-human actor)"
            checked={Boolean(shape.data.isSystem)}
            onChange={(v) => set({ isSystem: v })}
          />
          <Checkbox
            label="Primary actor"
            checked={shape.data.isPrimary !== false}
            onChange={(v) => set({ isPrimary: v })}
          />
        </>
      )}
      {shape.type === 'lldUseCase' && <UseCaseFields shape={shape} set={set} />}
      {shape.type === 'lldBoundary' && (
        <Field label="Stereotype">
          <input
            className="field-input"
            placeholder="system"
            value={shape.data.stereotype ?? ''}
            onChange={(e) => set({ stereotype: e.target.value })}
          />
        </Field>
      )}
      {shape.type === 'lldClass' && <ClassFields shape={shape} set={set} />}
      {shape.type === 'lldTable' && <TableFields shape={shape} set={set} />}
      {shape.type === 'lldLifeline' && (
        <Field label="Kind">
          <select
            className="field-input"
            value={shape.data.lifelineKind}
            onChange={(e) => set({ lifelineKind: e.target.value })}
          >
            {['actor', 'participant', 'boundary', 'control', 'entity'].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </Field>
      )}
      {shape.type === 'lldFragment' && <FragmentFields shape={shape} set={set} />}
      {shape.type === 'lldEndpoint' && <EndpointFields shape={shape} set={set} />}
      {shape.type === 'lldSchema' && <SchemaFields shape={shape} set={set} />}
      {shape.type === 'lldAnnotation' && (
        <>
          <Field label="Kind">
            <select
              className="field-input"
              value={shape.data.annotationKind}
              onChange={(e) => set({ annotationKind: e.target.value })}
            >
              {['auth', 'rate-limit', 'middleware', 'cache'].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Detail">
            <input
              className="field-input"
              value={shape.data.detail}
              onChange={(e) => set({ detail: e.target.value })}
            />
          </Field>
        </>
      )}
      {shape.type === 'lldState' && <StateFields shape={shape} set={set} />}
      {shape.type === 'lldActivity' && <ActivityFields shape={shape} set={set} />}
      {shape.type === 'lldModule' && (
        <ModuleFields scopeId={scopeId} diagram={diagram} shape={shape} set={set} />
      )}
      {shape.type === 'lldNote' && (
        <Field label="Text">
          <textarea
            className="field-input min-h-[100px]"
            value={shape.data.text}
            onChange={(e) => set({ text: e.target.value })}
          />
        </Field>
      )}

      <DeleteButton
        label="Delete shape"
        onClick={() => removeShape(scopeId, diagram.id, shape.id)}
      />
    </div>
  )
}

type Setter = (data: Partial<LldShape['data']>) => void

function UseCaseFields({
  shape,
  set,
}: {
  shape: Extract<LldShape, { type: 'lldUseCase' }>
  set: Setter
}) {
  return (
    <>
      <Checkbox
        label="Abstract (only reached via include / extend)"
        checked={Boolean(shape.data.isAbstract)}
        onChange={(v) => set({ isAbstract: v })}
      />
      <Field label="Extension points (one per line)">
        <textarea
          className="field-input min-h-[70px] font-mono text-xs"
          placeholder={'Payment selected\nItem out of stock'}
          value={shape.data.extensionPoints.map((ep) => ep.name).join('\n')}
          onChange={(e) =>
            set({
              extensionPoints: e.target.value
                .split('\n')
                .map((name, i) => ({
                  id: shape.data.extensionPoints[i]?.id ?? generatePrefixedId('ep'),
                  name,
                  location: shape.data.extensionPoints[i]?.location,
                }))
                .filter((ep) => ep.name.trim() !== ''),
            })
          }
        />
      </Field>
      <Hint>
        An «extend» relationship can target one of these points, which is where the optional
        behaviour attaches.
      </Hint>
    </>
  )
}

function ClassFields({
  shape,
  set,
}: {
  shape: Extract<LldShape, { type: 'lldClass' }>
  set: Setter
}) {
  const data = shape.data as ClassShapeData
  return (
    <>
      <Field label="Stereotype">
        <select
          className="field-input"
          value={data.stereotype}
          onChange={(e) => set({ stereotype: e.target.value })}
        >
          {[
            'class',
            'interface',
            'abstract',
            'enum',
            'struct',
            'datatype',
            'primitive',
            'utility',
            'exception',
            'template',
            'boundary',
            'control',
            'entity',
          ].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Generics">
        <input
          className="field-input"
          placeholder="<T>"
          value={data.generics ?? ''}
          onChange={(e) => set({ generics: e.target.value })}
        />
      </Field>
      <Hint>
        Double-click the field or method compartment on the canvas to bulk edit. Use{' '}
        <code>+ - # ~</code> for visibility.
      </Hint>
    </>
  )
}

function TableFields({
  shape,
  set,
}: {
  shape: Extract<LldShape, { type: 'lldTable' }>
  set: Setter
}) {
  const data = shape.data as ErTableShapeData
  return (
    <>
      <Field label="Kind">
        <select
          className="field-input"
          value={data.tableKind}
          onChange={(e) => set({ tableKind: e.target.value })}
        >
          <option value="table">Table</option>
          <option value="view">View</option>
        </select>
      </Field>
      {data.tableKind === 'view' && (
        <Field label="View query">
          <textarea
            className="field-input min-h-[80px] font-mono text-xs"
            placeholder="SELECT …"
            value={data.viewQuery ?? ''}
            onChange={(e) => set({ viewQuery: e.target.value })}
          />
        </Field>
      )}
      <Field label="Indexes">
        <textarea
          className="field-input min-h-[60px] font-mono text-xs"
          placeholder="idx_name: col_a, col_b"
          value={data.indexes
            .map(
              (i) =>
                `${i.isUnique ? 'unique ' : ''}${i.name}: ${i.columnIds
                  .map((cid) => data.columns.find((c) => c.id === cid)?.name ?? '')
                  .filter(Boolean)
                  .join(', ')}`
            )
            .join('\n')}
          onChange={(e) =>
            set({
              indexes: e.target.value
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                  const isUnique = /^unique\s+/i.test(line)
                  const rest = line.replace(/^unique\s+/i, '')
                  const [name, cols = ''] = rest.split(':')
                  return {
                    id: generatePrefixedId('idx'),
                    name: name.trim() || 'idx',
                    isUnique: isUnique || undefined,
                    columnIds: cols
                      .split(',')
                      .map((c) => c.trim())
                      .filter(Boolean)
                      .map((c) => data.columns.find((col) => col.name === c)?.id)
                      .filter((id): id is string => Boolean(id)),
                  }
                }),
            })
          }
        />
      </Field>
      <Hint>
        Double-click the column area on the canvas to bulk edit. Prefix lines with{' '}
        <code>pk</code>, <code>fk</code>, <code>uq</code> or <code>null</code>.
      </Hint>
    </>
  )
}

function FragmentFields({
  shape,
  set,
}: {
  shape: Extract<LldShape, { type: 'lldFragment' }>
  set: Setter
}) {
  return (
    <>
      <Field label="Operator">
        <select
          className="field-input"
          value={shape.data.operator}
          onChange={(e) => set({ operator: e.target.value })}
        >
          {['alt', 'opt', 'loop', 'par', 'critical', 'ref'].map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Operand guards (one per line)">
        <textarea
          className="field-input min-h-[70px] font-mono text-xs"
          value={shape.data.operands.map((o) => o.guard).join('\n')}
          onChange={(e) =>
            set({
              operands: e.target.value.split('\n').map((guard, i) => ({
                id: shape.data.operands[i]?.id ?? generatePrefixedId('op'),
                guard,
              })),
            })
          }
        />
      </Field>
      <Hint>
        Assign messages to this fragment from the connection inspector, so export stays correct
        regardless of where the frame sits.
      </Hint>
    </>
  )
}

function EndpointFields({
  shape,
  set,
}: {
  shape: Extract<LldShape, { type: 'lldEndpoint' }>
  set: Setter
}) {
  return (
    <>
      <Field label="Method">
        <select
          className="field-input"
          value={shape.data.method}
          onChange={(e) => set({ method: e.target.value })}
        >
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Path">
        <input
          className="field-input font-mono text-xs"
          value={shape.data.path}
          onChange={(e) => set({ path: e.target.value })}
        />
      </Field>
      <Field label="Summary">
        <input
          className="field-input"
          value={shape.data.summary ?? ''}
          onChange={(e) => set({ summary: e.target.value })}
        />
      </Field>
      <Field label="Operation ID">
        <input
          className="field-input font-mono text-xs"
          value={shape.data.operationId ?? ''}
          onChange={(e) => set({ operationId: e.target.value })}
        />
      </Field>
    </>
  )
}

function SchemaFields({
  shape,
  set,
}: {
  shape: Extract<LldShape, { type: 'lldSchema' }>
  set: Setter
}) {
  return (
    <>
      <Field label="Role">
        <select
          className="field-input"
          value={shape.data.role}
          onChange={(e) => set({ role: e.target.value })}
        >
          <option value="request">Request</option>
          <option value="response">Response</option>
        </select>
      </Field>
      {shape.data.role === 'response' && (
        <Field label="Status code">
          <input
            type="number"
            className="field-input"
            value={shape.data.statusCode ?? 200}
            onChange={(e) => set({ statusCode: Number(e.target.value) })}
          />
        </Field>
      )}
      <Field label="Content type">
        <input
          className="field-input font-mono text-xs"
          value={shape.data.contentType}
          onChange={(e) => set({ contentType: e.target.value })}
        />
      </Field>
      <Hint>
        Double-click the field list on the canvas to bulk edit. Suffix a name with <code>?</code>{' '}
        to mark it optional.
      </Hint>
    </>
  )
}

function StateFields({
  shape,
  set,
}: {
  shape: Extract<LldShape, { type: 'lldState' }>
  set: Setter
}) {
  return (
    <>
      <Field label="Kind">
        <select
          className="field-input"
          value={shape.data.stateKind}
          onChange={(e) => set({ stateKind: e.target.value })}
        >
          {[
            'initial',
            'state',
            'composite',
            'submachine',
            'final',
            'choice',
            'junction',
            'fork',
            'join',
            'history-shallow',
            'history-deep',
            'entry-point',
            'exit-point',
            'terminate',
          ].map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </Field>
      {shape.data.stateKind === 'state' && (
        <>
          <Field label="Entry action">
            <input
              className="field-input font-mono text-xs"
              value={shape.data.entryAction ?? ''}
              onChange={(e) => set({ entryAction: e.target.value })}
            />
          </Field>
          <Field label="Do activity">
            <input
              className="field-input font-mono text-xs"
              value={shape.data.doActivity ?? ''}
              onChange={(e) => set({ doActivity: e.target.value })}
            />
          </Field>
          <Field label="Exit action">
            <input
              className="field-input font-mono text-xs"
              value={shape.data.exitAction ?? ''}
              onChange={(e) => set({ exitAction: e.target.value })}
            />
          </Field>
        </>
      )}
    </>
  )
}

function ActivityFields({
  shape,
  set,
}: {
  shape: Extract<LldShape, { type: 'lldActivity' }>
  set: Setter
}) {
  return (
    <>
      <Field label="Kind">
        <select
          className="field-input"
          value={shape.data.activityKind}
          onChange={(e) => set({ activityKind: e.target.value })}
        >
          {[
            'start',
            'end',
            'action',
            'decision',
            'merge',
            'fork',
            'join',
            'data',
            'document',
            'multi-document',
            'manual-input',
            'manual-operation',
            'display',
            'delay',
            'preparation',
            'predefined',
            'loop-limit',
            'database',
            'stored-data',
            'internal-storage',
            'tape',
            'connector',
            'off-page',
            'or',
            'summing-junction',
            'extract',
            'send-signal',
            'receive-signal',
            'time-event',
            'object-node',
            'final-flow',
          ].map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </Field>
      {(shape.data.activityKind === 'fork' || shape.data.activityKind === 'join') && (
        <Field label="Orientation">
          <select
            className="field-input"
            value={shape.data.orientation ?? 'horizontal'}
            onChange={(e) => set({ orientation: e.target.value })}
          >
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
          </select>
        </Field>
      )}
    </>
  )
}

function ModuleFields({
  scopeId,
  diagram,
  shape,
  set,
}: {
  scopeId: string
  diagram: LldDiagram
  shape: Extract<LldShape, { type: 'lldModule' }>
  set: Setter
}) {
  return (
    <>
      <Field label="Layer">
        <select
          className="field-input"
          value={shape.data.layer}
          onChange={(e) => set({ layer: e.target.value })}
        >
          {['controller', 'service', 'repository', 'adapter', 'domain', 'custom'].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Technology">
        <input
          className="field-input"
          placeholder="e.g. Express, Prisma"
          value={shape.data.technology ?? ''}
          onChange={(e) => set({ technology: e.target.value })}
        />
      </Field>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Ports
        </p>
        <div className="space-y-1.5">
          {shape.data.ports.map((port) => (
            <div key={port.id} className="flex items-center gap-1.5">
              <input
                className="field-input flex-1"
                value={port.name}
                aria-label="Port name"
                onChange={(e) =>
                  set({
                    ports: shape.data.ports.map((p) =>
                      p.id === port.id ? { ...p, name: e.target.value } : p
                    ),
                  })
                }
              />
              <select
                className="field-input w-20"
                value={port.side}
                aria-label="Port side"
                onChange={(e) =>
                  set({
                    ports: shape.data.ports.map((p) =>
                      p.id === port.id ? { ...p, side: e.target.value as PortSide } : p
                    ),
                  })
                }
              >
                {(['top', 'right', 'bottom', 'left'] as PortSide[]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="field-input w-24"
                value={port.direction}
                aria-label="Port direction"
                onChange={(e) =>
                  set({
                    ports: shape.data.ports.map((p) =>
                      p.id === port.id
                        ? { ...p, direction: e.target.value as 'provided' | 'required' }
                        : p
                    ),
                  })
                }
              >
                <option value="provided">provided</option>
                <option value="required">required</option>
              </select>
              <button
                type="button"
                aria-label={`Remove port ${port.name}`}
                onClick={() => set({ ports: shape.data.ports.filter((p) => p.id !== port.id) })}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              set({
                ports: [
                  ...shape.data.ports,
                  {
                    id: generatePrefixedId('p'),
                    name: `port${shape.data.ports.length + 1}`,
                    side: 'right' as PortSide,
                    offset: 0.5,
                    direction: 'provided' as const,
                  },
                ],
              })
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50"
          >
            Add port
          </button>
        </div>
      </div>
    </>
  )
}

// ─── edges ───────────────────────────────────────────────────────────────────

function EdgeInspector({
  scopeId,
  diagram,
  edge,
}: {
  scopeId: string
  diagram: LldDiagram
  edge: LldEdge
}) {
  const updateEdge = useLldStore((s) => s.updateEdge)
  const removeEdge = useLldStore((s) => s.removeEdge)
  const setEdges = useLldStore((s) => s.setEdges)
  const spec = getSpec(diagram.type)

  const data = edge.data
  if (!data) return null

  const set = (patch: Partial<LldEdge['data']>) =>
    updateEdge(scopeId, diagram.id, edge.id, patch)

  // Changing kind can change which React Flow edge component renders it.
  const changeKind = (kind: LldEdgeKind) => {
    const nextType = edgeTypeForKind(kind)
    setEdges(
      scopeId,
      diagram.id,
      diagram.edges.map((e) =>
        e.id === edge.id
          ? ({ ...e, type: nextType, data: { ...e.data, kind } } as LldEdge)
          : e
      )
    )
  }

  const isUseCase = spec.type === 'usecase'
  const isClass = spec.type === 'class'
  const isEr = spec.type === 'er'
  const isSequence = spec.type === 'sequence'
  const isState = spec.type === 'state'
  const isActivity = spec.type === 'activity'

  const fragments = diagram.shapes.filter((s) => s.type === 'lldFragment')

  return (
    <div className="space-y-4 p-4">
      <Field label="Relationship">
        <select
          className="field-input"
          value={String(data.kind)}
          onChange={(e) => changeKind(e.target.value as LldEdgeKind)}
        >
          {spec.edgeKinds.map((k) => (
            <option key={k} value={k}>
              {EDGE_KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Label">
        <input
          className="field-input"
          value={String(data.label ?? '')}
          onChange={(e) => set({ label: e.target.value })}
        />
      </Field>

      {isUseCase && (
        <>
          {data.kind === 'uc-association' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Actor mult.">
                  <select
                    className="field-input"
                    value={String(data.sourceMultiplicity ?? '')}
                    onChange={(e) => set({ sourceMultiplicity: e.target.value || undefined })}
                  >
                    <option value="">—</option>
                    {MULTIPLICITIES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Use case mult.">
                  <select
                    className="field-input"
                    value={String(data.targetMultiplicity ?? '')}
                    onChange={(e) => set({ targetMultiplicity: e.target.value || undefined })}
                  >
                    <option value="">—</option>
                    {MULTIPLICITIES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Checkbox
                label="Directed (show arrowhead)"
                checked={Boolean(data.isDirected)}
                onChange={(v) => set({ isDirected: v })}
              />
            </>
          )}

          {data.kind === 'uc-extend' && (
            <>
              <Field label="Condition">
                <input
                  className="field-input"
                  placeholder="customer requests gift wrap"
                  value={String(data.condition ?? '')}
                  onChange={(e) => set({ condition: e.target.value })}
                />
              </Field>
              <ExtensionPointPicker diagram={diagram} edge={edge} data={data} set={set} />
            </>
          )}

          {(data.kind === 'uc-include' || data.kind === 'uc-extend') && (
            <Hint>
              «include» means the base use case <em>always</em> runs this one. «extend» means it
              runs only when the condition holds.
            </Hint>
          )}
        </>
      )}

      {isClass && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Source mult.">
              <select
                className="field-input"
                value={String(data.sourceMultiplicity ?? '')}
                onChange={(e) => set({ sourceMultiplicity: e.target.value || undefined })}
              >
                <option value="">—</option>
                {MULTIPLICITIES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Target mult.">
              <select
                className="field-input"
                value={String(data.targetMultiplicity ?? '')}
                onChange={(e) => set({ targetMultiplicity: e.target.value || undefined })}
              >
                <option value="">—</option>
                {MULTIPLICITIES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {data.kind === 'association' && (
            <Checkbox
              label="Directed (show arrowhead)"
              checked={Boolean(data.isDirected)}
              onChange={(v) => set({ isDirected: v })}
            />
          )}
        </>
      )}

      {isEr && data.kind !== 'er-fk-ref' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Source card.">
            <select
              className="field-input"
              value={String(data.sourceCardinality ?? 'one')}
              onChange={(e) => set({ sourceCardinality: e.target.value })}
            >
              {['one', 'zero-or-one', 'one-or-many', 'zero-or-many'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Target card.">
            <select
              className="field-input"
              value={String(data.targetCardinality ?? 'zero-or-many')}
              onChange={(e) => set({ targetCardinality: e.target.value })}
            >
              {['one', 'zero-or-one', 'one-or-many', 'zero-or-many'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {isEr && (
        <Field label="On delete">
          <select
            className="field-input"
            value={String(data.onDelete ?? '')}
            onChange={(e) => set({ onDelete: e.target.value || undefined })}
          >
            <option value="">—</option>
            {['cascade', 'restrict', 'set-null', 'no-action'].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      )}

      {isSequence && (
        <>
          <Field label="Order">
            <input
              type="number"
              min={0}
              className="field-input"
              value={Number(data.order ?? 0)}
              onChange={(e) => set({ order: Math.max(0, Number(e.target.value)) })}
            />
          </Field>
          {fragments.length > 0 && (
            <Field label="Inside fragment">
              <select
                className="field-input"
                value={String(data.fragmentId ?? '')}
                onChange={(e) =>
                  set({ fragmentId: e.target.value || undefined, operandId: undefined })
                }
              >
                <option value="">—</option>
                {fragments.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.type === 'lldFragment' ? f.data.operator : ''} · {f.id.slice(0, 6)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {data.fragmentId ? <OperandPicker diagram={diagram} data={data} set={set} /> : null}
        </>
      )}

      {isState && (
        <>
          <Field label="Event">
            <input
              className="field-input"
              value={String(data.event ?? '')}
              onChange={(e) => set({ event: e.target.value })}
            />
          </Field>
          <Field label="Guard">
            <input
              className="field-input"
              placeholder="condition"
              value={String(data.guard ?? '')}
              onChange={(e) => set({ guard: e.target.value })}
            />
          </Field>
          <Field label="Action">
            <input
              className="field-input"
              value={String(data.action ?? '')}
              onChange={(e) => set({ action: e.target.value })}
            />
          </Field>
          <Hint>
            Rendered as <code>event [guard] / action</code> unless you set an explicit label.
          </Hint>
        </>
      )}

      {isActivity && (
        <Field label="Condition">
          <input
            className="field-input"
            placeholder="yes / no"
            value={String(data.condition ?? '')}
            onChange={(e) => set({ condition: e.target.value, label: e.target.value })}
          />
        </Field>
      )}

      <DeleteButton
        label="Delete connection"
        onClick={() => removeEdge(scopeId, diagram.id, edge.id)}
      />
    </div>
  )
}

/** Extension points live on the base use case, which is the edge's target. */
function ExtensionPointPicker({
  diagram,
  edge,
  data,
  set,
}: {
  diagram: LldDiagram
  edge: LldEdge
  data: NonNullable<LldEdge['data']>
  set: (patch: Partial<LldEdge['data']>) => void
}) {
  const base = diagram.shapes.find((s) => s.id === edge.target)
  if (base?.type !== 'lldUseCase') return null

  if (base.data.extensionPoints.length === 0) {
    return (
      <Hint>
        “{base.data.label}” has no extension points yet — add them on that use case to target one.
      </Hint>
    )
  }

  return (
    <Field label="Extension point">
      <select
        className="field-input"
        value={String(data.extensionPointId ?? '')}
        onChange={(e) => set({ extensionPointId: e.target.value || undefined })}
      >
        <option value="">—</option>
        {base.data.extensionPoints.map((ep) => (
          <option key={ep.id} value={ep.id}>
            {ep.name}
          </option>
        ))}
      </select>
    </Field>
  )
}

function OperandPicker({
  diagram,
  data,
  set,
}: {
  diagram: LldDiagram
  data: NonNullable<LldEdge['data']>
  set: (patch: Partial<LldEdge['data']>) => void
}) {
  const fragment = diagram.shapes.find((s) => s.id === data.fragmentId)
  if (fragment?.type !== 'lldFragment') return null

  return (
    <Field label="Operand">
      <select
        className="field-input"
        value={String(data.operandId ?? '')}
        onChange={(e) => set({ operandId: e.target.value || undefined })}
      >
        <option value="">first</option>
        {fragment.data.operands.map((o, i) => (
          <option key={o.id} value={o.id}>
            {i + 1}. {o.guard || '(no guard)'}
          </option>
        ))}
      </select>
    </Field>
  )
}

// ─── primitives ──────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </label>
      {children}
    </div>
  )
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-slate-400">{children}</p>
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-100/80"
    >
      {label}
    </button>
  )
}

function shapeTitle(shape: LldShape): string {
  switch (shape.type) {
    case 'lldObject':
      return shape.data.isMultiObject ? 'Multi-object' : 'Object'
    case 'lldDeployNode':
      return shape.data.nodeKind === 'device'
        ? 'Device'
        : shape.data.nodeKind === 'execution-environment'
          ? 'Execution environment'
          : 'Node'
    case 'lldArtifact':
      return 'Artifact'
    case 'lldComponent':
      return 'Component'
    case 'lldInterface':
      return shape.data.direction === 'provided' ? 'Provided interface' : 'Required interface'
    case 'lldActor':
      return shape.data.isSystem ? 'External system' : 'Actor'
    case 'lldUseCase':
      return 'Use case'
    case 'lldBoundary':
      return 'System boundary'
    case 'lldPackage':
      return 'Package'
    case 'lldClass':
      return shape.data.stereotype === 'class' ? 'Class' : capitalise(shape.data.stereotype)
    case 'lldLifeline':
      return capitalise(shape.data.lifelineKind)
    case 'lldActivation':
      return 'Activation bar'
    case 'lldFragment':
      return `Fragment · ${shape.data.operator}`
    case 'lldTable':
      return shape.data.tableKind === 'view' ? 'View' : 'Table'
    case 'lldEndpoint':
      return 'Endpoint'
    case 'lldSchema':
      return shape.data.role === 'request' ? 'Request schema' : 'Response schema'
    case 'lldAnnotation':
      return 'Annotation'
    case 'lldState':
      return `${capitalise(shape.data.stateKind)} state`
    case 'lldActivity':
      return capitalise(shape.data.activityKind)
    case 'lldSwimlane':
      return 'Swimlane'
    case 'lldModule':
      return capitalise(shape.data.layer)
    case 'lldNote':
      return 'Note'
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
