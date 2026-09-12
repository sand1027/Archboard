'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Inline canvas editing: double-click a region to edit, Escape or blur to exit.
 *
 * Mirrors the pattern already used by UmlClassNode so all LLD shapes behave the
 * same way, and centralises the focus + Escape wiring that was duplicated in
 * each of the legacy Uml* nodes.
 */
export function useInlineEdit<TRegion extends string>() {
  const [editing, setEditing] = useState<TRegion | null>(null)
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const stop = useCallback(() => setEditing(null), [])

  const start = useCallback(
    (region: TRegion) => (e: React.MouseEvent) => {
      e.stopPropagation()
      setEditing(region)
    },
    []
  )

  useEffect(() => {
    if (!editing) return
    const el = ref.current
    if (!el) return
    el.focus()
    if (el instanceof HTMLInputElement) el.select()
  }, [editing])

  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, stop])

  /** Spread onto an input to commit on Enter and exit on blur. */
  const commitProps = {
    onBlur: stop,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') stop()
    },
  }

  return { editing, setEditing, start, stop, ref, commitProps }
}
