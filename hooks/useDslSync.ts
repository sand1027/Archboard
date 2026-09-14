'use client'

import { useCallback, useEffect, useRef } from 'react'
import { autoLayout, pinsByNodeId } from '@/lib/canvas/autoLayout'
import { compileSource } from '@/lib/dsl/compile'
import { useDiagramStore } from '@/store/diagramStore'
import { useDslStore } from '@/store/dslStore'
import { useEstimateStore } from '@/store/estimateStore'
import type { ArchitectureEdge, ArchitectureNode } from '@/types/diagram'

/**
 * Text into canvas, live.
 *
 * The pipeline is source → compile → layout → store, run on a short debounce so a keystroke
 * does not re-solve the diagram mid-word.
 *
 * Two things make it safe to let text overwrite the canvas. Compiled node ids are derived
 * from declaration order rather than generated, so a recompile reuses the same ids and React
 * Flow keeps the same nodes rather than remounting all of them. And positions come from
 * pins first, layout second, so an arrangement the user dragged into place survives every
 * edit to the text that did not remove the thing they moved.
 */

/** Long enough to skip mid-word recompiles, short enough to feel live. */
const DEBOUNCE_MS = 180

export interface DslSyncResult {
  /** Recompile immediately, skipping the debounce. */
  flush: () => void
}

export function useDslSync(): DslSyncResult {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** The last source actually compiled, so an unrelated store change cannot retrigger it. */
  const lastCompiled = useRef<string | null>(null)

  const apply = useCallback(() => {
    const { source, enabled, pins, direction } = useDslStore.getState()

    // Source cleared. Release what the text owned instead of deleting it: the diagram stays
    // exactly as it looks and simply stops being driven by text. Deleting would be the
    // literal reading — an empty document describes nothing — but losing a diagram because
    // you selected all and hit delete in a side panel is not a trade anyone would take.
    if (!enabled) {
      releaseOwnership()
      return
    }

    const compiled = compileSource(source)
    useDslStore.getState().setDiagnostics(compiled.diagnostics)

    // Pins are stored by DSL name because a name survives a recompile; the layout works in
    // node ids.
    const laidOut = autoLayout(
      { nodes: compiled.nodes, edges: compiled.edges },
      {
        hierarchy: compiled.hierarchy,
        pins: pinsByNodeId(pins, compiled.nodeIdsByName),
        direction,
      }
    )

    const store = useDiagramStore.getState()

    // Merge, never replace. Anything the user drew by hand — a shape, a text label, an
    // annotation arrow — has no `dslName` and is not the text's to delete. Replacing the
    // whole array would destroy all of it on the next keystroke.
    store.setNodes([...keepUnownedNodes(store.nodes), ...laidOut.nodes])
    store.setEdges([...keepUnownedEdges(store.edges), ...compiled.edges])

    if (compiled.name && compiled.name !== store.diagramName) {
      store.setDiagramName(compiled.name)
    }

    // The workload is part of the text, so it drives the capacity panel too.
    if (compiled.workload) useEstimateStore.getState().setInputs(compiled.workload)

    // A pin for a name that has left the source would otherwise sit there and reattach if
    // the name ever came back.
    useDslStore.getState().prunePins(Object.keys(compiled.nodeIdsByName))

    lastCompiled.current = source
  }, [])

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    apply()
  }, [apply])

  // Recompile when the source, the flow direction or the pins change.
  useEffect(() => {
    const schedule = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        timer.current = null
        apply()
      }, DEBOUNCE_MS)
    }

    // Compile whatever is already there on mount, so opening a saved document renders it.
    if (useDslStore.getState().enabled && lastCompiled.current === null) apply()

    const unsubscribe = useDslStore.subscribe((state, previous) => {
      const changed =
        state.source !== previous.source ||
        state.direction !== previous.direction ||
        state.pins !== previous.pins ||
        state.enabled !== previous.enabled

      // Scheduled whether or not the text is authoritative. `apply` handles both cases, and
      // the transition that matters most is the one *to* disabled: that is when ownership has
      // to be released, so bailing out on `!enabled` here would strand the markers forever.
      if (changed) schedule()
    })

    return () => {
      if (timer.current) clearTimeout(timer.current)
      unsubscribe()
    }
  }, [apply])

  return { flush }
}

/**
 * The nodes the text does not own, and so must never delete.
 *
 * Shapes, text labels, annotation arrows and LLD nodes are the user's own marks on the
 * diagram. They carry no `dslName`, and keeping them is the difference between the text being
 * a view of the architecture and the text being a wrecking ball.
 */
export function keepUnownedNodes(nodes: ArchitectureNode[]): ArchitectureNode[] {
  return nodes.filter((node) => typeof node.data?.dslName !== 'string')
}

/** The same for edges: a hand-drawn arrow is not the text's to remove. */
export function keepUnownedEdges(edges: ArchitectureEdge[]): ArchitectureEdge[] {
  return edges.filter((edge) => edge.data?.dslOwned !== true)
}

/**
 * Hand every generated node and edge back to the canvas, keeping them exactly where they are.
 *
 * Called when the source is emptied. Stripping the marker is what makes it a release rather
 * than a delete: they become ordinary nodes, and a later document cannot claim to own them.
 */
function releaseOwnership(): void {
  const store = useDiagramStore.getState()

  const owned = store.nodes.some((node) => typeof node.data?.dslName === 'string')
  const ownedEdges = store.edges.some((edge) => edge.data?.dslOwned === true)
  // Guard, or every debounce tick would write new arrays and rerender the canvas for nothing.
  if (!owned && !ownedEdges) return

  if (owned) {
    store.setNodes(
      store.nodes.map((node) => {
        if (typeof node.data?.dslName !== 'string') return node
        return { ...node, data: without(node.data, 'dslName') } as ArchitectureNode
      })
    )
  }

  if (ownedEdges) {
    store.setEdges(
      store.edges.map((edge) => {
        if (edge.data?.dslOwned !== true) return edge
        return { ...edge, data: without(edge.data, 'dslOwned') }
      })
    )
  }
}

/** A shallow copy without one key. */
function without<T extends Record<string, unknown>>(source: T, key: string): T {
  const copy = { ...source }
  delete copy[key]
  return copy
}

/**
 * Record where a node was dragged to, as a pin.
 *
 * Called from the canvas rather than inferred from a store diff: only a real drag should
 * become a pin, and layout writes positions to the same field, so a diff cannot tell the two
 * apart without knowing who moved it.
 *
 * A node the text does not own carries no name and keeps its position on the canvas as
 * normal — there is nothing to pin it against.
 */
export function pinDraggedNode(node: ArchitectureNode): void {
  const { enabled, pin } = useDslStore.getState()
  if (!enabled) return

  const name = node.data?.dslName
  if (typeof name !== 'string' || !name) return
  pin(name, { x: node.position.x, y: node.position.y })
}
