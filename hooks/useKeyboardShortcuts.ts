'use client'

import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useDiagramStore } from '@/store/diagramStore'
import { useHistoryStore } from '@/store/historyStore'
import { useUiStore } from '@/store/uiStore'
import { isEditingText } from '@/lib/ui/isEditingText'

export function useKeyboardShortcuts() {
  const reactFlow = useReactFlow()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (isEditingText(e.target) || isEditingText()) return

      // Undo
      if (meta && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        const { nodes, edges } = useDiagramStore.getState()
        const snapshot = useHistoryStore.getState().undo({ nodes, edges })
        if (snapshot) {
          useDiagramStore.getState().setNodes(snapshot.nodes)
          useDiagramStore.getState().setEdges(snapshot.edges)
        }
        return
      }

      // Redo
      if (meta && e.shiftKey && e.key === 'z') {
        e.preventDefault()
        const { nodes, edges } = useDiagramStore.getState()
        const snapshot = useHistoryStore.getState().redo({ nodes, edges })
        if (snapshot) {
          useDiagramStore.getState().setNodes(snapshot.nodes)
          useDiagramStore.getState().setEdges(snapshot.edges)
        }
        return
      }

      // Select All
      if (meta && e.key === 'a') {
        e.preventDefault()
        useDiagramStore.getState().selectAll()
        return
      }

      // Copy
      if (meta && e.key === 'c') {
        e.preventDefault()
        useDiagramStore.getState().copySelected()
        return
      }

      // Paste
      if (meta && e.key === 'v') {
        e.preventDefault()
        const { nodes, edges } = useDiagramStore.getState()
        useHistoryStore.getState().pushSnapshot({ nodes, edges })
        useDiagramStore.getState().pasteClipboard()
        return
      }

      // Duplicate
      if (meta && e.key === 'd') {
        e.preventDefault()
        const { nodes, edges, selectedNodeIds } = useDiagramStore.getState()
        if (selectedNodeIds.length > 0) {
          useHistoryStore.getState().pushSnapshot({ nodes, edges })
          useDiagramStore.getState().duplicateNodes(selectedNodeIds)
        }
        return
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedNodeIds, selectedEdgeIds } = useDiagramStore.getState()
        if (selectedNodeIds.length > 0 || selectedEdgeIds.length > 0) {
          const { nodes, edges } = useDiagramStore.getState()
          useHistoryStore.getState().pushSnapshot({ nodes, edges })
        }
        return
      }

      // Fit view
      if (meta && e.shiftKey && e.key === 'f') {
        e.preventDefault()
        reactFlow.fitView({ padding: 0.1, duration: 400 })
        return
      }

      // Toggle grid
      if (meta && e.key === 'g') {
        e.preventDefault()
        const { showGrid, setShowGrid } = useDiagramStore.getState()
        setShowGrid(!showGrid)
        return
      }

      // Shortcuts modal
      if (e.key === '?' || (meta && e.key === '/')) {
        e.preventDefault()
        const { shortcutsModalOpen, setShortcutsModalOpen } = useUiStore.getState()
        setShortcutsModalOpen(!shortcutsModalOpen)
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [reactFlow])
}
