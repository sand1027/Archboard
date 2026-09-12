import {
  formatTransitionLabel,
  type LldDiagram,
  type LldShape,
  type StateShapeData,
  type StateTransitionData,
} from '@/types/lld'
import { mermaidIdent, mermaidLabel, uniquify } from './sanitize'

type StateNode = Extract<LldShape, { type: 'lldState' }>

/** Mermaid `stateDiagram-v2`. */
export function toMermaidState(diagram: LldDiagram): string {
  const states = diagram.shapes.filter((s): s is StateNode => s.type === 'lldState')

  const named = states.filter((s) => {
    const kind = (s.data as StateShapeData).stateKind
    return kind === 'state' || kind === 'choice'
  })

  const raw = named.map((s) => mermaidIdent((s.data as StateShapeData).label, 'State'))
  const unique = uniquify(raw)
  const names = new Map(named.map((s, i) => [s.id, unique[i]]))

  // Initial and final pseudo-states are always [*] in Mermaid.
  for (const s of states) {
    const kind = (s.data as StateShapeData).stateKind
    if (kind === 'initial' || kind === 'final') names.set(s.id, '[*]')
  }

  const lines: string[] = ['stateDiagram-v2']

  for (const s of named) {
    const data = s.data as StateShapeData
    const name = names.get(s.id)!
    const label = mermaidLabel(data.label)
    if (label && label !== name) lines.push(`  ${name} : ${label}`)
    if (data.stateKind === 'choice') lines.push(`  state ${name} <<choice>>`)
  }

  for (const edge of diagram.edges) {
    if (edge.type !== 'lldStateTransition') continue
    const data = edge.data as StateTransitionData | undefined

    const src = names.get(edge.source)
    const tgt = names.get(edge.target)
    if (!src || !tgt) continue

    const label = data ? mermaidLabel(data.label ?? formatTransitionLabel(data)) : ''
    lines.push(label ? `  ${src} --> ${tgt} : ${label}` : `  ${src} --> ${tgt}`)
  }

  for (const s of named) {
    const data = s.data as StateShapeData
    const name = names.get(s.id)!
    const notes: string[] = []
    if (data.entryAction) notes.push(`entry / ${data.entryAction}`)
    if (data.doActivity) notes.push(`do / ${data.doActivity}`)
    if (data.exitAction) notes.push(`exit / ${data.exitAction}`)
    if (notes.length === 0) continue
    lines.push(`  note right of ${name}`)
    for (const n of notes) lines.push(`    ${n}`)
    lines.push('  end note')
  }

  return lines.join('\n')
}
