import type { ArchitectureEdge, ArchitectureNode } from '@/types/diagram'
import { buildGroups, type GroupMap } from '@/lib/simulation/groups'
import { nodeBounds } from './geometry'

/**
 * Deterministic auto-placement for an architecture diagram.
 *
 * Written rather than delegated to ELK or dagre for one reason: neither is stable under
 * small edits. A layered algorithm re-solves the whole graph, so adding one node can
 * rearrange the other twenty — which, for a diagram someone has been reading and editing
 * for an hour, is a regression however tidy the result. Here ranking is longest-path (a
 * node's rank depends only on what feeds it) and within-rank order is declaration order,
 * so appending a component appends it and leaves the rest alone.
 *
 * Three properties it guarantees:
 *   - Same input, same output. No randomness, no iteration to convergence.
 *   - Frames physically enclose their members, because containment in this app *is*
 *     geometry (see lib/canvas/geometry.ts) — a frame that does not wrap its children is
 *     not a frame that contains them.
 *   - A pinned node stays where it was put, and its frame grows to keep holding it.
 */

/** Gap between siblings across a rank. */
const SIBLING_GAP = 64
/** Gap between one rank and the next, along the flow. */
const RANK_GAP = 72
const FRAME_PADDING = 28
/** Room at the top of a frame for its label. */
const FRAME_HEADER = 40
const MIN_FRAME_W = 200
const MIN_FRAME_H = 140
/** Used when a node has no size yet, matching lib/canvas/geometry.ts. */
const FALLBACK_W = 100
const FALLBACK_H = 80

export interface Point {
  x: number
  y: number
}

export type LayoutDirection = 'down' | 'right'

export interface LayoutOptions {
  /**
   * Known containment, child node id to frame node id.
   *
   * Without it, containment is recovered geometrically — which is right for a diagram
   * drawn on the canvas, but useless for a freshly compiled one where everything still
   * sits at the origin. The DSL compiler hands this over.
   */
  hierarchy?: Record<string, string>
  /**
   * Positions the user set by hand, keyed by node id.
   *
   * Applied after the flow is solved, so a pin always wins. This is what keeps the text
   * free of coordinates: the arrangement someone dragged into place lives here, beside the
   * diagram, not smeared through the source.
   */
  pins?: Record<string, Point>
  direction?: LayoutDirection
  /** Top-left of the laid-out diagram. */
  origin?: Point
}

export interface LayoutResult {
  nodes: ArchitectureNode[]
  /** Bounding box of everything placed. */
  width: number
  height: number
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * A measured subtree.
 *
 * Sizes are worked out bottom-up before anything is positioned, because a frame's size is
 * its contents' size and its position is decided by its parent. `place` runs top-down once
 * both are known.
 */
interface Measured {
  /** Extent along the flow direction. */
  main: number
  /** Extent across it. */
  cross: number
  place: (main: number, cross: number) => void
}

export function autoLayout(
  snapshot: { nodes: ArchitectureNode[]; edges: ArchitectureEdge[] },
  options: LayoutOptions = {}
): LayoutResult {
  const { nodes, edges } = snapshot
  if (nodes.length === 0) return { nodes: [], width: 0, height: 0 }

  const direction: LayoutDirection = options.direction ?? 'down'
  const origin = options.origin ?? { x: 0, y: 0 }
  const groups = resolveHierarchy(nodes, options.hierarchy)

  // Declaration order — the tiebreak that makes the result stable under an append.
  const order = new Map(nodes.map((node, index) => [node.id, index]))
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const placements = new Map<string, Rect>()

  const engine = new LayoutEngine(nodes, edges, groups, order, byId, direction, placements)

  const roots = nodes.filter((node) => !groups.parentOf.has(node.id)).map((node) => node.id)
  const measured = engine.measureLevel(roots)
  measured.place(0, 0)

  // Local space starts wherever the ranks put it; shift so the caller's origin is the corner.
  normalise(placements, origin)

  applyPins(placements, options.pins)
  // After pinning, a frame may no longer enclose a member. Containment is geometric here,
  // so a frame that does not wrap its children has genuinely stopped containing them.
  refitFrames(placements, groups, byId)

  const laidOut = nodes.map((node) => {
    const rect = placements.get(node.id)
    if (!rect) return node

    if (node.type === 'frame') {
      return {
        ...node,
        position: { x: rect.x, y: rect.y },
        width: rect.w,
        height: rect.h,
        style: { ...node.style, width: rect.w, height: rect.h },
      }
    }
    return { ...node, position: { x: rect.x, y: rect.y } }
  })

  const bounds = boundsOfRects([...placements.values()])
  return {
    nodes: laidOut,
    width: bounds ? bounds.w : 0,
    height: bounds ? bounds.h : 0,
  }
}

class LayoutEngine {
  constructor(
    private readonly nodes: ArchitectureNode[],
    private readonly edges: ArchitectureEdge[],
    private readonly groups: GroupMap,
    private readonly order: Map<string, number>,
    private readonly byId: Map<string, ArchitectureNode>,
    private readonly direction: LayoutDirection,
    private readonly placements: Map<string, Rect>
  ) {}

  /** Measure and position one set of siblings, in that set's own coordinate space. */
  measureLevel(ids: string[]): Measured {
    if (ids.length === 0) {
      return { main: 0, cross: 0, place: () => {} }
    }

    const sorted = [...ids].sort((a, b) => (this.order.get(a) ?? 0) - (this.order.get(b) ?? 0))
    const measuredById = new Map<string, Measured>()
    for (const id of sorted) measuredById.set(id, this.measureOne(id))

    const ranks = this.rankSiblings(sorted)

    // Rows in rank order; within a row, declaration order.
    const rows: { items: { id: string; measured: Measured }[]; main: number; cross: number }[] = []
    const maxRank = Math.max(...sorted.map((id) => ranks.get(id) ?? 0))

    for (let rank = 0; rank <= maxRank; rank++) {
      const items = sorted
        .filter((id) => (ranks.get(id) ?? 0) === rank)
        .map((id) => ({ id, measured: measuredById.get(id)! }))
      if (items.length === 0) continue

      const main = Math.max(...items.map((i) => i.measured.main))
      const cross =
        items.reduce((sum, i) => sum + i.measured.cross, 0) + SIBLING_GAP * (items.length - 1)
      rows.push({ items, main, cross })
    }

    const totalCross = Math.max(...rows.map((r) => r.cross))
    const totalMain = rows.reduce((sum, r) => sum + r.main, 0) + RANK_GAP * (rows.length - 1)

    return {
      main: totalMain,
      cross: totalCross,
      place: (mainStart, crossStart) => {
        let mainCursor = mainStart

        for (const row of rows) {
          // Rows centred on the diagram's spine, which is what gives an architecture
          // diagram its familiar funnel shape.
          let crossCursor = crossStart + (totalCross - row.cross) / 2

          for (const { measured } of row.items) {
            // Centre each item in the row's thickness so mixed sizes line up.
            measured.place(mainCursor + (row.main - measured.main) / 2, crossCursor)
            crossCursor += measured.cross + SIBLING_GAP
          }
          mainCursor += row.main + RANK_GAP
        }
      },
    }
  }

  private measureOne(id: string): Measured {
    const node = this.byId.get(id)

    if (node?.type === 'frame') return this.measureFrame(id)

    const bounds = node ? nodeBounds(node) : { x: 0, y: 0, w: FALLBACK_W, h: FALLBACK_H }
    const w = bounds.w || FALLBACK_W
    const h = bounds.h || FALLBACK_H

    return {
      main: this.direction === 'down' ? h : w,
      cross: this.direction === 'down' ? w : h,
      place: (main, cross) => {
        this.placements.set(id, toRect(main, cross, w, h, this.direction))
      },
    }
  }

  private measureFrame(id: string): Measured {
    const members = this.groups.members.get(id) ?? []
    const inner = this.measureLevel(members)

    // The header is always at the top in canvas terms, whichever way the flow runs.
    const innerW = this.direction === 'down' ? inner.cross : inner.main
    const innerH = this.direction === 'down' ? inner.main : inner.cross

    const w = Math.max(innerW + FRAME_PADDING * 2, MIN_FRAME_W)
    const h = Math.max(innerH + FRAME_HEADER + FRAME_PADDING, MIN_FRAME_H)

    return {
      main: this.direction === 'down' ? h : w,
      cross: this.direction === 'down' ? w : h,
      place: (main, cross) => {
        const rect = toRect(main, cross, w, h, this.direction)
        this.placements.set(id, rect)

        if (members.length === 0) return
        // Centre the contents horizontally in case the frame was widened to its minimum.
        const innerX = rect.x + (w - innerW) / 2
        const innerY = rect.y + FRAME_HEADER
        inner.place(
          this.direction === 'down' ? innerY : innerX,
          this.direction === 'down' ? innerX : innerY
        )
      },
    }
  }

  /**
   * Longest-path ranking over the siblings.
   *
   * Rank is one past the deepest thing that feeds you, so a node's rank depends only on its
   * ancestors — add a leaf and nothing upstream moves. Edges are lifted to sibling level, so
   * an arrow from a server inside one frame to a database inside another ranks the two
   * frames relative to each other.
   */
  private rankSiblings(ids: string[]): Map<string, number> {
    const siblings = new Set(ids)
    const incoming = new Map<string, string[]>()

    for (const edge of this.edges) {
      const from = this.liftTo(edge.source, siblings)
      const to = this.liftTo(edge.target, siblings)
      if (!from || !to || from === to) continue
      incoming.set(to, [...(incoming.get(to) ?? []), from])
    }

    const ranks = new Map<string, number>()
    const visiting = new Set<string>()

    const rankOf = (id: string): number => {
      const cached = ranks.get(id)
      if (cached !== undefined) return cached

      // A cycle has no longest path. Treating the back edge as absent keeps the result
      // deterministic instead of depending on where the walk started.
      if (visiting.has(id)) return 0
      visiting.add(id)

      let rank = 0
      // Sorted so the walk order — and therefore which edge is called the back edge — is
      // fixed by declaration order rather than by edge order.
      const sources = [...(incoming.get(id) ?? [])].sort(
        (a, b) => (this.order.get(a) ?? 0) - (this.order.get(b) ?? 0)
      )
      for (const source of sources) rank = Math.max(rank, rankOf(source) + 1)

      visiting.delete(id)
      ranks.set(id, rank)
      return rank
    }

    for (const id of ids) rankOf(id)
    return ranks
  }

  /** The sibling in `siblings` that is `id` or contains it, if any. */
  private liftTo(id: string, siblings: Set<string>): string | undefined {
    let current: string | undefined = id
    const seen = new Set<string>()

    while (current && !seen.has(current)) {
      if (siblings.has(current)) return current
      seen.add(current)
      current = this.groups.parentOf.get(current)
    }
    return undefined
  }
}

// ─── passes ───────────────────────────────────────────────────────────────────

function normalise(placements: Map<string, Rect>, origin: Point): void {
  const bounds = boundsOfRects([...placements.values()])
  if (!bounds) return

  const dx = origin.x - bounds.x
  const dy = origin.y - bounds.y
  if (dx === 0 && dy === 0) return

  for (const rect of placements.values()) {
    rect.x += dx
    rect.y += dy
  }
}

function applyPins(placements: Map<string, Rect>, pins: LayoutOptions['pins']): void {
  if (!pins) return

  for (const [id, point] of Object.entries(pins)) {
    const rect = placements.get(id)
    if (!rect) continue
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
    rect.x = point.x
    rect.y = point.y
  }
}

/**
 * Grow every frame to enclose its members, innermost first.
 *
 * Necessary because containment is geometric: after a pin moves a child, the only thing
 * that still makes it a member of its frame is the frame's rectangle covering it.
 */
function refitFrames(
  placements: Map<string, Rect>,
  groups: GroupMap,
  byId: Map<string, ArchitectureNode>
): void {
  const frames = [...groups.containers].filter((id) => byId.get(id)?.type === 'frame')

  // Deepest first, so an inner frame has its final size before the outer one measures it.
  const depthOf = (id: string): number => {
    let depth = 0
    let current = groups.parentOf.get(id)
    const seen = new Set<string>()
    while (current && !seen.has(current)) {
      seen.add(current)
      depth += 1
      current = groups.parentOf.get(current)
    }
    return depth
  }

  for (const id of frames.sort((a, b) => depthOf(b) - depthOf(a))) {
    const frame = placements.get(id)
    if (!frame) continue

    const memberRects = (groups.members.get(id) ?? [])
      .map((memberId) => placements.get(memberId))
      .filter((rect): rect is Rect => rect !== undefined)
    if (memberRects.length === 0) continue

    const inner = boundsOfRects(memberRects)
    if (!inner) continue

    const left = Math.min(frame.x, inner.x - FRAME_PADDING)
    const top = Math.min(frame.y, inner.y - FRAME_HEADER)
    const right = Math.max(frame.x + frame.w, inner.x + inner.w + FRAME_PADDING)
    const bottom = Math.max(frame.y + frame.h, inner.y + inner.h + FRAME_PADDING)

    frame.x = left
    frame.y = top
    frame.w = right - left
    frame.h = bottom - top
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Containment from the caller if it knows, from geometry if not.
 *
 * Same split as the DSL printer: a compiled diagram has no geometry to read yet.
 */
function resolveHierarchy(
  nodes: ArchitectureNode[],
  hierarchy: Record<string, string> | undefined
): GroupMap {
  if (!hierarchy) return buildGroups(nodes)

  const present = new Set(nodes.map((n) => n.id))
  const members = new Map<string, string[]>()
  const parentOf = new Map<string, string>()
  const containers = new Set(nodes.filter((n) => n.type === 'frame').map((n) => n.id))

  for (const [childId, parentId] of Object.entries(hierarchy)) {
    if (!present.has(childId) || !present.has(parentId)) continue
    parentOf.set(childId, parentId)
    members.set(parentId, [...(members.get(parentId) ?? []), childId])
  }

  return { members, parentOf, containers }
}

/** Map flow-relative coordinates back to the canvas axes. */
function toRect(main: number, cross: number, w: number, h: number, direction: LayoutDirection): Rect {
  return direction === 'down'
    ? { x: cross, y: main, w, h }
    : { x: main, y: cross, w, h }
}

function boundsOfRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const rect of rects) {
    minX = Math.min(minX, rect.x)
    minY = Math.min(minY, rect.y)
    maxX = Math.max(maxX, rect.x + rect.w)
    maxY = Math.max(maxY, rect.y + rect.h)
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/**
 * Translate pins stored by DSL name into pins keyed by node id.
 *
 * The sidecar keys by name because that is what survives a recompile — the generated node
 * id does not, so pins keyed by id would be orphaned by the next keystroke.
 */
export function pinsByNodeId(
  pinsByName: Record<string, Point>,
  nodeIdsByName: Record<string, string>
): Record<string, Point> {
  const out: Record<string, Point> = {}
  for (const [name, point] of Object.entries(pinsByName)) {
    const id = nodeIdsByName[name]
    if (id) out[id] = point
  }
  return out
}

/** The reverse, for saving what the user dragged. */
export function pinsByDslName(
  pinsById: Record<string, Point>,
  nodeIdsByName: Record<string, string>
): Record<string, Point> {
  const nameById = new Map(Object.entries(nodeIdsByName).map(([name, id]) => [id, name]))

  const out: Record<string, Point> = {}
  for (const [id, point] of Object.entries(pinsById)) {
    const name = nameById.get(id)
    if (name) out[name] = point
  }
  return out
}
