'use client'

import { useDiagramStore } from '@/store/diagramStore'
import type { ArchitectureNode } from '@/types/diagram'
import type {
  UmlClassNodeData,
  UmlEntityNodeData,
  UmlLifelineNodeData,
  IconNodeData,
  LifelineKind,
  UmlClassStereotype,
} from '@/types/lld'

export function UmlClassProperties({ node }: { node: ArchitectureNode }) {
  const { updateNode, deleteNode } = useDiagramStore()
  const data = node.data as UmlClassNodeData

  return (
    <div className="p-4 space-y-4">
      <Field label="Name">
        <input
          className="field-input"
          value={data.name ?? ''}
          onChange={(e) => updateNode(node.id, { name: e.target.value })}
        />
      </Field>
      <Field label="Stereotype">
        <select
          className="field-input"
          value={data.stereotype ?? 'class'}
          onChange={(e) =>
            updateNode(node.id, { stereotype: e.target.value as UmlClassStereotype })
          }
        >
          {['class', 'interface', 'enum', 'abstract', 'package'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </Field>
      <Field label="Attributes (one per line)">
        <textarea
          className="field-input min-h-[80px] font-mono text-xs"
          value={(data.attributes ?? []).join('\n')}
          onChange={(e) => updateNode(node.id, { attributes: e.target.value.split('\n') })}
        />
      </Field>
      <Field label="Methods (one per line)">
        <textarea
          className="field-input min-h-[80px] font-mono text-xs"
          value={(data.methods ?? []).join('\n')}
          onChange={(e) => updateNode(node.id, { methods: e.target.value.split('\n') })}
        />
      </Field>
      <DeleteButton onClick={() => deleteNode(node.id)} label="Delete class" />
    </div>
  )
}

export function UmlEntityProperties({ node }: { node: ArchitectureNode }) {
  const { updateNode, deleteNode } = useDiagramStore()
  const data = node.data as UmlEntityNodeData

  return (
    <div className="p-4 space-y-4">
      <Field label="Name">
        <input
          className="field-input"
          value={data.name ?? ''}
          onChange={(e) => updateNode(node.id, { name: e.target.value })}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={!!data.weak}
          onChange={(e) => updateNode(node.id, { weak: e.target.checked })}
        />
        Weak entity
      </label>
      <p className="text-[11px] text-slate-400">
        Double-click the attribute area on the node to edit. Prefix lines with pk / fk.
      </p>
      <DeleteButton onClick={() => deleteNode(node.id)} label="Delete entity" />
    </div>
  )
}

export function UmlLifelineProperties({ node }: { node: ArchitectureNode }) {
  const { updateNode, deleteNode } = useDiagramStore()
  const data = node.data as UmlLifelineNodeData

  return (
    <div className="p-4 space-y-4">
      <Field label="Label">
        <input
          className="field-input"
          value={data.label ?? ''}
          onChange={(e) => updateNode(node.id, { label: e.target.value })}
        />
      </Field>
      <Field label="Kind">
        <select
          className="field-input"
          value={data.kind ?? 'object'}
          onChange={(e) => updateNode(node.id, { kind: e.target.value as LifelineKind })}
        >
          {['actor', 'object', 'boundary', 'control', 'entity'].map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </Field>
      <DeleteButton onClick={() => deleteNode(node.id)} label="Delete lifeline" />
    </div>
  )
}

export function IconNodeProperties({ node }: { node: ArchitectureNode }) {
  const { updateNode, deleteNode } = useDiagramStore()
  const data = node.data as IconNodeData

  return (
    <div className="p-4 space-y-4">
      <Field label="Label">
        <input
          className="field-input"
          value={data.label ?? ''}
          onChange={(e) => updateNode(node.id, { label: e.target.value })}
        />
      </Field>
      <Field label="Color">
        <input
          type="color"
          className="h-9 w-full rounded-lg border border-slate-200 cursor-pointer"
          value={data.color ?? '#334155'}
          onChange={(e) => updateNode(node.id, { color: e.target.value })}
        />
      </Field>
      <DeleteButton onClick={() => deleteNode(node.id)} label="Delete icon" />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

function DeleteButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-2 px-3 text-sm text-red-600 bg-red-50 hover:bg-red-100/80 border border-red-200 rounded-xl transition-colors"
    >
      {label}
    </button>
  )
}
