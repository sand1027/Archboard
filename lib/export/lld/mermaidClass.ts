import {
  VISIBILITY_SIGIL,
  type ClassRelationData,
  type ClassShapeData,
  type LldDiagram,
  type LldShape,
} from '@/types/lld'
import { mermaidIdent, mermaidType } from './sanitize'

/**
 * Mermaid `classDiagram`.
 *
 * Relationship arrows read target-first for inheritance/realization, which is
 * the opposite of the composition/aggregation direction — a Mermaid quirk, not
 * an inconsistency here.
 */
export function toMermaidClass(diagram: LldDiagram): string {
  const classes = diagram.shapes.filter(
    (s): s is Extract<LldShape, { type: 'lldClass' }> => s.type === 'lldClass'
  )

  const names = new Map<string, string>()
  const used = new Set<string>()
  for (const c of classes) {
    let name = mermaidIdent((c.data as ClassShapeData).label)
    let n = 2
    while (used.has(name)) name = `${mermaidIdent((c.data as ClassShapeData).label)}_${n++}`
    used.add(name)
    names.set(c.id, name)
  }

  const lines: string[] = ['classDiagram']

  for (const c of classes) {
    const data = c.data as ClassShapeData
    const name = names.get(c.id)!

    if (data.stereotype === 'interface') lines.push(`  class ${name} {`, '    <<interface>>')
    else if (data.stereotype === 'abstract') lines.push(`  class ${name} {`, '    <<abstract>>')
    else if (data.stereotype === 'enum') lines.push(`  class ${name} {`, '    <<enumeration>>')
    else if (data.stereotype === 'struct') lines.push(`  class ${name} {`, '    <<record>>')
    else lines.push(`  class ${name} {`)

    if (data.stereotype === 'enum') {
      for (const v of data.enumValues) {
        const ident = mermaidIdent(v, 'VALUE')
        if (ident) lines.push(`    ${ident}`)
      }
    } else {
      for (const f of data.fields) {
        const sigil = VISIBILITY_SIGIL[f.visibility]
        const type = f.type ? `${mermaidType(f.type)} ` : ''
        lines.push(`    ${sigil}${type}${f.name}${f.isStatic ? '$' : ''}`)
      }
      for (const m of data.methods) {
        const sigil = VISIBILITY_SIGIL[m.visibility]
        const params = m.params
          .map((p) => (p.type ? `${mermaidType(p.type)} ${p.name}` : p.name))
          .join(', ')
        const ret = m.returnType ? ` ${mermaidType(m.returnType)}` : ''
        // $ marks static, * marks abstract in Mermaid.
        const suffix = m.isStatic ? '$' : m.isAbstract ? '*' : ''
        lines.push(`    ${sigil}${m.name}(${params})${suffix}${ret}`)
      }
    }

    lines.push('  }')
  }

  for (const edge of diagram.edges) {
    if (edge.type !== 'lldClassRelation') continue
    const data = edge.data as ClassRelationData | undefined
    if (!data) continue

    const src = names.get(edge.source)
    const tgt = names.get(edge.target)
    if (!src || !tgt) continue

    const label = data.label ? ` : ${data.label}` : ''
    const sm = data.sourceMultiplicity ? `"${data.sourceMultiplicity}" ` : ''
    const tm = data.targetMultiplicity ? ` "${data.targetMultiplicity}"` : ''

    switch (data.kind) {
      case 'inheritance':
        lines.push(`  ${tgt} <|-- ${sm}${src}${tm}${label}`)
        break
      case 'realization':
        lines.push(`  ${tgt} <|.. ${sm}${src}${tm}${label}`)
        break
      case 'composition':
        lines.push(`  ${src} ${sm}*--${tm} ${tgt}${label}`)
        break
      case 'aggregation':
        lines.push(`  ${src} ${sm}o--${tm} ${tgt}${label}`)
        break
      case 'association':
        lines.push(`  ${src} ${sm}${data.isDirected ? '-->' : '--'}${tm} ${tgt}${label}`)
        break
      case 'dependency':
        lines.push(`  ${src} ${sm}..>${tm} ${tgt}${label}`)
        break
    }
  }

  for (const note of diagram.shapes) {
    if (note.type !== 'lldNote') continue
    const text = String(note.data.text || note.data.label || '').replace(/\n/g, ' ').trim()
    if (text) lines.push(`  note "${text.replace(/"/g, "'")}"`)
  }

  return lines.join('\n')
}
