'use client'

import { memo, useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useSimulationStore } from '@/store/simulationStore'
import { useDiagramStore } from '@/store/diagramStore'
import type { SimPacket } from '@/types/simulation'

const PARTICLE_RADIUS = 6

/**
 * Canvas overlay that draws animated packets as colored dots on top of
 * the React Flow canvas. Uses requestAnimationFrame to sync with the
 * simulation engine's packet positions.
 */
function SimulationOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const { getNodes, getEdges, flowToScreenPosition } = useReactFlow()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      canvas.width  = parent.offsetWidth
      canvas.height = parent.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    const parent = canvas.parentElement
    if (parent) ro.observe(parent)

    const draw = () => {
      const { packets, status, nodeStatuses } = useSimulationStore.getState()

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (status !== 'running' && status !== 'paused' && packets.length === 0) {
        // Pulse idle node highlights for failure mode selection (no packets needed)
        return
      }

      const rfNodes = getNodes()
      const rfEdges = getEdges()

      // Draw each packet
      for (const packet of packets) {
        drawPacket(ctx, packet, rfEdges, rfNodes, flowToScreenPosition)
      }

      // Draw node status glows
      drawNodeGlows(ctx, nodeStatuses, rfNodes, flowToScreenPosition)

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [getNodes, getEdges, flowToScreenPosition])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
    />
  )
}

// ─── Drawing helpers ───────────────────────────────────────────────────────────

function drawPacket(
  ctx: CanvasRenderingContext2D,
  packet: SimPacket,
  edges: ReturnType<ReturnType<typeof useReactFlow>['getEdges']>,
  nodes: ReturnType<ReturnType<typeof useReactFlow>['getNodes']>,
  toScreen: ReturnType<typeof useReactFlow>['flowToScreenPosition'],
) {
  const edge = edges.find((e) => e.id === packet.edgeId)
  if (!edge) return

  const srcNode = nodes.find((n) => n.id === edge.source)
  const tgtNode = nodes.find((n) => n.id === edge.target)
  if (!srcNode || !tgtNode) return

  const srcPos = toScreen({
    x: srcNode.position.x + (srcNode.width ?? 80) / 2,
    y: srcNode.position.y + (srcNode.height ?? 60) / 2,
  })
  const tgtPos = toScreen({
    x: tgtNode.position.x + (tgtNode.width ?? 80) / 2,
    y: tgtNode.position.y + (tgtNode.height ?? 60) / 2,
  })

  const t = packet.progress
  const x = srcPos.x + (tgtPos.x - srcPos.x) * t
  const y = srcPos.y + (tgtPos.y - srcPos.y) * t

  // Glow
  const grd = ctx.createRadialGradient(x, y, 0, x, y, PARTICLE_RADIUS * 3)
  grd.addColorStop(0, packet.color + 'cc')
  grd.addColorStop(1, packet.color + '00')
  ctx.beginPath()
  ctx.arc(x, y, PARTICLE_RADIUS * 3, 0, Math.PI * 2)
  ctx.fillStyle = grd
  ctx.fill()

  // Core dot
  ctx.beginPath()
  ctx.arc(x, y, PARTICLE_RADIUS, 0, Math.PI * 2)
  ctx.fillStyle = packet.color
  ctx.fill()

  // White center
  ctx.beginPath()
  ctx.arc(x, y, PARTICLE_RADIUS * 0.35, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.fill()
}

function drawNodeGlows(
  ctx: CanvasRenderingContext2D,
  nodeStatuses: Record<string, string>,
  nodes: ReturnType<ReturnType<typeof useReactFlow>['getNodes']>,
  toScreen: ReturnType<typeof useReactFlow>['flowToScreenPosition'],
) {
  const colorMap: Record<string, string> = {
    active:     '#3B82F6',
    processing: '#F59E0B',
    error:      '#EF4444',
    slow:       '#F97316',
  }

  for (const [nodeId, nodeStatus] of Object.entries(nodeStatuses)) {
    if (nodeStatus === 'idle') continue
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) continue

    const pos = toScreen({
      x: node.position.x + (node.width ?? 80) / 2,
      y: node.position.y + (node.height ?? 60) / 2,
    })

    const color = colorMap[nodeStatus] ?? '#3B82F6'
    const radius = Math.max((node.width ?? 80), (node.height ?? 60)) * 0.7

    const grd = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius)
    grd.addColorStop(0, color + '40')
    grd.addColorStop(1, color + '00')

    ctx.beginPath()
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
    ctx.fillStyle = grd
    ctx.fill()

    // Ring
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, radius * 0.55, 0, Math.PI * 2)
    ctx.strokeStyle = color + '80'
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

export default memo(SimulationOverlay)
