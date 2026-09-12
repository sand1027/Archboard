'use client'

import { memo } from 'react'
import { ViewportPortal } from '@xyflow/react'
import { useSimulationStore } from '@/store/simulationStore'
import { pointAlongEdge, type Point } from '@/lib/canvas/pathGeometry'
import { packetTrail } from '@/lib/simulation/timing'
import type { SimPacket } from '@/types/simulation'

/** Head dot radius in canvas units, so it scales with zoom like everything else. */
const HEAD_RADIUS = 5.5

/**
 * Animated packets travelling the diagram's connectors.
 *
 * Rendered through ViewportPortal, which puts this inside React Flow's transformed
 * viewport. That buys two things the previous canvas overlay had to fake and got
 * wrong: pan and zoom apply for free, and coordinates are flow coordinates — the
 * same space the edge paths are defined in, so a sampled point needs no conversion.
 *
 * The engine owns the animation clock; it writes packet progress to the store every
 * frame and this component is a pure projection of that state.
 */
function PacketLayer() {
  // Deliberately subscribing to the whole array: the engine replaces it each frame
  // and re-rendering on every frame is the entire point of this component.
  const packets = useSimulationStore((s) => s.packets)
  const status = useSimulationStore((s) => s.status)

  if (status !== 'running' && status !== 'paused') return null
  if (packets.length === 0) return null

  return (
    <ViewportPortal>
      {/*
        Positioned at the portal's origin, which is the flow origin, with overflow
        visible so dots outside the initial viewport still paint. Same arrangement
        React Flow uses for its own edge layer. No viewBox, so SVG user units are
        canvas units.
      */}
      <svg
        width="100%"
        height="100%"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          overflow: 'visible',
          pointerEvents: 'none',
        }}
        aria-hidden
      >
        {packets.map((packet) => (
          <PacketDots key={packet.id} packet={packet} />
        ))}
      </svg>
    </ViewportPortal>
  )
}

/**
 * One packet: a bright head with a fading tail.
 *
 * Positions are sampled from the edge's rendered path, so the dot sits on the line
 * through smoothstep corners, floating endpoints and manual offsets alike. If the
 * edge is not currently in the DOM — virtualised away, or deleted mid-run — there
 * is nothing sensible to draw and we skip it.
 */
function PacketDots({ packet }: { packet: SimPacket }) {
  const dots = packetTrail(packet.progress)

  const positioned: { point: Point; scale: number; opacity: number }[] = []
  for (const dot of dots) {
    const point = pointAlongEdge(packet.edgeId, dot.t)
    if (point) positioned.push({ point, scale: dot.scale, opacity: dot.opacity })
  }

  if (positioned.length === 0) return null
  const head = positioned[0]

  return (
    <g>
      {/* Tail first, so the head paints over it. */}
      {positioned
        .slice(1)
        .reverse()
        .map((dot, i) => (
          <circle
            key={i}
            cx={dot.point.x}
            cy={dot.point.y}
            r={HEAD_RADIUS * dot.scale}
            fill={packet.color}
            opacity={dot.opacity}
          />
        ))}

      {/* Soft halo, so a packet stays legible over a same-coloured edge. */}
      <circle
        cx={head.point.x}
        cy={head.point.y}
        r={HEAD_RADIUS * 2.2}
        fill={packet.color}
        opacity={0.18}
      />
      <circle
        cx={head.point.x}
        cy={head.point.y}
        r={HEAD_RADIUS}
        fill={packet.color}
        stroke="#ffffff"
        strokeWidth={1.5}
      />
    </g>
  )
}

export default memo(PacketLayer)
