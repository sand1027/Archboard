import type {
  LldDiagram,
  LldShape,
  SequenceFragmentShapeData,
  SequenceLifelineShapeData,
  SequenceMessageData,
} from '@/types/lld'
import { orderedMessages } from '@/lib/lld/sequenceLayout'
import { mermaidIdent, mermaidLabel, uniquify } from './sanitize'

type LifelineShape = Extract<LldShape, { type: 'lldLifeline' }>
type FragmentShape = Extract<LldShape, { type: 'lldFragment' }>

/**
 * Mermaid `sequenceDiagram`.
 *
 * Fragment blocks are opened and closed around the contiguous run of messages
 * that declare `fragmentId`. Membership is explicit rather than geometric, so
 * export stays correct even though fragments are positioned by hand in v1.
 */
export function toMermaidSequence(diagram: LldDiagram): string {
  const lifelines = diagram.shapes.filter((s): s is LifelineShape => s.type === 'lldLifeline')
  const fragments = diagram.shapes.filter((s): s is FragmentShape => s.type === 'lldFragment')

  // Declaration order follows X position so the diagram reads left to right.
  const sorted = [...lifelines].sort((a, b) => a.position.x - b.position.x)
  const rawNames = sorted.map((l) => mermaidIdent((l.data as SequenceLifelineShapeData).label, 'P'))
  const unique = uniquify(rawNames)
  const names = new Map(sorted.map((l, i) => [l.id, unique[i]]))

  const messages = orderedMessages(diagram.edges)
  const createdBy = new Map<string, string>()
  for (const m of messages) {
    if (m.data?.kind === 'msg-create') createdBy.set(m.target, m.id)
  }

  const lines: string[] = ['sequenceDiagram', '  autonumber']

  // Participants created mid-interaction are declared at their create message.
  for (const l of sorted) {
    if (createdBy.has(l.id)) continue
    const data = l.data as SequenceLifelineShapeData
    const keyword = data.lifelineKind === 'actor' ? 'actor' : 'participant'
    const name = names.get(l.id)!
    const label = mermaidLabel(data.label)
    lines.push(
      label && label !== name ? `  ${keyword} ${name} as ${label}` : `  ${keyword} ${name}`
    )
  }

  const fragmentById = new Map(fragments.map((f) => [f.id, f]))
  let openFragmentId: string | null = null
  let openOperandId: string | null = null
  let indent = '  '

  const closeFragment = () => {
    if (!openFragmentId) return
    indent = '  '
    lines.push(`${indent}end`)
    openFragmentId = null
    openOperandId = null
  }

  for (const msg of messages) {
    const data = msg.data as SequenceMessageData | undefined
    if (!data) continue

    const src = names.get(msg.source)
    const tgt = names.get(msg.target)
    if (!src || !tgt) continue

    // Fragment open / operand switch / close.
    const fragId = data.fragmentId ?? null
    if (fragId !== openFragmentId) {
      closeFragment()
      if (fragId && fragmentById.has(fragId)) {
        const f = fragmentById.get(fragId)!
        const fd = f.data as SequenceFragmentShapeData
        const guard = fd.operands.find((o) => o.id === data.operandId)?.guard ?? fd.operands[0]?.guard ?? ''
        lines.push(`  ${keywordFor(fd.operator)} ${mermaidLabel(guard)}`.trimEnd())
        openFragmentId = fragId
        openOperandId = data.operandId ?? fd.operands[0]?.id ?? null
        indent = '    '
      }
    } else if (fragId && data.operandId && data.operandId !== openOperandId) {
      const f = fragmentById.get(fragId)!
      const fd = f.data as SequenceFragmentShapeData
      const guard = fd.operands.find((o) => o.id === data.operandId)?.guard ?? ''
      lines.push(`  else ${mermaidLabel(guard)}`.trimEnd())
      openOperandId = data.operandId
    }

    const label = mermaidLabel(data.label ?? '')

    if (data.kind === 'msg-create') {
      lines.push(`${indent}create participant ${tgt}`)
      lines.push(`${indent}${src}->>${tgt}: ${label || '«create»'}`)
      continue
    }

    if (data.kind === 'msg-destroy') {
      lines.push(`${indent}${src}->>${tgt}: ${label || '«destroy»'}`)
      lines.push(`${indent}destroy ${tgt}`)
      continue
    }

    const arrow =
      data.kind === 'msg-sync' ? '->>' : data.kind === 'msg-async' ? '->>' : '-->>'
    lines.push(`${indent}${src}${arrow}${tgt}: ${label}`)
  }

  closeFragment()

  for (const note of diagram.shapes) {
    if (note.type !== 'lldNote') continue
    const text = mermaidLabel(String(note.data.text || note.data.label || ''))
    const anchor = unique[0]
    if (text && anchor) lines.push(`  Note over ${anchor}: ${text}`)
  }

  return lines.join('\n')
}

function keywordFor(op: SequenceFragmentShapeData['operator']): string {
  switch (op) {
    case 'alt':
      return 'alt'
    case 'opt':
      return 'opt'
    case 'loop':
      return 'loop'
    case 'par':
      return 'par'
    case 'critical':
      return 'critical'
    case 'ref':
      return 'rect rgb(240,240,240)'
  }
}
