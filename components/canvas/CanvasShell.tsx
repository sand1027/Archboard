'use client'

import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import Whiteboard from './Whiteboard'

// Uses ReactFlow hooks — must be inside ReactFlowProvider. The provider lives at
// WhiteboardApp level so the toolbar shares context.
//
// Persistence deliberately does NOT live here: this component unmounts when the
// user switches to LLD mode, which would silently drop the save wiring.
export default function CanvasShell() {
  useKeyboardShortcuts()
  return <Whiteboard />
}
