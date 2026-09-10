'use client'

import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useDiagramPersistence } from '@/hooks/useDiagramPersistence'
import Whiteboard from './Whiteboard'

// This component uses ReactFlow hooks — must be inside ReactFlowProvider
// The provider is placed at WhiteboardApp level so toolbar shares context
export default function CanvasShell() {
  useKeyboardShortcuts()
  useDiagramPersistence()
  return <Whiteboard />
}
