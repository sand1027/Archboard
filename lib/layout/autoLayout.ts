import type { ArchitectureNode, ArchitectureEdge } from '@/types/diagram'

type LayoutDirection = 'horizontal' | 'vertical' | 'hierarchical'

const NODE_WIDTH = 120
const NODE_HEIGHT = 100
const H_GAP = 60
const V_GAP = 80

export function applyAutoLayout(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[],
  direction: LayoutDirection = 'vertical'
): ArchitectureNode[] {
  if (nodes.length === 0) return nodes

  if (direction === 'hierarchical') {
    return hierarchicalLayout(nodes, edges)
  }

  const cols = direction === 'horizontal'
    ? nodes.length
    : Math.ceil(Math.sqrt(nodes.length))

  return nodes.map((node, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      ...node,
      position: {
        x: col * (NODE_WIDTH + H_GAP) + 100,
        y: row * (NODE_HEIGHT + V_GAP) + 100,
      },
    }
  })
}

function hierarchicalLayout(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[]
): ArchitectureNode[] {
  // Build adjacency for topological sort
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  nodes.forEach((n) => {
    inDegree.set(n.id, 0)
    adjacency.set(n.id, [])
  })

  edges.forEach((e) => {
    if (inDegree.has(e.target)) {
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
    }
    if (adjacency.has(e.source)) {
      adjacency.get(e.source)!.push(e.target)
    }
  })

  // BFS level assignment
  const levels = new Map<string, number>()
  const queue: string[] = []

  inDegree.forEach((deg, id) => {
    if (deg === 0) {
      queue.push(id)
      levels.set(id, 0)
    }
  })

  while (queue.length > 0) {
    const current = queue.shift()!
    const currentLevel = levels.get(current) ?? 0
    adjacency.get(current)?.forEach((neighbor) => {
      const existingLevel = levels.get(neighbor)
      const newLevel = currentLevel + 1
      if (existingLevel === undefined || existingLevel < newLevel) {
        levels.set(neighbor, newLevel)
      }
      queue.push(neighbor)
    })
  }

  // Group by level
  const byLevel = new Map<number, string[]>()
  nodes.forEach((n) => {
    const level = levels.get(n.id) ?? 0
    if (!byLevel.has(level)) byLevel.set(level, [])
    byLevel.get(level)!.push(n.id)
  })

  // Position nodes
  const positionMap = new Map<string, { x: number; y: number }>()
  byLevel.forEach((ids, level) => {
    const totalWidth = ids.length * (NODE_WIDTH + H_GAP) - H_GAP
    const startX = -totalWidth / 2 + 400

    ids.forEach((id, i) => {
      positionMap.set(id, {
        x: startX + i * (NODE_WIDTH + H_GAP),
        y: level * (NODE_HEIGHT + V_GAP) + 80,
      })
    })
  })

  return nodes.map((n) => ({
    ...n,
    position: positionMap.get(n.id) ?? n.position,
  }))
}
