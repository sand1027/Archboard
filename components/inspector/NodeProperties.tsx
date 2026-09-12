'use client'

import { useCallback, useMemo } from 'react'
import { Copy, Trash2, Link } from 'lucide-react'
import Image from 'next/image'
import { useDiagramStore } from '@/store/diagramStore'
import { useHistoryStore } from '@/store/historyStore'
import { useEstimateStore } from '@/store/estimateStore'
import { getComponentById } from '@/data/components'
import { MAX_SERVICE_MS, MIN_SERVICE_MS, nodeCapacity } from '@/lib/simulation/capacity'
import {
  instanceProfile,
  sizing,
  totalMemoryGb,
  totalVcpu,
} from '@/lib/simulation/instances'
import { estimate, peakQpsFrom } from '@/lib/estimate/workload'
import { formatRate } from '@/lib/estimate/format'
import { readDataString } from '@/lib/simulation/traversal'
import { configGroupsFor, type ConfigField } from '@/lib/config/fields'
import type { ArchitectureNodeData, ConfigValue } from '@/types/architecture'
import type { Node } from '@xyflow/react'

type ArchitectureNodeFull = Node<ArchitectureNodeData, 'architecture'>

interface NodePropertiesProps {
  node: ArchitectureNodeFull
}

export default function NodeProperties({ node }: NodePropertiesProps) {
  const { updateNode, deleteNode, duplicateNodes, nodes, edges } = useDiagramStore()
  const { pushSnapshot } = useHistoryStore()

  const component = getComponentById(node.data.componentId)

  /**
   * What this component talks to, and which way round.
   *
   * A count alone told you there were four connections but not to what — and direction is
   * what decides whether traffic flows through this node in a simulation, so it is the
   * detail worth showing.
   */
  const connections = useMemo(() => {
    const labelOf = (id: string) => {
      const found = nodes.find((n) => n.id === id)
      return readDataString(found?.data, 'label') ?? id.slice(0, 8)
    }

    return edges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => {
        const outbound = e.source === node.id
        const otherId = outbound ? e.target : e.source
        return {
          id: e.id,
          outbound,
          label: labelOf(otherId),
          protocol: readDataString(e.data, 'protocol'),
        }
      })
      // Outbound first: what this component depends on is usually the question.
      .sort((a, b) => Number(b.outbound) - Number(a.outbound) || a.label.localeCompare(b.label))
  }, [edges, nodes, node.id])

  const handleLabelChange = useCallback(
    (value: string) => {
      updateNode(node.id, { label: value } as Partial<ArchitectureNodeData>)
    },
    [node.id, updateNode]
  )

  // Placeholders show what the simulation would use with nothing entered, so the user is
  // never guessing what "blank" means.
  const capacityDefaults = nodeCapacity({ category: node.data.category })
  const profile = instanceProfile(node.data)
  const capacity = nodeCapacity(node.data)

  // Sizing needs a workload to size against. Peak QPS is the figure the whole capacity
  // panel builds toward, so a component is judged against the same number.
  const workloadInputs = useEstimateStore((s) => s.inputs)
  const workloadOverrides = useEstimateStore((s) => s.overrides)
  const peakQps = useMemo(
    () => peakQpsFrom(estimate(workloadInputs, workloadOverrides)),
    [workloadInputs, workloadOverrides]
  )
  const nodeSizing = useMemo(() => {
    const result = sizing(peakQps, capacity.serviceMs, profile)
    // 'idle' means there is no load to judge against; saying nothing beats saying 0%.
    return result.verdict === 'idle' ? null : result
  }, [peakQps, capacity.serviceMs, profile])

  const configGroups = useMemo(
    () => configGroupsFor(node.data.componentId, node.data.category),
    [node.data.componentId, node.data.category]
  )

  const handleConfigChange = useCallback(
    (key: string, value: ConfigValue | undefined) => {
      const next = { ...(node.data.config ?? {}) }
      // Clearing a field removes the key rather than storing '' or 0, so "unset" stays
      // distinguishable from "deliberately zero".
      if (value === undefined || value === '') delete next[key]
      else next[key] = value

      updateNode(node.id, { config: next } as Partial<ArchitectureNodeData>)
    },
    [node.id, node.data.config, updateNode]
  )

  const handleCapacityChange = useCallback(
    (
      field: 'serviceMs' | 'concurrency' | 'instances' | 'vcpu' | 'memoryGb',
      raw: string
    ) => {
      // Empty clears the override and hands the node back to its category default.
      // Storing 0 instead would silently pin a database at zero service time.
      const trimmed = raw.trim()
      const parsed = trimmed === '' ? undefined : Number(trimmed)
      if (parsed !== undefined && !Number.isFinite(parsed)) return

      updateNode(node.id, { [field]: parsed } as Partial<ArchitectureNodeData>)
    },
    [node.id, updateNode]
  )

  const handleDelete = useCallback(() => {
    const { nodes: n, edges: e } = useDiagramStore.getState()
    pushSnapshot({ nodes: n, edges: e })
    deleteNode(node.id)
  }, [node.id, deleteNode, pushSnapshot])

  const handleDuplicate = useCallback(() => {
    const { nodes: n, edges: e } = useDiagramStore.getState()
    pushSnapshot({ nodes: n, edges: e })
    duplicateNodes([node.id])
  }, [node.id, duplicateNodes, pushSnapshot])

  return (
    <div className="divide-y divide-slate-100">
      {/* Node header */}
      <div className="p-4 flex items-start gap-3">
        <div className="relative w-10 h-10 flex-shrink-0 bg-slate-50 rounded-xl border border-slate-100 p-1.5 flex items-center justify-center">
          <Image
            src={node.data.icon}
            alt={node.data.label}
            width={32}
            height={32}
            className="w-8 h-8 object-contain"
            unoptimized
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
            {node.data.provider ? `${node.data.provider} · ` : ''}
            {node.data.category}
          </p>
          <p className="text-sm font-semibold text-slate-900 truncate">{node.data.label}</p>
        </div>
      </div>

      {/* Label editor */}
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Label
          </label>
          <input
            type="text"
            value={node.data.label}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="field-input"
          />
        </div>

        {node.data.subtitle !== undefined && (
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Subtitle
            </label>
            <input
              type="text"
              value={node.data.subtitle ?? ''}
              onChange={(e) =>
                updateNode(node.id, {
                  subtitle: e.target.value,
                } as Partial<ArchitectureNodeData>)
              }
              placeholder="Optional subtitle"
              className="field-input"
            />
          </div>
        )}
      </div>

      {/* Component info */}
      <div className="p-4 space-y-3">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Component
        </p>

        <InfoRow label="Name" value={component?.name ?? node.data.componentId} />
        <InfoRow label="Category" value={node.data.category} capitalize />
        {node.data.provider && (
          <InfoRow label="Provider" value={node.data.provider.toUpperCase()} />
        )}
        {component?.description && (
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Description</p>
            <p className="text-xs text-slate-600 leading-relaxed">{component.description}</p>
          </div>
        )}

        <div className="pt-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <Link className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-500">
              {connections.length} connection{connections.length !== 1 ? 's' : ''}
            </span>
          </div>

          {connections.length > 0 && (
            <div className="space-y-0.5 pl-5">
              {connections.map((conn) => (
                <div key={conn.id} className="flex items-center gap-1.5 text-[11px]">
                  <span
                    className={conn.outbound ? 'text-blue-500' : 'text-slate-400'}
                    title={conn.outbound ? 'Outbound — this component calls it' : 'Inbound — it calls this component'}
                  >
                    {conn.outbound ? '→' : '←'}
                  </span>
                  <span className="flex-1 truncate text-slate-600">{conn.label}</span>
                  {conn.protocol && (
                    <span className="shrink-0 text-[10px] font-medium text-slate-400">
                      {conn.protocol}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Instance sizing */}
      <div className="p-4 space-y-3">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Sizing
        </p>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Hardware, and how long one request occupies it. Blank uses the default for a{' '}
          <span className="font-medium text-slate-500">{node.data.category}</span> component.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            id={`service-${node.id}`}
            label="Service ms"
            min={MIN_SERVICE_MS}
            max={MAX_SERVICE_MS}
            value={node.data.serviceMs}
            placeholder={capacityDefaults.serviceMs}
            onChange={(v) => handleCapacityChange('serviceMs', v)}
          />
          <NumberField
            id={`instances-${node.id}`}
            label="Instances"
            min={1}
            max={10_000}
            value={node.data.instances}
            placeholder={profile.instances}
            onChange={(v) => handleCapacityChange('instances', v)}
          />
          <NumberField
            id={`vcpu-${node.id}`}
            label="vCPU each"
            min={1}
            max={1024}
            value={node.data.vcpu}
            placeholder={profile.vcpu}
            onChange={(v) => handleCapacityChange('vcpu', v)}
          />
          <NumberField
            id={`memory-${node.id}`}
            label="RAM each (GB)"
            min={0}
            max={65_536}
            value={node.data.memoryGb}
            placeholder={profile.memoryGb}
            onChange={(v) => handleCapacityChange('memoryGb', v)}
          />
        </div>

        {/*
          Derived, not entered. Concurrency comes from the hardware above rather than
          being a separate field, so there is one answer to "how many at once".
        */}
        <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Concurrency</span>
            <span className="font-semibold text-slate-800 tabular-nums">
              {capacity.concurrency}
            </span>
          </div>
          <p className="text-[10px] text-slate-400">
            {profile.instances} × {profile.vcpu} vCPU × {profile.concurrencyPerVcpu} per vCPU ·{' '}
            {totalVcpu(profile)} vCPU and {totalMemoryGb(profile)} GB total
          </p>
          {node.data.concurrency !== undefined && (
            <p className="text-[10px] text-amber-600">
              Overridden to {node.data.concurrency}, ignoring the hardware above.
            </p>
          )}
        </div>

        {/* Sizing against the capacity workload — the point of entering any of this. */}
        {nodeSizing && (
          <div
            className={[
              'rounded-xl px-3 py-2 space-y-1 border',
              nodeSizing.verdict === 'under'
                ? 'bg-red-50 border-red-200'
                : nodeSizing.verdict === 'tight'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-emerald-50 border-emerald-200',
            ].join(' ')}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">At {formatRate(peakQps)}</span>
              <span
                className={[
                  'font-semibold',
                  nodeSizing.verdict === 'under'
                    ? 'text-red-700'
                    : nodeSizing.verdict === 'tight'
                      ? 'text-amber-700'
                      : 'text-emerald-700',
                ].join(' ')}
              >
                {Math.round(nodeSizing.utilisation * 100)}% used
              </span>
            </div>
            <p className="text-[10px] text-slate-500">
              Needs {nodeSizing.requiredInstances} instance
              {nodeSizing.requiredInstances === 1 ? '' : 's'}, has{' '}
              {nodeSizing.configuredInstances}.{' '}
              {nodeSizing.verdict === 'under'
                ? 'Cannot keep up at peak.'
                : nodeSizing.verdict === 'tight'
                  ? 'No headroom for a spike or a lost instance.'
                  : 'Comfortable.'}
            </p>
          </div>
        )}
      </div>

      {/*
        Component configuration.

        Rendered from a schema keyed on the component and its category, so a database shows
        an engine and a connection pool while an EC2 instance shows an AMI and an EBS
        volume. Fields marked as driving the simulation are labelled, because the difference
        between a number that changes the model and one that is documentation matters.
      */}
      {configGroups.map((group) => (
        <div key={group.title} className="p-4 space-y-3">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            {group.title}
          </p>
          <div className="space-y-2.5">
            {group.fields.map((field) => (
              <ConfigFieldInput
                key={field.key}
                nodeId={node.id}
                field={field}
                value={node.data.config?.[field.key]}
                onChange={(value) => handleConfigChange(field.key, value)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Position info */}
      <div className="p-4 space-y-3">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Position
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">X</label>
            <input
              type="number"
              value={Math.round(node.position.x)}
              readOnly
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-600"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Y</label>
            <input
              type="number"
              value={Math.round(node.position.y)}
              readOnly
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-600"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 space-y-2">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Actions
        </p>
        <button
          onClick={handleDuplicate}
          className="w-full flex items-center gap-2 py-2 px-3 text-sm text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors"
        >
          <Copy className="w-4 h-4" />
          Duplicate
        </button>
        <button
          onClick={handleDelete}
          className="w-full flex items-center gap-2 py-2 px-3 text-sm text-red-600 bg-red-50 hover:bg-red-100/80 border border-red-200 rounded-xl transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
    </div>
  )
}

/** One configuration input, rendered according to its declared type. */
function ConfigFieldInput({
  nodeId,
  field,
  value,
  onChange,
}: {
  nodeId: string
  field: ConfigField
  value: ConfigValue | undefined
  onChange: (value: ConfigValue | undefined) => void
}) {
  const id = `cfg-${nodeId}-${field.key}`
  const inputClass =
    'w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl ' +
    'text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500'

  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 cursor-pointer" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked ? true : undefined)}
          className="rounded"
        />
        <span className="text-xs text-slate-600">{field.label}</span>
        {field.drives && <DrivesBadge />}
      </label>
    )
  }

  return (
    <div>
      <label className="flex items-center gap-1.5 mb-1" htmlFor={id}>
        <span className="text-xs text-slate-400">
          {field.label}
          {field.unit ? ` (${field.unit})` : ''}
        </span>
        {field.drives && <DrivesBadge />}
      </label>

      {field.type === 'select' ? (
        <select
          id={id}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={inputClass}
        >
          <option value="">—</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === 'number' ? (
        <input
          id={id}
          type="number"
          min={field.min}
          max={field.max}
          value={typeof value === 'number' ? value : ''}
          placeholder={field.placeholder !== undefined ? String(field.placeholder) : undefined}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          className={inputClass}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder !== undefined ? String(field.placeholder) : undefined}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={inputClass}
        />
      )}

      {field.hint && <p className="mt-0.5 text-[10px] text-slate-400">{field.hint}</p>}
    </div>
  )
}

/** Marks a field the simulation actually reads. */
function DrivesBadge() {
  return (
    <span
      className="shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold bg-blue-50 text-blue-600"
      title="Feeds the simulation"
    >
      sim
    </span>
  )
}

/**
 * Numeric field whose placeholder is the value that applies when it is left blank.
 *
 * Empty means "inherit", not zero — pinning a database at 0ms service time because the
 * field looked empty would silently break the sizing maths.
 */
function NumberField({
  id,
  label,
  min,
  max,
  value,
  placeholder,
  onChange,
}: {
  id: string
  label: string
  min: number
  max: number
  value: number | undefined
  placeholder: number
  onChange: (raw: string) => void
}) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value ?? ''}
        placeholder={String(placeholder)}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl
          text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}

function InfoRow({
  label,
  value,
  capitalize,
}: {
  label: string
  value: string
  capitalize?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-400">{label}</span>
      <span
        className={`text-xs font-medium text-slate-700 truncate ${capitalize ? 'capitalize' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}
