'use client'

import { Link2Off } from 'lucide-react'
import { ConnectorPreview } from '@/components/canvas/ConnectorPreview'
import {
  CONNECTION_TYPES,
  CONNECTION_TYPE_HINT,
  CONNECTION_TYPE_LABEL,
  HLD_NOTATION,
  PROTOCOL_COLORS,
  PROTOCOL_DEFAULT_TYPE,
} from '@/lib/canvas/hldNotation'
import { useUiStore } from '@/store/uiStore'
import type { Protocol } from '@/types/architecture'

const PROTOCOLS: Protocol[] = [
  'HTTPS',
  'HTTP',
  'REST',
  'gRPC',
  'GraphQL',
  'WebSocket',
  'SSE',
  'Kafka',
  'AMQP',
  'MQTT',
  'TCP',
  'UDP',
]

/**
 * Connection presets for the HLD board, mirroring the LLD connector legend.
 *
 * Arming a preset makes the next drawn connection use it, so the semantics are
 * chosen before drawing rather than corrected afterwards in the inspector. With
 * nothing armed, connections fall back to behaviour inference from the component
 * registry.
 */
export default function ConnectorPresets() {
  const armedConnectionType = useUiStore((s) => s.armedConnectionType)
  const armedProtocol = useUiStore((s) => s.armedProtocol)
  const setArmedConnection = useUiStore((s) => s.setArmedConnection)

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {CONNECTION_TYPES.map((type) => {
          const armed = armedConnectionType === type
          return (
            <button
              key={type}
              type="button"
              aria-pressed={armed}
              onClick={() => setArmedConnection(armed ? null : type, armedProtocol)}
              title={CONNECTION_TYPE_HINT[type]}
              className={[
                'flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-all',
                armed
                  ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200'
                  : 'border-slate-200/90 bg-white hover:border-slate-300',
              ].join(' ')}
            >
              <span className="flex h-5 w-14 shrink-0 items-center justify-center">
                <ConnectorPreview style={HLD_NOTATION[type]} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={[
                    'block truncate text-[11px] font-medium',
                    armed ? 'text-blue-700' : 'text-slate-700',
                  ].join(' ')}
                >
                  {CONNECTION_TYPE_LABEL[type]}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {armedConnectionType && (
        <>
          <p className="px-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Protocol
          </p>
          <div className="flex flex-wrap gap-1">
            {PROTOCOLS.map((protocol) => {
              const active = armedProtocol === protocol
              return (
                <button
                  key={protocol}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setArmedConnection(
                      // Some protocols imply their own semantics — picking Kafka
                      // should mean "event" without a second click.
                      PROTOCOL_DEFAULT_TYPE[protocol] ?? armedConnectionType,
                      active ? null : protocol
                    )
                  }
                  className={[
                    'rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-all',
                    active
                      ? 'border-transparent text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300',
                  ].join(' ')}
                  style={active ? { background: PROTOCOL_COLORS[protocol] } : undefined}
                >
                  {protocol}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setArmedConnection(null, null)}
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
          >
            <Link2Off className="h-3.5 w-3.5" />
            Clear preset
          </button>
        </>
      )}

      {armedConnectionType ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50/70 px-2 py-1.5">
          <p className="text-[10px] font-semibold text-blue-800">
            Drawing {CONNECTION_TYPE_LABEL[armedConnectionType]}
            {armedProtocol ? ` over ${armedProtocol}` : ''}
          </p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-blue-700/80">
            Drag from anywhere on a component to another. Node dragging is paused —
            press Esc to go back to moving things.
          </p>
        </div>
      ) : (
        <p className="px-0.5 text-[10px] leading-relaxed text-slate-400">
          Hover a component and drag one of its four points to connect. Or pick a preset
          above to drag from anywhere on the icon.
        </p>
      )}
    </div>
  )
}
