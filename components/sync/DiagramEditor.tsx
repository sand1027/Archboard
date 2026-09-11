'use client'

import { useEffect, useState } from 'react'
import { useDiagramStore } from '@/store/diagramStore'
import { useUiStore } from '@/store/uiStore'
import { useDiagramSync } from '@/hooks/useDiagramSync'
import { useThumbnail } from '@/hooks/useThumbnail'
import WhiteboardApp from '@/components/WhiteboardApp'
import HistorySidebar from '@/components/sync/HistorySidebar'
import type { BoardMode, BoardSnapshot } from '@/types/diagram'

interface Props {
  diagramId: string
  initialData: {
    activeBoard?: BoardMode
    boards?: { hld: BoardSnapshot; lld: BoardSnapshot }
    // legacy flat format
    nodes?: unknown[]
    edges?: unknown[]
    viewport?: unknown
  } | null
  initialName: string
  userId: string
  userEmail: string
}

export default function DiagramEditor({ diagramId, initialData, initialName, userId, userEmail }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const { saveStatus, save, saveVersion } = useDiagramSync(diagramId)
  const { capture } = useThumbnail(diagramId, userId)

  // Hydrate store from Supabase data on mount
  useEffect(() => {
    const store = useDiagramStore.getState()
    if (initialData) {
      // New multi-board format
      if (initialData.boards?.hld || initialData.boards?.lld) {
        const activeBoard: BoardMode = initialData.activeBoard === 'lld' ? 'lld' : 'hld'
        store.hydrateBoards({
          activeBoard,
          boards: {
            hld: initialData.boards.hld ?? { diagramId, diagramName: initialName, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
            lld: initialData.boards.lld ?? { diagramId: `${diagramId}-lld`, diagramName: `${initialName} LLD`, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
          },
        })
        useUiStore.getState().setBoardMode(activeBoard)
      }
      // Legacy flat format
      else if (initialData.nodes && initialData.edges) {
        store.loadDiagram({
          id: diagramId,
          name: initialName,
          nodes: initialData.nodes as any,
          edges: initialData.edges as any,
          viewport: (initialData.viewport as any) ?? { x: 0, y: 0, zoom: 1 },
        })
      } else {
        store.setDiagramName(initialName)
      }
    } else {
      store.setDiagramName(initialName)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    await save()
  }

  const handleSaveVersion = async (name: string) => {
    const thumbnailUrl = await capture()
    await save()
    return saveVersion(name, thumbnailUrl ?? undefined)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <WhiteboardApp
          diagramId={diagramId}
          saveStatus={saveStatus}
          onSave={handleSave}
          onHistoryOpen={() => setHistoryOpen(true)}
          userId={userId}
          userEmail={userEmail}
        />
      </div>

      {/* History sidebar */}
      {historyOpen && (
        <HistorySidebar
          diagramId={diagramId}
          onClose={() => setHistoryOpen(false)}
          onSaveVersion={handleSaveVersion}
        />
      )}
    </div>
  )
}
