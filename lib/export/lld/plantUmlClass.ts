import {
  VISIBILITY_SIGIL,
  type ClassRelationData,
  type ClassShapeData,
  type LldDiagram,
  type LldShape,
} from '@/types/lld'
import { plantUmlIdent } from './sanitize'

/** PlantUML class diagram. */
export function toPlantUmlClass(diagram: LldDiagram, ctx?: { diagramName?: string }): string {
  const classes = diagram.shapes.filter(
    (s): s is Extract<LldShape, { type: 'lldClass' }> => s.type === 'lldClass'
  )

  const names = new Map<string, string>()
  for (const c of classes) {
    names.set(c.id, plantUmlIdent((c.data as ClassShapeData).label))
  }

  const lines: string[] = ['@startuml']
  if (ctx?.diagramName) lines.push(`title ${ctx.diagramName}`)
  lines.push('skinparam classAttributeIconSize 0', '')

  for (const c of classes) {
    const data = c.data as ClassShapeData
    const name = names.get(c.id)!
    const generics = data.generics ? data.generics : ''

    const keyword =
      data.stereotype === 'interface'
        ? 'interface'
        : data.stereotype === 'abstract'
          ? 'abstract class'
          : data.stereotype === 'enum'
            ? 'enum'
            : data.stereotype === 'struct'
              ? 'class'
              : 'class'

    const stereo = data.stereotype === 'struct' ? ' <<record>>' : ''
    lines.push(`${keyword} ${name}${generics}${stereo} {`)

    if (data.stereotype === 'enum') {
      for (const v of data.enumValues) {
        if (v.trim()) lines.push(`  ${v.trim()}`)
      }
    } else {
      for (const f of data.fields) {
        const mods = f.isStatic ? '{static} ' : ''
        const type = f.type ? `: ${f.type}` : ''
        lines.push(`  ${VISIBILITY_SIGIL[f.visibility]}${mods}${f.name}${type}`)
      }
      if (data.fields.length > 0 && data.methods.length > 0) lines.push('  --')
      for (const m of data.methods) {
        const mods = `${m.isStatic ? '{static} ' : ''}${m.isAbstract ? '{abstract} ' : ''}`
        const params = m.params.map((p) => (p.type ? `${p.name}: ${p.type}` : p.name)).join(', ')
        const ret = m.returnType ? `: ${m.returnType}` : ''
        lines.push(`  ${VISIBILITY_SIGIL[m.visibility]}${mods}${m.name}(${params})${ret}`)
      }
    }

    lines.push('}', '')
  }

  for (const edge of diagram.edges) {
    if (edge.type !== 'lldClassRelation') continue
    const data = edge.data as ClassRelationData | undefined
    if (!data) continue

    const src = names.get(edge.source)
    const tgt = names.get(edge.target)
    if (!src || !tgt) continue

    const sm = data.sourceMultiplicity ? ` "${data.sourceMultiplicity}"` : ''
    const tm = data.targetMultiplicity ? ` "${data.targetMultiplicity}"` : ''
    const label = data.label ? ` : ${data.label}` : ''

    const arrow: Record<ClassRelationData['kind'], string> = {
      inheritance: '--|>',
      realization: '..|>',
      composition: '*--',
      aggregation: 'o--',
      association: data.isDirected ? '-->' : '--',
      dependency: '..>',
    }

    lines.push(`${src}${sm} ${arrow[data.kind]}${tm} ${tgt}${label}`)
  }

  const notes = diagram.shapes.filter((s) => s.type === 'lldNote')
  if (notes.length > 0) lines.push('')
  notes.forEach((n, i) => {
    const text = String(n.data.text || n.data.label || '').trim()
    if (text) lines.push(`note as N${i}`, text, 'end note')
  })

  lines.push('@enduml')
  return lines.join('\n')
}
