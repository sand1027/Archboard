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
import type {
  SimPacket,
  SimLogEntry,
  SimConfig,
  NodeSimStatus,
} from '@/types/simulation'
import { useSimulationStore } from '@/store/simulationStore'
import { useDiagramStore } from '@/store/diagramStore'
import {
  advanceProgress,
  dispatchIntervalMs,
  hopDurationMs,
  hopLatencyMs,
} from './timing'
import { decideFailure, failureLabel, isSlowEdge } from './failure'
import {
  MAX_LIVE_PACKETS,
  buildGraph,
  hasOutgoing,
  nextHops,
  readDataString,
  type Graph,
} from './traversal'

// ─── constants ────────────────────────────────────────────────────────────────

/** Fallback edge length when node geometry is unavailable. */
const FALLBACK_EDGE_PX = 200

/** Reported one-hop latency. A statistic, not a playback duration — see timing.ts. */
const BASE_LATENCY_MS = 20

/** Average hop latency above which a node is called a bottleneck. */
const BOTTLENECK_MS = 200

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
  const node = nodes.find((n) => n.id === id)
  if (!node) return id.slice(0, 8)
  return (
    readDataString(node.data, 'label') ?? readDataString(node.data, 'name') ?? id.slice(0, 8)
  )
}

// ─── Engine class ─────────────────────────────────────────────────────────────

class SimulationEngine {
  private rafId: number | null = null
  private lastTime = 0
  private requestIndex = 0
  private graph: Graph = new Map()
  private activePackets: SimPacket[] = []
  private dispatchInterval: ReturnType<typeof setInterval> | null = null

  /**
   * Live branch count per request.
   *
   * A request fans out, so it is not finished when one packet arrives somewhere —
   * it is finished when its last branch runs out of downstreams. A single
   * `pendingRequests` counter could not express that.
   */
  private branches = new Map<number, { live: number; failed: boolean }>()

  /**
   * Every pending node-pulse timeout.
   *
   * These used to be fire-and-forget. A reset left them queued, so a few hundred
   * milliseconds later they would write node statuses back onto an idle canvas,
   * and stop()'s own cleanup timer could wipe the highlights of a run the user had
   * already restarted.
   */
  private timers = new Set<ReturnType<typeof setTimeout>>()

  // ─── Public lifecycle ───────────────────────────────────────────────────────

  start() {
    const sim = useSimulationStore.getState()
    const diagram = useDiagramStore.getState()

    if (sim.status === 'running') return

    this.reset()

    const { nodes, edges } = diagram
    const { config } = sim

    this.graph = buildGraph(edges)

    if (!hasOutgoing(this.graph, config.startNodeId)) {
      // Nowhere to go — just animate a single-node pulse
      useSimulationStore.getState().setNodeStatus(config.startNodeId, 'active')
      this._later(() => {
        useSimulationStore.getState().clearNodeStatus(config.startNodeId)
        useSimulationStore.getState().setStatus('finished')
      }, 1000)
      useSimulationStore.getState().setStatus('running')
      return
    }

    useSimulationStore.getState().setStatus('running')
    useSimulationStore.getState().updateStats({ startedAt: Date.now() })

    // Dispatch first batch immediately, then on interval
    this._dispatchBatch(nodes, edges, config)
    if (config.mode === 'load-test' || config.concurrency > 1) {
      this.dispatchInterval = setInterval(() => {
        const state = useSimulationStore.getState()
        if (state.status !== 'running') { this._clearInterval(); return }
        if (state.stats.totalRequests >= state.config.maxRequests) {
          this._clearInterval()
          return
        }
        // Re-read the diagram: a load test can outlive the layout it started with,
        // and _tick already reads fresh state every frame. Capturing nodes/edges
        // here made newly spawned requests traverse a stale graph.
        const live = useDiagramStore.getState()
        this._dispatchBatch(live.nodes, live.edges, state.config)
      }, dispatchIntervalMs(config.speedMultiplier))
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
    this._clearTimers()
    this.activePackets = []
    useSimulationStore.getState().finaliseStats()
    useSimulationStore.getState().setStatus('finished')
    // Packets in flight when the user hits stop have nowhere to go. Left in the
    // store they freeze mid-edge, and the edge styling has already reverted to its
    // normal look around them.
    useSimulationStore.getState().setPackets([])
    // Clear all node statuses after a beat
    this._later(() => {
      Object.keys(useSimulationStore.getState().nodeStatuses).forEach((id) =>
        useSimulationStore.getState().clearNodeStatus(id)
      )
      useSimulationStore.getState().setActiveEdges(new Set())
    }, 600)
  }

  reset() {
    this._clearRaf()
    this._clearInterval()
    this._clearTimers()
    this.requestIndex = 0
    this.activePackets = []
    this.branches.clear()
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
    const start = config.startNodeId
    const trail = [start]
    const hops = nextHops(this.graph, start, trail)
    if (hops.length === 0) return

    const idx = this.requestIndex++
    const color = PACKET_COLORS[idx % PACKET_COLORS.length]

    useSimulationStore.getState().updateStats({
      totalRequests: useSimulationStore.getState().stats.totalRequests + 1,
    })

    // Pulse start node
    useSimulationStore.getState().setNodeStatus(start, 'active')
    this._later(() => useSimulationStore.getState().clearNodeStatus(start), 400)

    // One branch per outgoing edge. A client wired to both a CDN and a load
    // balancer exercises both, rather than whichever happened to head the sorted
    // path list.
    for (const hop of hops) {
      const packet = this._makePacket(idx, color, start, hop, trail, nodes, edges, config)
      if (packet) this.activePackets.push(packet)
    }
  }

  /**
   * Build a packet for one hop, and register it as a live branch of its request.
   *
   * Returns null when the edge has gone missing between planning and spawning, in
   * which case no branch is registered and nothing leaks.
   */
  private _makePacket(
    requestIndex: number,
    color: string,
    sourceId: string,
    hop: { edgeId: string; targetId: string },
    trail: readonly string[],
    nodes: ArchitectureNode[],
    edges: ArchitectureEdge[],
    config: SimConfig,
  ): SimPacket | null {
    const edge = edges.find((e) => e.id === hop.edgeId)
    if (!edge) return null

    const existing = this.branches.get(requestIndex)
    if (existing) existing.live++
    else this.branches.set(requestIndex, { live: 1, failed: false })

    return {
      id: uid(),
      edgeId: hop.edgeId,
      sourceId,
      targetId: hop.targetId,
      progress: 0,
      durationMs: this._hopDuration(
        hop.edgeId,
        this._edgeLength(edge, nodes),
        config
      ),
      status: 'travelling',
      requestIndex,
      startTime: performance.now(),
      trail: [...trail, hop.targetId],
      color,
    }
  }

  /**
   * Retire one branch of a request, and count the request itself once its last
   * branch has finished.
   *
   * Counted per request rather than per branch, so the totals still add up: a
   * request that fans out to four downstreams is one request, and it lands in
   * `failedRequests` if any branch failed, `completedRequests` otherwise.
   */
  private _endBranch(requestIndex: number, failed: boolean) {
    const entry = this.branches.get(requestIndex)
    if (!entry) return

    entry.live--
    if (failed) entry.failed = true
    if (entry.live > 0) return

    this.branches.delete(requestIndex)
    const stats = useSimulationStore.getState().stats
    useSimulationStore.getState().updateStats(
      entry.failed
        ? { failedRequests: stats.failedRequests + 1 }
        : { completedRequests: stats.completedRequests + 1 }
    )
  }

  /**
   * How long this packet should take to cross the edge, in milliseconds.
   *
   * This used to be a pixels-per-second figure derived from BASE_LATENCY_MS, which
   * treated a 20ms notional latency as 20ms of wall clock and worked out to roughly
   * 10,000 px/s — a hop finished in one to four frames, so nothing was ever visible.
   * Playback tempo now comes from timing.ts and is independent of reported latency.
   */
  private _hopDuration(edgeId: string, lengthPx: number, config: SimConfig): number {
    return hopDurationMs({
      lengthPx,
      speedMultiplier: config.speedMultiplier,
      slowFactor: config.failure.slowEdges.has(edgeId) ? config.failure.slowFactor : 1,
    })
  }

  private _later(fn: () => void, ms: number) {
    const id = setTimeout(() => {
      this.timers.delete(id)
      fn()
    }, ms)
    this.timers.add(id)
  }

  private _tick(now: number) {
    const state = useSimulationStore.getState()
    if (state.status !== 'running') return

    // Cap the step so a backgrounded tab does not teleport every packet to its
    // destination the moment it regains focus.
    const dtMs = Math.min(now - this.lastTime, 50)
    this.lastTime = now

    const diagram = useDiagramStore.getState()
    const { nodes, edges } = diagram
    const config = state.config

    const nextPackets: SimPacket[] = []
    const activeEdgeIds = new Set<string>()

    // Every stored packet is travelling by construction: _makePacket is the only
    // producer and it always sets that status, and a packet that arrives is replaced
    // rather than re-stored. The previous `status !== 'travelling'` guard here
    // looked defensive but was unreachable, and either branch of it was wrong —
    // skipping leaked a branch and hung the completion check, decrementing risked
    // double-counting against _onArrival.
    for (const packet of this.activePackets) {
      const updatedPacket = {
        ...packet,
        progress: advanceProgress(packet.progress, dtMs, packet.durationMs),
      }

      if (updatedPacket.progress >= 1) {
        // Arrived at target node
        this._onArrival(updatedPacket, nodes, edges, config, nextPackets)
      } else {
        activeEdgeIds.add(packet.edgeId)
        nextPackets.push(updatedPacket)
      }
    }

    // Packets created by _onArrival start this frame too. Without them the edge
    // highlight blinked off for one frame at every hop.
    for (const packet of nextPackets) activeEdgeIds.add(packet.edgeId)

    this.activePackets = nextPackets
    useSimulationStore.getState().setPackets([...nextPackets])
    useSimulationStore.getState().setActiveEdges(activeEdgeIds)

    // Check completion. A request is outstanding while it still has a live branch,
    // so an empty branch table means the whole run has drained.
    if (this.activePackets.length === 0 && this.branches.size === 0) {
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
    // Determine failure. The dice roll is supplied here so the rule itself stays a
    // pure function — see failure.ts.
    const decision = decideFailure(packet.targetId, config.failure, Math.random())
    const failed = decision.failed

    const isSlow = isSlowEdge(packet.edgeId, config.failure)
    const status: 'ok' | 'error' | 'slow' = failed ? 'error' : isSlow ? 'slow' : 'ok'

    // Modelled, not measured. The old version divided wall-clock animation time by
    // the path length and scaled by the speed multiplier, so dragging the speed
    // slider changed the latency the panel reported.
    const travelMs = hopLatencyMs(BASE_LATENCY_MS, isSlow, config.failure.slowFactor)

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
      protocol: readDataString(edge?.data, 'protocol'),
      // Says which rule fired, so a red row in the log distinguishes "you marked
      // this node down" from "the error rate rolled badly".
      cause: decision.reason ? failureLabel(decision.reason) : undefined,
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
      isBottleneck: totalLat / reqIn > BOTTLENECK_MS,
    })

    // Pulse target node
    const nodeStatus: NodeSimStatus = failed ? 'error' : isSlow ? 'slow' : 'active'
    useSimulationStore.getState().setNodeStatus(packet.targetId, nodeStatus)
    this._later(
      () => useSimulationStore.getState().clearNodeStatus(packet.targetId),
      failed ? 1200 : 500,
    )

    if (failed) {
      // Mark the edge as failed visually. This branch dies here; siblings continue.
      useSimulationStore.getState().setFailedEdge(packet.edgeId)
      this._endBranch(packet.requestIndex, true)
      return
    }

    // Fan out to everything downstream of the node just reached. The route is
    // decided here rather than pre-planned, so a server that talks to a cache, a
    // database and a queue lights up all three.
    //
    // Truncated against the global ceiling: branching is multiplicative, and a mesh
    // diagram would otherwise keep doubling until the frame budget is gone.
    const budget = MAX_LIVE_PACKETS - nextPackets.length
    const onward =
      budget > 0 ? nextHops(this.graph, packet.targetId, packet.trail).slice(0, budget) : []

    if (onward.length === 0) {
      // End of the flow for this branch — a sink node, a cycle already visited, or
      // the depth cap.
      this._endBranch(packet.requestIndex, false)
      return
    }

    // This branch becomes its children, so retire it once they are registered;
    // doing it in the other order could momentarily drop the count to zero and
    // complete the request early.
    let spawned = 0
    for (const hop of onward) {
      const next = this._makePacket(
        packet.requestIndex,
        packet.color,
        packet.targetId,
        hop,
        packet.trail,
        nodes,
        edges,
        config
      )
      if (next) {
        nextPackets.push(next)
        spawned++
      }
    }
    this._endBranch(packet.requestIndex, false)

    // Every candidate edge vanished mid-flight; nothing was registered to replace
    // this branch, and _endBranch above has already accounted for it.
    if (spawned === 0) return
  }

  // Estimate edge length from node positions for proportional travel time
  private _edgeLength(
    edge: ArchitectureEdge | undefined,
    nodes: ArchitectureNode[],
  ): number {
    if (!edge) return FALLBACK_EDGE_PX
    const src = nodes.find((n) => n.id === edge.source)
    const tgt = nodes.find((n) => n.id === edge.target)
    if (!src || !tgt) return FALLBACK_EDGE_PX
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

  private _clearTimers() {
    for (const id of this.timers) clearTimeout(id)
    this.timers.clear()
  }
}

// Singleton instance
export const simulationEngine = new SimulationEngine()
