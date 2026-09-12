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
  NodeStat,
} from '@/types/simulation'
import { useSimulationStore } from '@/store/simulationStore'
import { useDiagramStore } from '@/store/diagramStore'
import {
  advanceProgress,
  dispatchIntervalMs,
  hopDurationMs,
  hopLatencyMs,
  servicePlaybackMs,
  simulatedMs,
} from './timing'
import { decideFailure, failureLabel, isSlowEdge } from './failure'
import {
  bottleneckSeverity,
  nodeCapacity,
  utilisation,
  type NodeCapacity,
} from './capacity'
import {
  MAX_LIVE_PACKETS,
  buildGraph,
  nextHops,
  readDataString,
  type Graph,
  type Hop,
} from './traversal'
import {
  EMPTY_GROUPS,
  buildGroups,
  expandGraphForGroups,
  groupStarters,
  type GroupMap,
} from './groups'

// ─── constants ────────────────────────────────────────────────────────────────

/** Fallback edge length when node geometry is unavailable. */
const FALLBACK_EDGE_PX = 200

/** Reported one-hop latency. A statistic, not a playback duration — see timing.ts. */
const BASE_LATENCY_MS = 20

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

/**
 * A request that has reached a node and needs serving.
 *
 * Carries what the branch will need to continue afterwards, since fan-out now happens
 * when service completes rather than the moment the packet lands.
 */
interface Arrival {
  packetId: string
  requestIndex: number
  color: string
  /** Node being visited — the one whose server it needs. */
  nodeId: string
  /** Inbound edge, kept so the waiting dot can be drawn at the end of it. */
  edgeId: string
  fromNodeId: string
  trail: string[]
  /** performance.now() when it joined the queue. */
  arrivedAt: number
}

interface ServingSlot extends Arrival {
  /** performance.now() when service will finish. */
  endsAt: number
  /** Simulated milliseconds this request spent queued before service began. */
  waitedMs: number
}

/** Per-node serving state for one run. */
interface NodeRuntime {
  capacity: NodeCapacity
  serving: ServingSlot[]
  queue: Arrival[]
  /** Server-milliseconds consumed, summed across servers. */
  busyServerMs: number
  served: number
  forwarded: number
  totalWaitMs: number
  totalResidenceMs: number
  maxQueueDepth: number
}

// ─── Engine class ─────────────────────────────────────────────────────────────

class SimulationEngine {
  private rafId: number | null = null
  private lastTime = 0
  private startedAt = 0
  private requestIndex = 0
  private graph: Graph = new Map()
  private groups: GroupMap = EMPTY_GROUPS
  private activePackets: SimPacket[] = []
  private dispatchInterval: ReturnType<typeof setInterval> | null = null

  /**
   * Serving state per node.
   *
   * Contention is simulated rather than estimated: a request arriving at a node with
   * every server busy waits in a real queue. Measured queue depth and busy time are
   * more trustworthy than a closed-form approximation, and parking the dot on the
   * saturated node is the clearest signal the canvas can give.
   */
  private nodeRuntimes = new Map<string, NodeRuntime>()

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

    // Containers stand in for their contents. Membership is geometric, so this is
    // derived fresh each run from the current layout rather than stored anywhere.
    this.groups = buildGroups(nodes)
    this.graph = expandGraphForGroups(buildGraph(edges), this.groups)
    this._initRuntimes(nodes)

    if (this._startPoints(config.startNodeId).length === 0) {
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
    // Utilisation is busy time over elapsed time, so the window has to start here
    // rather than at the first arrival.
    this.startedAt = performance.now()

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
    // Drain the node queues too, or a stopped run leaves requests parked forever on
    // whatever they were waiting for.
    for (const runtime of this.nodeRuntimes.values()) {
      runtime.serving = []
      runtime.queue = []
    }
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
    this.nodeRuntimes.clear()
    this.groups = EMPTY_GROUPS
    this.startedAt = 0
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

  /**
   * The real components a run begins at.
   *
   * A container has no edges of its own, so selecting one used to find no outgoing
   * hops and the run would do nothing but pulse. Picking a group now starts every
   * front-door member that has somewhere to go — select Client and both the browser
   * and the mobile app send a request.
   */
  private _startPoints(startNodeId: string): string[] {
    if (!startNodeId) return []

    // Containerness, not membership: an empty frame is still not something a run can
    // start from, and a frame of frames has to resolve through to real components.
    if (this.groups.containers.has(startNodeId)) {
      return groupStarters(this.groups, this.graph, startNodeId)
    }

    return (this.graph.get(startNodeId)?.length ?? 0) > 0 ? [startNodeId] : []
  }

  private _spawnRequest(
    nodes: ArchitectureNode[],
    edges: ArchitectureEdge[],
    config: SimConfig,
  ) {
    const origins = this._startPoints(config.startNodeId)
    if (origins.length === 0) return

    // Every origin's first hop, gathered before anything is counted so an empty
    // result cannot register a request that never leaves.
    const departures: { from: string; trail: string[]; hop: Hop }[] = []
    for (const from of origins) {
      const trail = [from]
      for (const hop of nextHops(this.graph, from, trail)) {
        departures.push({ from, trail, hop })
      }
    }
    if (departures.length === 0) return

    const idx = this.requestIndex++
    const color = PACKET_COLORS[idx % PACKET_COLORS.length]

    useSimulationStore.getState().updateStats({
      totalRequests: useSimulationStore.getState().stats.totalRequests + 1,
    })

    // Pulse whatever actually originated the traffic. For a group that is its members,
    // not the frame, since the frame is not a component.
    for (const from of origins) {
      useSimulationStore.getState().setNodeStatus(from, 'active')
      this._later(() => useSimulationStore.getState().clearNodeStatus(from), 400)
    }

    // One branch per outgoing edge, across every origin. A client wired to both a CDN
    // and a load balancer exercises both, rather than whichever happened to head the
    // sorted path list.
    for (const { from, trail, hop } of departures) {
      const packet = this._makePacket(idx, color, from, hop, trail, nodes, edges, config)
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

  /** Seed serving state for every node, resolving capacity once per run. */
  private _initRuntimes(nodes: ArchitectureNode[]) {
    this.nodeRuntimes.clear()
    for (const node of nodes) {
      this.nodeRuntimes.set(node.id, {
        capacity: nodeCapacity(node.data),
        serving: [],
        queue: [],
        busyServerMs: 0,
        served: 0,
        forwarded: 0,
        totalWaitMs: 0,
        totalResidenceMs: 0,
        maxQueueDepth: 0,
      })
    }
  }

  private _runtime(nodeId: string): NodeRuntime {
    const existing = this.nodeRuntimes.get(nodeId)
    if (existing) return existing

    // A node added mid-run, or one the diagram lost track of. Give it the generic
    // profile rather than dropping the request.
    const created: NodeRuntime = {
      capacity: nodeCapacity(undefined),
      serving: [],
      queue: [],
      busyServerMs: 0,
      served: 0,
      forwarded: 0,
      totalWaitMs: 0,
      totalResidenceMs: 0,
      maxQueueDepth: 0,
    }
    this.nodeRuntimes.set(nodeId, created)
    return created
  }

  /**
   * Take a request into a node: straight into a free server, or onto the queue.
   *
   * This is where contention happens. Everything downstream of the node is deferred
   * until service completes, which is what lets a saturated node hold the flow up
   * instead of passing it straight through.
   */
  private _admit(arrival: Arrival, now: number, config: SimConfig) {
    const runtime = this._runtime(arrival.nodeId)

    if (runtime.serving.length < runtime.capacity.concurrency) {
      this._beginService(runtime, arrival, now, 0, config)
      return
    }

    runtime.queue.push(arrival)
    runtime.maxQueueDepth = Math.max(runtime.maxQueueDepth, runtime.queue.length)
  }

  private _beginService(
    runtime: NodeRuntime,
    arrival: Arrival,
    now: number,
    waitedMs: number,
    config: SimConfig
  ) {
    runtime.serving.push({
      ...arrival,
      endsAt: now + servicePlaybackMs(runtime.capacity.serviceMs, config.speedMultiplier),
      waitedMs,
    })
  }

  /**
   * Finish whatever has completed service, then pull from the queues.
   *
   * Returns the packets to put on outbound edges. Draining after completing, in one
   * pass per node, means a freed server is reused on the same frame rather than
   * idling until the next one.
   */
  private _advanceNodes(
    now: number,
    dtMs: number,
    nodes: ArchitectureNode[],
    edges: ArchitectureEdge[],
    config: SimConfig
  ): SimPacket[] {
    const spawned: SimPacket[] = []
    const patches: Record<string, Partial<NodeStat>> = {}

    for (const [nodeId, runtime] of this.nodeRuntimes) {
      // Busy time is per server, so a node with three servers working accrues three
      // milliseconds of capacity for every millisecond of wall clock.
      runtime.busyServerMs += runtime.serving.length * dtMs

      const idle = runtime.serving.length === 0 && runtime.queue.length === 0
      if (idle && runtime.served === 0) continue

      // A node that has gone quiet still needs refreshing: utilisation is busy time
      // over elapsed time, so freezing it at the moment work stopped would leave a
      // finished run reporting every node at its peak.
      if (idle) {
        patches[nodeId] = this._nodeStatPatch(nodeId, runtime, now)
        continue
      }

      const stillServing: ServingSlot[] = []
      for (const slot of runtime.serving) {
        if (slot.endsAt > now) {
          stillServing.push(slot)
          continue
        }

        runtime.served++
        runtime.totalWaitMs += slot.waitedMs
        runtime.totalResidenceMs += slot.waitedMs + runtime.capacity.serviceMs

        const forwarded = this._departNode(slot, nodes, edges, config, spawned)
        runtime.forwarded += forwarded
      }
      runtime.serving = stillServing

      // Promote waiters into any server that just freed up.
      while (runtime.serving.length < runtime.capacity.concurrency && runtime.queue.length > 0) {
        const next = runtime.queue.shift()!
        this._beginService(
          runtime,
          next,
          now,
          simulatedMs(now - next.arrivedAt, config.speedMultiplier),
          config
        )
      }

      patches[nodeId] = this._nodeStatPatch(nodeId, runtime, now)
    }

    useSimulationStore.getState().updateNodeStats(patches)
    return spawned
  }

  /**
   * Fan out from a node once its service is done.
   *
   * Returns how many downstream packets were created; zero means this branch has
   * reached the end of the flow.
   */
  private _departNode(
    slot: ServingSlot,
    nodes: ArchitectureNode[],
    edges: ArchitectureEdge[],
    config: SimConfig,
    into: SimPacket[]
  ): number {
    const budget = MAX_LIVE_PACKETS - into.length - this.activePackets.length
    const onward =
      budget > 0 ? nextHops(this.graph, slot.nodeId, slot.trail).slice(0, budget) : []

    let spawned = 0
    for (const hop of onward) {
      const packet = this._makePacket(
        slot.requestIndex,
        slot.color,
        slot.nodeId,
        hop,
        slot.trail,
        nodes,
        edges,
        config
      )
      if (packet) {
        into.push(packet)
        spawned++
      }
    }

    // The branch either became its children or ended here; either way the arrival
    // that occupied this server is done.
    this._endBranch(slot.requestIndex, false)
    return spawned
  }

  /** A node's contention figures, for the batched store write. */
  private _nodeStatPatch(
    nodeId: string,
    runtime: NodeRuntime,
    now: number
  ): Partial<NodeStat> {
    const elapsedMs = Math.max(now - this.startedAt, 1)
    const util = utilisation(runtime.busyServerMs, elapsedMs, runtime.capacity.concurrency)

    // requestsIn is written on arrival, before the node has done any work, so read it
    // back rather than substituting the served count — a request still queueing has
    // arrived but not been served.
    const requestsIn = useSimulationStore.getState().nodeStats[nodeId]?.requestsIn ?? 0

    const severity = bottleneckSeverity({
      utilisation: util,
      maxQueueDepth: runtime.maxQueueDepth,
      requestsIn,
    })

    return {
      nodeId,
      queueDepth: runtime.queue.length,
      maxQueueDepth: runtime.maxQueueDepth,
      avgWaitMs: runtime.served > 0 ? runtime.totalWaitMs / runtime.served : 0,
      avgLatencyMs: runtime.served > 0 ? runtime.totalResidenceMs / runtime.served : 0,
      totalLatencyMs: runtime.totalResidenceMs,
      requestsOut: runtime.forwarded,
      utilisation: util,
      serviceMs: runtime.capacity.serviceMs,
      concurrency: runtime.capacity.concurrency,
      severity,
      isBottleneck: severity !== 'none',
    }
  }

  /** Packets parked at a node, drawn at the far end of the edge they came in on. */
  private _parkedPackets(): SimPacket[] {
    const parked: SimPacket[] = []

    for (const runtime of this.nodeRuntimes.values()) {
      for (const slot of runtime.serving) {
        parked.push(this._parkedPacket(slot, 'serving'))
      }
      for (const waiting of runtime.queue) {
        parked.push(this._parkedPacket(waiting, 'queued'))
      }
    }

    return parked
  }

  private _parkedPacket(arrival: Arrival, status: 'queued' | 'serving'): SimPacket {
    return {
      id: arrival.packetId,
      edgeId: arrival.edgeId,
      sourceId: arrival.fromNodeId,
      targetId: arrival.nodeId,
      // Held at the end of its inbound edge, which puts the dot on the node it is
      // waiting for without the renderer needing to know about node geometry.
      progress: 1,
      durationMs: 0,
      status,
      requestIndex: arrival.requestIndex,
      startTime: arrival.arrivedAt,
      trail: arrival.trail,
      color: arrival.color,
    }
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
    // producer of edge packets and it always sets that status. Parked packets live in
    // the node runtimes, not here, so they are never advanced.
    for (const packet of this.activePackets) {
      const updatedPacket = {
        ...packet,
        progress: advanceProgress(packet.progress, dtMs, packet.durationMs),
      }

      if (updatedPacket.progress >= 1) {
        // Reached the far node. It does not continue immediately any more: it has to
        // be served first, and may have to queue for a server.
        this._onArrival(updatedPacket, nodes, edges, config, now)
      } else {
        activeEdgeIds.add(packet.edgeId)
        nextPackets.push(updatedPacket)
      }
    }

    // Complete service, promote waiters, and put whatever departed onto its edges.
    nextPackets.push(...this._advanceNodes(now, dtMs, nodes, edges, config))

    // Packets created this frame start highlighted too. Without them the edge
    // highlight blinked off for one frame at every hop.
    for (const packet of nextPackets) activeEdgeIds.add(packet.edgeId)

    this.activePackets = nextPackets
    // Parked packets are drawn but not advanced, so they are appended for the
    // renderer only and never enter activePackets.
    useSimulationStore.getState().setPackets([...nextPackets, ...this._parkedPackets()])
    useSimulationStore.getState().setActiveEdges(activeEdgeIds)

    // Check completion. A request is outstanding while it still has a live branch,
    // so an empty branch table means the whole run has drained — including anything
    // still queued or being served, which holds a branch open.
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

  /**
   * A packet has reached the far end of its edge.
   *
   * It does not continue from here. It is handed to the target node, which either
   * serves it straight away or makes it wait — that deferral is what allows a node to
   * be a bottleneck. Fan-out happens later, in _departNode.
   */
  private _onArrival(
    packet: SimPacket,
    nodes: ArchitectureNode[],
    edges: ArchitectureEdge[],
    config: SimConfig,
    now: number,
  ) {
    // Determine failure. The dice roll is supplied here so the rule itself stays a
    // pure function — see failure.ts.
    const decision = decideFailure(packet.targetId, config.failure, Math.random())
    const failed = decision.failed

    const isSlow = isSlowEdge(packet.edgeId, config.failure)
    const status: 'ok' | 'error' | 'slow' = failed ? 'error' : isSlow ? 'slow' : 'ok'

    // Transit cost only. What the node itself adds — queue wait plus service — is
    // measured when service completes and lands in the node's own stats, so the log
    // reports the hop and the panel reports the node.
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

    // Arrival count and error count only. Timing and contention figures come from
    // _nodeStatPatch once the node has actually done the work — a request that has
    // arrived but is still queueing has not been served yet.
    const existingStat = useSimulationStore.getState().nodeStats[packet.targetId]
    useSimulationStore.getState().updateNodeStat(packet.targetId, {
      nodeId: packet.targetId,
      requestsIn: (existingStat?.requestsIn ?? 0) + 1,
      errors: (existingStat?.errors ?? 0) + (failed ? 1 : 0),
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
      // A node that is down does not serve, so nothing is queued for it.
      useSimulationStore.getState().setFailedEdge(packet.edgeId)
      this._endBranch(packet.requestIndex, true)
      return
    }

    // Hand off to the node. It holds the branch open until service completes, so the
    // request is still outstanding while it sits in a queue.
    this._admit(
      {
        packetId: packet.id,
        requestIndex: packet.requestIndex,
        color: packet.color,
        nodeId: packet.targetId,
        edgeId: packet.edgeId,
        fromNodeId: packet.sourceId,
        trail: packet.trail,
        arrivedAt: now,
      },
      now,
      config
    )
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
