import type { ArchitectureEdge, ArchitectureNode } from '@/types/diagram'
import type { BlockType } from '@/types/notes'

/**
 * Turn a canvas selection into notebook blocks.
 *
 * Prose, not code. The DSL printer already exists and would give a more precise answer, but a
 * page of source is not what someone taking notes from a tutorial wants to read back later —
 * they want "the API talks to Redis and Postgres" in a form they can annotate.
 *
 * Pure so it can be tested without a canvas, which matters because the interesting cases are all
 * about what gets left out: unlabelled nodes, edges to things that were not selected, shapes that
 * are scenery rather than architecture.
 */

export interface NoteBlockDraft {
  type: BlockType
  text: string
  src?: string
}

/** What a node is, in a word, for the parenthetical after its name. */
function describeKind(node: ArchitectureNode): string | null {
  if (node.type === 'architecture') {
    const componentId = node.data?.componentId
    return typeof componentId === 'string' ? componentId : null
  }
  if (node.type === 'frame') return 'group'
  if (node.type === 'shape') {
    const shapeType = node.data?.shapeType
    return typeof shapeType === 'string' ? shapeType : 'shape'
  }
  return null
}

function labelOf(node: ArchitectureNode): string {
  const label = node.data?.label
  if (typeof label === 'string' && label.trim() !== '') return label
  // Falls back to what it is, so an unnamed box still reads as something.
  return describeKind(node) ?? 'Untitled'
}

/**
 * Describe the selected nodes and the connections among them.
 *
 * Only edges with both ends selected are included: an arrow to something outside the selection
 * would name a component the note never introduced.
 */
export function describeSelection(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[],
  selectedIds: string[]
): NoteBlockDraft[] {
  const selected = new Set(selectedIds)
  const picked = nodes.filter((node) => selected.has(node.id))
  if (picked.length === 0) return []

  const labels = new Map(picked.map((node) => [node.id, labelOf(node)]))

  const blocks: NoteBlockDraft[] = [
    {
      type: 'subheading',
      // Named when there is one thing, counted when there are several — "1 component from the
      // diagram" is a worse heading than the component's own name.
      text:
        picked.length === 1
          ? `${labels.get(picked[0].id)} — from the diagram`
          : `${picked.length} components from the diagram`,
    },
  ]

  for (const node of picked) {
    const kind = describeKind(node)
    const label = labels.get(node.id) ?? 'Untitled'
    blocks.push({ type: 'bullet', text: kind && kind !== label ? `${label} (${kind})` : label })
  }

  const internal = edges.filter((edge) => selected.has(edge.source) && selected.has(edge.target))

  for (const edge of internal) {
    const from = labels.get(edge.source)
    const to = labels.get(edge.target)
    if (!from || !to) continue

    // The protocol and the label say different things, and both are worth keeping when present.
    const detail = [edge.data?.protocol, edge.data?.label]
      .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
      // A label that just repeats the protocol adds nothing.
      .filter((part, index, all) => all.indexOf(part) === index)
      .join(', ')

    blocks.push({
      type: 'bullet',
      text: detail ? `${from} → ${to} (${detail})` : `${from} → ${to}`,
    })
  }

  // Somewhere to start writing about what was just captured.
  blocks.push({ type: 'body', text: '' })
  return blocks
}

/**
 * Icons from the selection, for "Import to notes".
 *
 * Separate from the prose outline: a picture of the component is what you want next to a
 * sketch, not another bullet that says its name.
 */
export function imagesFromSelection(
  nodes: ArchitectureNode[],
  selectedIds: string[]
): NoteBlockDraft[] {
  const selected = new Set(selectedIds)
  const out: NoteBlockDraft[] = []

  for (const node of nodes) {
    if (!selected.has(node.id) || node.type !== 'architecture') continue
    const icon = node.data?.icon
    if (typeof icon !== 'string' || !icon) continue
    out.push({ type: 'image', text: labelOf(node), src: icon })
  }

  return out
}
