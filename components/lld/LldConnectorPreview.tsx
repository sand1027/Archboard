'use client'

import { ConnectorPreview } from '@/components/canvas/ConnectorPreview'
import { NOTATION } from '@/lib/canvas/notation'
import type { LldEdgeKind } from '@/types/lld'

/** LLD wrapper: resolves an edge kind to its notation, then draws it. */
export function LldConnectorPreview({
  edgeKind,
  width,
  height,
}: {
  edgeKind: LldEdgeKind
  width?: number
  height?: number
}) {
  const style = NOTATION[edgeKind]
  if (!style) return null
  return <ConnectorPreview style={style} width={width} height={height} />
}
