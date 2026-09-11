'use client'

/**
 * Simulation Engine
 *
 * Runs on requestAnimationFrame. Maintains a list of in-flight packets,
 * advances them along edges, generates log entries, updates node stats,
 * and communicates exclusively through the simulationStore.
 *
 * Architecture:
 *   1. Build a directed adjacency graph from the current diagram edges.
 *   2. BFS from the start node to enumerate all reachable paths.
 *   3. For each request, pick a path (random or round-robin), spawn a packet per edge.
 *   4. Each frame: advance all live packets by (dt * speed). When progress >= 1,
 *      the packet arrives → log entry + node stat update + spawn next edge packet.
 *   5. When all packets for a request finish, mark request complete.
 */

import type { ArchitectureNode, ArchitectureEdge } from '@/types/diagram'
import type { SimPacket, SimLogEntry, NodeStat, SimConfig } from '@/types/simulation'
import { useSimulationStore } from '@/store/simulationStore'
import { useDiagramStore } from '@/store/diagramStore'

// ─── constants ────────────────────────────────────────────────────────────────

const BASE_EDGE_PX    = 200   // notional edge length (px) — affects travel time
const BASE_LATENCY_MS = 20    // base one-hop latency (ms)
const FRAME_MS        = 16    // ~60fps

const PACKET_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EF4444', // red
  '#0EA5E9', // sky
  '#F97316', // orange
  '#EC4899', // pink
]

// ─── helpers ─────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function nodeLabel(nodes: ArchitectureNode[], id: string): string {
  const n = nodes.find((n) => n.id === id)
  if (!n) return id.slice(0, 8)
  const d = n.data as any
  return d?.label ?? d?.name ?? id.slice(0, 8)
}

// Build adjacency list: nodeId → [{ edgeId, targetId }]
function buildGraph(edges: ArchitectureEdge[]): Map<string, { edgeId: string; targetId: string }[]> {
  const graph = new Map<string, { edgeId: string; targetId: string }[]>()
  for (const e of edges) {
    if (!graph.has(e.source)) graph.set(e.source, [])
    graph.get(e.source)!.push({ edgeId: e.id, targetId: e.target })
    // Bidirectional edges also go the other way
    const d = e.data as any
    if (d?.connectionType === 'bidirectional') {
      if (!graph.has(e.target)) graph.set(e.target, [])
      graph.get(e.target)!.push({ edgeId: e.id, targetId: e.source })
    }
  }
  return graph
}

// BFS: find all simple paths from start up to maxDepth hops
function findPaths(
  graph: Map<string, { edgeId: string; targetId: string }[]>,
  start: string,
  maxDepth = 12,
): string[][] {
  const paths: string[][] = []
  const queue: { path: string[]; visited: Set<string> }[] = [
    { path: [start], visited: new Set([start]) },
  ]

  while (queue.length > 0) {
    const { path, visited } = queue.shift()!
    const current = path[path.length - 1]
    const neighbours = graph.get(current) ?? []

    if (neighbours.length === 0 || path.length >= maxDepth) {
      if (path.length > 1) paths.push(path)
      continue
    }

    let extended = false
    for (const { targetId } of neighbours) {
      if (visited.has(targetId)) continue
      extended = true
      const newVisited = new Set(visited)
      newVisited.add(targetId)
      queue.push({ path: [...path, targetId], visited: newVisited })
    }
    if (!extended && path.length > 1) paths.push(path)
  }

  // Sort by length — prefer longer paths for better visualisation
  return paths.sort((a, b) => b.length - a.length)
}

// Given a path (node IDs), return the edge IDs connecting each hop
function pathToEdges(
  graph: Map<string, { edgeId: string; targetId: string }[]>,
  path: string[],
): string[] {
  const edgeIds: string[] = []
  for (let i = 0; i < path.length - 1; i++) {
    const neighbours = graph.get(path[i]) ?? []
    const hop = neighbours.find((n) => n.targetId === path[i + 1])
    if (hop) edgeIds.push(hop.edgeId)
  }
  return edgeIds
}

// ─── Engine class ─────────────────────────────────────────────────────────────

class SimulationEngine {
  private rafId: number | null = null
  private lastTime = 0
  private requestIndex = 0
  private paths: string[][] = []
  private pathEdges: string[][] = []
  private graph = new Map<string, { edgeId: string; targetId: string }[]>()
  private activePackets: SimPacket[] = []
  private pendingRequests = 0
  private dispatchInterval: ReturnType<typeof setInterval> | null = null

  // ─── Public lifecycle ───────────────────────────────────────────────────────

  start() {
    const sim = useSimulationStore.getState()
    const diagram = useDiagramStore.getState()

    if (sim.status === 'running') return

    this.reset()

    const { nodes, edges } = diagram
    const { config } = sim

    this.graph = buildGraph(edges)
    this.paths = findPaths(this.graph, config.startNodeId)

    if (this.paths.length === 0) {
      // No paths — just animate a single-node pulse
      useSimulationStore.getState().setNodeStatus(config.startNodeId, 'active')
      setTimeout(() => {
        useSimulationStore.getState().clearNodeStatus(config.startNodeId)
        useSimulationStore.getState().setStatus('finished')
      }, 1000)
      useSimulationStore.getState().setStatus('running')
      return
    }

    this.pathEdges = this.paths.map((p) => pathToEdges(this.graph, p))

    useSimulationStore.getState().setStatus('running')
    useSimulationStore.getState().updateStats({ startedAt: Date.now() })

    // Dispatch first batch immediately, then on interval
    this._dispatchBatch(nodes, edges, config)
    if (config.mode === 'load-test' || config.concurrency > 1) {
      this.dispatchInterval = setInterval(() => {
        const state = useSimulationStore.getState()
        if (state.status !== 'running') { this._clearInterval(); return }
        if (state.stats.totalRequests >= config.maxRequests) {
          this._clearInterval()
          return
        }
        this._dispatchBatch(nodes, edges, config)
      }, 800 / config.speedMultiplier)
    }

    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this._tick.bind(this))
  }

  pause() {
    const { status } = useSimulationStore.getState()
    if (status === 'running') {
      useSimulationStore.getState().setStatus('paused')
      this._clearRaf()
    } else if (status === 'paused') {
      useSimulationStore.getState().setStatus('running')
      this.lastTime = performance.now()
      this.rafId = requestAnimationFrame(this._tick.bind(this))
    }
  }

  stop() {
    this._clearRaf()
    this._clearInterval()
    useSimulationStore.getState().finaliseStats()
    useSimulationStore.getState().setStatus('finished')
    // Clear all node statuses after a beat
    setTimeout(() => {
      Object.keys(useSimulationStore.getState().nodeStatuses).forEach((id) =>
        useSimulationStore.getState().clearNodeStatus(id)
      )
      useSimulationStore.getState().setActiveEdges(new Set())
    }, 600)
  }

  reset() {
    this._clearRaf()
    this._clearInterval()
    this.requestIndex = 0
    this.activePackets = []
    this.pendingRequests = 0
    useSimulationStore.getState().reset()
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _dispatchBatch(
    nodes: ArchitectureNode[],
    edges: ArchitectureEdge[],
    config: SimConfig,
  ) {
    const state = useSimulationStore.getState()
    const remaining = config.maxRequests - state.stats.totalRequests
    if (remaining <= 0) return

    const batch = Math.min(config.concurrency, remaining)
    for (let i = 0; i < batch; i++) {
      this._spawnRequest(nodes, edges, config)
    }
  }

  private _spawnRequest(
    nodes: ArchitectureNode[],
    edges: ArchitectureEdge[],
    config: SimConfig,
  ) {
    if (this.paths.length === 0) return

    const idx = this.requestIndex++
    const pathIdx = idx % this.paths.length
    const path = this.paths[pathIdx]
    const edgeIds = this.pathEdges[pathIdx]

    if (edgeIds.length === 0) return

    const color = PACKET_COLORS[idx % PACKET_COLORS.length]
    const firstEdgeId = edgeIds[0]
    const firstEdge = edges.find((e) => e.id === firstEdgeId)
    if (!firstEdge) return

    useSimulationStore.getState().updateStats({
      totalRequests: useSimulationStore.getState().stats.totalRequests + 1,
    })

    // Pulse start node
    useSimulationStore.getState().setNodeStatus(path[0], 'active')
    setTimeout(() => useSimulationStore.getState().clearNodeStatus(path[0]), 400)

    const packet: SimPacket = {
      id: uid(),
      edgeId: firstEdgeId,
      sourceId: firstEdge.source,
      targetId: firstEdge.target,
      progress: 0,
      speed: this._packetSpeed(firstEdgeId, config),
      status: 'travelling',
      requestIndex: idx,
      startTime: performance.now(),
      path,
      pathStep: 0,
      color,
    }

    this.activePackets.push(packet)
    this.pendingRequests++
  }

  private _packetSpeed(edgeId: string, config: SimConfig): number {
    const base = (BASE_EDGE_PX / (BASE_LATENCY_MS / 1000)) * config.speedMultiplier
    if (config.failure.slowEdges.has(edgeId)) {
      return base / config.failure.slowFactor
    }
    return base
  }

  private _tick(now: number) {
    const state = useSimulationStore.getState()
    if (state.status !== 'running') return

    const dt = Math.min((now - this.lastTime) / 1000, 0.05) // cap at 50ms
    this.lastTime = now

    const diagram = useDiagramStore.getState()
    const { nodes, edges } = diagram
    const config = state.config

    const nextPackets: SimPacket[] = []
    const activeEdgeIds = new Set<string>()

    for (const packet of this.activePackets) {
      if (packet.status !== 'travelling') continue

      // Advance progress
      const edge = edges.find((e) => e.id === packet.edgeId)
      const edgeLen = this._edgeLength(edge, nodes)
      const advance = (packet.speed * dt) / edgeLen

      const updatedPacket = { ...packet, progress: packet.progress + advance }

      if (updatedPacket.progress >= 1) {
        // Arrived at target node
        this._onArrival(updatedPacket, nodes, edges, config, nextPackets)
      } else {
        activeEdgeIds.add(packet.edgeId)
        nextPackets.push(updatedPacket)
      }
    }

    this.activePackets = nextPackets
    useSimulationStore.getState().setPackets([...nextPackets])
    useSimulationStore.getState().setActiveEdges(activeEdgeIds)

    // Check completion
    if (this.activePackets.length === 0 && this.pendingRequests <= 0) {
      if (config.loop && state.stats.totalRequests < config.maxRequests) {
        this._dispatchBatch(nodes, edges, config)
      } else {
        this.stop()
        return
      }
    }

    this.rafId = requestAnimationFrame(this._tick.bind(this))
  }

  private _onArrival(
    packet: SimPacket,
    nodes: ArchitectureNode[],
    edges: ArchitectureEdge[],
    config: SimConfig,
    nextPackets: SimPacket[],
  ) {
    const travelMs = ((performance.now() - packet.startTime) / packet.path.length) * (1 / config.speedMultiplier)

    // Determine failure
    const failed =
      config.failure.failNodes.has(packet.targetId) ||
      Math.random() < config.failure.errorRate

    const isSlow = config.failure.slowEdges.has(packet.edgeId)
    const status: 'ok' | 'error' | 'slow' = failed ? 'error' : isSlow ? 'slow' : 'ok'

    // Log entry
    const edge = edges.find((e) => e.id === packet.edgeId)
    const logEntry: SimLogEntry = {
      id: uid(),
      timestamp: Date.now(),
      sourceLabel: nodeLabel(nodes, packet.sourceId),
      targetLabel: nodeLabel(nodes, packet.targetId),
      edgeId: packet.edgeId,
      latencyMs: Math.round(travelMs),
      status,
      protocol: (edge?.data as any)?.protocol,
    }
    useSimulationStore.getState().addLogEntry(logEntry)

    // Node stat
    const existingStat = useSimulationStore.getState().nodeStats[packet.targetId]
    const reqIn = (existingStat?.requestsIn ?? 0) + 1
    const totalLat = (existingStat?.totalLatencyMs ?? 0) + travelMs
    const errors = (existingStat?.errors ?? 0) + (failed ? 1 : 0)
    useSimulationStore.getState().updateNodeStat(packet.targetId, {
      nodeId: packet.targetId,
      requestsIn: reqIn,
      totalLatencyMs: totalLat,
      avgLatencyMs: totalLat / reqIn,
      errors,
      isBottleneck: totalLat / reqIn > 200,
    })

    // Pulse target node
    const nodeStatus: import('@/types/simulation').NodeSimStatus = failed ? 'error' : isSlow ? 'slow' : 'active'
    useSimulationStore.getState().setNodeStatus(packet.targetId, nodeStatus)
    setTimeout(
      () => useSimulationStore.getState().clearNodeStatus(packet.targetId),
      failed ? 1200 : 500,
    )

    if (failed) {
      // Mark the edge as failed visually
      useSimulationStore.getState().setFailedEdge(packet.edgeId)
      // Request dies here
      this.pendingRequests--
      useSimulationStore.getState().updateStats({
        failedRequests: useSimulationStore.getState().stats.failedRequests + 1,
      })
      return
    }

    // Advance to next hop
    const nextStep = packet.pathStep + 1
    if (nextStep >= packet.path.length - 1) {
      // Completed full path
      this.pendingRequests--
      useSimulationStore.getState().updateStats({
        completedRequests: useSimulationStore.getState().stats.completedRequests + 1,
      })
      return
    }

    const nextSourceId = packet.path[nextStep]
    const nextTargetId = packet.path[nextStep + 1]
    const nextEdge = edges.find(
      (e) => e.source === nextSourceId && e.target === nextTargetId,
    )
    if (!nextEdge) {
      this.pendingRequests--
      return
    }

    const nextPacket: SimPacket = {
      ...packet,
      id: uid(),
      edgeId: nextEdge.id,
      sourceId: nextSourceId,
      targetId: nextTargetId,
      progress: 0,
      speed: this._packetSpeed(nextEdge.id, config),
      startTime: performance.now(),
      pathStep: nextStep,
      status: 'travelling',
    }
    nextPackets.push(nextPacket)
  }

  // Estimate edge length from node positions for proportional travel time
  private _edgeLength(
    edge: ArchitectureEdge | undefined,
    nodes: ArchitectureNode[],
  ): number {
    if (!edge) return BASE_EDGE_PX
    const src = nodes.find((n) => n.id === edge.source)
    const tgt = nodes.find((n) => n.id === edge.target)
    if (!src || !tgt) return BASE_EDGE_PX
    const dx = (tgt.position?.x ?? 0) - (src.position?.x ?? 0)
    const dy = (tgt.position?.y ?? 0) - (src.position?.y ?? 0)
    return Math.max(Math.sqrt(dx * dx + dy * dy), 60)
  }

  private _clearRaf() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  private _clearInterval() {
    if (this.dispatchInterval !== null) {
      clearInterval(this.dispatchInterval)
      this.dispatchInterval = null
    }
  }
}

// Singleton instance
export const simulationEngine = new SimulationEngine()
