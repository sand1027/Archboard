import type {
  LldDiagram,
  LldShape,
  SystemBoundaryShapeData,
  UseCaseActorShapeData,
  UseCaseRelationData,
  UseCaseShapeData,
} from '@/types/lld'
import { nodeBounds } from '@/lib/canvas/geometry'
import { plantUmlIdent, uniquify } from './sanitize'

type ActorShape = Extract<LldShape, { type: 'lldActor' }>
type UcShape = Extract<LldShape, { type: 'lldUseCase' }>
type BoundaryShape = Extract<LldShape, { type: 'lldBoundary' }>
type PackageShape = Extract<LldShape, { type: 'lldPackage' }>

/**
 * PlantUML use case diagram.
 *
 * Mermaid has no use case diagram, so PlantUML is the only text target here.
 *
 * Containment is geometric: UML says use cases inside the subject rectangle
 * belong to it, so membership is derived from the boundary each use case sits
 * within rather than from an explicit parent field.
 */
export function toPlantUmlUseCase(diagram: LldDiagram, ctx?: { diagramName?: string }): string {
  const actors = diagram.shapes.filter((s): s is ActorShape => s.type === 'lldActor')
  const useCases = diagram.shapes.filter((s): s is UcShape => s.type === 'lldUseCase')
  const boundaries = diagram.shapes.filter((s): s is BoundaryShape => s.type === 'lldBoundary')
  const packages = diagram.shapes.filter((s): s is PackageShape => s.type === 'lldPackage')

  // Stable aliases: UC1, UC2… and A1, A2… keep output readable and unique.
  const alias = new Map<string, string>()
  actors.forEach((a, i) => alias.set(a.id, `A${i + 1}`))
  useCases.forEach((u, i) => alias.set(u.id, `UC${i + 1}`))

  const containerNames = uniquify(
    [...boundaries, ...packages].map((b) => (b.data.label || 'System').trim() || 'System')
  )
  const containerName = new Map(
    [...boundaries, ...packages].map((b, i) => [b.id, containerNames[i]])
  )

  const lines: string[] = ['@startuml']
  lines.push(`title ${ctx?.diagramName ?? 'Use cases'}`)
  // Actors left, system right — the conventional reading order.
  lines.push('left to right direction', 'skinparam packageStyle rectangle', '')

  for (const actor of actors) {
    const data = actor.data as UseCaseActorShapeData
    const keyword = data.isSystem ? 'actor' : 'actor'
    lines.push(`${keyword} "${escape(data.label)}" as ${alias.get(actor.id)}`)
  }
  if (actors.length > 0) lines.push('')

  // Group use cases by the container whose box encloses them.
  const containers = [...boundaries, ...packages]
  const grouped = new Map<string, UcShape[]>()
  const loose: UcShape[] = []

  for (const uc of useCases) {
    const owner = containers.find((c) => encloses(c, uc))
    if (owner) {
      const list = grouped.get(owner.id) ?? []
      list.push(uc)
      grouped.set(owner.id, list)
    } else {
      loose.push(uc)
    }
  }

  for (const container of containers) {
    const contained = grouped.get(container.id) ?? []
    const stereotype =
      container.type === 'lldBoundary'
        ? (container.data as SystemBoundaryShapeData).stereotype
        : undefined
    const keyword = container.type === 'lldPackage' ? 'package' : 'rectangle'

    lines.push(
      `${keyword} "${escape(containerName.get(container.id) ?? 'System')}"${stereotype ? ` <<${escape(stereotype)}>>` : ''} {`
    )
    for (const uc of contained) lines.push(`  ${declareUseCase(uc, alias)}`)
    lines.push('}', '')
  }

  for (const uc of loose) lines.push(declareUseCase(uc, alias))
  if (loose.length > 0) lines.push('')

  for (const edge of diagram.edges) {
    if (edge.type !== 'lldUseCaseRelation') continue
    const data = edge.data as UseCaseRelationData | undefined
    if (!data) continue

    const src = alias.get(edge.source)
    const tgt = alias.get(edge.target)
    if (!src || !tgt) continue

    const sm = data.sourceMultiplicity ? ` "${data.sourceMultiplicity}"` : ''
    const tm = data.targetMultiplicity ? `"${data.targetMultiplicity}" ` : ''

    switch (data.kind) {
      case 'uc-association':
        lines.push(
          `${src}${sm} --${data.isDirected ? '>' : ''} ${tm}${tgt}${label(data.label)}`
        )
        break
      case 'uc-include':
        lines.push(`${src} ..> ${tgt} : <<include>>`)
        break
      case 'uc-extend': {
        // The condition and extension point belong on the extend, per UML.
        const note = [data.condition, extensionPointName(diagram, data)]
          .filter(Boolean)
          .join(' @ ')
        lines.push(`${src} ..> ${tgt} : <<extend>>${note ? ` ${escape(note)}` : ''}`)
        break
      }
      case 'uc-generalization':
        lines.push(`${src} --|> ${tgt}${label(data.label)}`)
        break
      case 'uc-dependency':
        lines.push(`${src} ..> ${tgt}${label(data.label)}`)
        break
    }
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

function declareUseCase(uc: UcShape, alias: Map<string, string>): string {
  const data = uc.data as UseCaseShapeData
  const name = escape(data.label)
  const id = alias.get(uc.id)
  const stereotype = data.isAbstract ? ' <<abstract>>' : ''

  if (data.extensionPoints.length === 0) {
    return `usecase "${name}" as ${id}${stereotype}`
  }

  // PlantUML renders a second compartment when the body is given inline.
  const points = data.extensionPoints
    .map((ep) => `  ${escape(ep.name)}${ep.location ? ` : ${escape(ep.location)}` : ''}`)
    .join('\n')
  return `usecase ${id}${stereotype} as "${name}\n--\nextension points\n${points.trim()}"`
}

function extensionPointName(diagram: LldDiagram, data: UseCaseRelationData): string {
  if (!data.extensionPointId) return ''
  for (const shape of diagram.shapes) {
    if (shape.type !== 'lldUseCase') continue
    const ep = shape.data.extensionPoints.find((e) => e.id === data.extensionPointId)
    if (ep) return ep.name
  }
  return ''
}

function label(text?: string): string {
  return text ? ` : ${escape(text)}` : ''
}

function escape(text: string): string {
  return text.replace(/"/g, "'").replace(/\n/g, ' ').trim()
}

/** True when `child`'s centre sits inside `container`'s box. */
function encloses(container: LldShape, child: LldShape): boolean {
  const c = nodeBounds(container)
  const k = nodeBounds(child)
  const cx = k.x + k.w / 2
  const cy = k.y + k.h / 2
  return cx >= c.x && cx <= c.x + c.w && cy >= c.y && cy <= c.y + c.h
}

// Keeps plantUmlIdent referenced for callers that pass raw names.
export const __identHelper = plantUmlIdent
