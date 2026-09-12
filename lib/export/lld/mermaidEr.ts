import type {
  ErCardinality,
  ErRelationData,
  ErTableShapeData,
  LldDiagram,
  LldShape,
} from '@/types/lld'
import { mermaidIdent, uniquify } from './sanitize'

type TableShape = Extract<LldShape, { type: 'lldTable' }>

/** Mermaid `erDiagram`. */
export function toMermaidEr(diagram: LldDiagram): string {
  const tables = diagram.shapes.filter((s): s is TableShape => s.type === 'lldTable')

  const raw = tables.map((t) => mermaidIdent((t.data as ErTableShapeData).label, 'TABLE'))
  const unique = uniquify(raw)
  const names = new Map(tables.map((t, i) => [t.id, unique[i]]))

  const lines: string[] = ['erDiagram']

  for (const edge of diagram.edges) {
    if (edge.type !== 'lldErRelation') continue
    const data = edge.data as ErRelationData | undefined
    if (!data) continue

    const src = names.get(edge.source)
    const tgt = names.get(edge.target)
    if (!src || !tgt) continue

    const left = leftCardinality(data.sourceCardinality)
    const right = rightCardinality(data.targetCardinality)
    const label = mermaidIdent(data.label ?? '', '') || relationVerb(data.kind)

    lines.push(`  ${src} ${left}--${right} ${tgt} : ${label}`)
  }

  for (const t of tables) {
    const data = t.data as ErTableShapeData
    const name = names.get(t.id)!
    lines.push(`  ${name} {`)
    for (const c of data.columns) {
      const keys: string[] = []
      if (c.isPk) keys.push('PK')
      if (c.isFk) keys.push('FK')
      if (c.isUnique && !c.isPk) keys.push('UK')
      const type = mermaidIdent(c.type || 'text', 'text')
      const colName = mermaidIdent(c.name, 'column')
      const suffix = keys.length ? ` ${keys.join(',')}` : ''
      lines.push(`    ${type} ${colName}${suffix}`)
    }
    lines.push('  }')
  }

  return lines.join('\n')
}

// Mermaid cardinality is a two-character token per side, and the left side is
// mirrored relative to the right.
function leftCardinality(c: ErCardinality): string {
  switch (c) {
    case 'one':
      return '||'
    case 'zero-or-one':
      return '|o'
    case 'one-or-many':
      return '}|'
    case 'zero-or-many':
      return '}o'
  }
}

function rightCardinality(c: ErCardinality): string {
  switch (c) {
    case 'one':
      return '||'
    case 'zero-or-one':
      return 'o|'
    case 'one-or-many':
      return '|{'
    case 'zero-or-many':
      return 'o{'
  }
}

function relationVerb(kind: ErRelationData['kind']): string {
  switch (kind) {
    case 'er-one-to-one':
      return 'has'
    case 'er-one-to-many':
      return 'has_many'
    case 'er-many-to-many':
      return 'relates_to'
    case 'er-fk-ref':
      return 'references'
  }
}
