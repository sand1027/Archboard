'use client'

import { useEffect, useState } from 'react'
import { useDiagramStore } from '@/store/diagramStore'
import { applyRawDocument } from '@/lib/persistence/documentPayload'
import { useDiagramSync } from '@/hooks/useDiagramSync'
import { useThumbnail } from '@/hooks/useThumbnail'
import WhiteboardApp from '@/components/WhiteboardApp'
import HistorySidebar from '@/components/sync/HistorySidebar'

interface Props {
  diagramId: string
  /** Raw jsonb from diagrams.data — any historical shape. */
  initialData: unknown
  initialName: string
  userId: string
  userEmail: string
  /** Team the diagram belongs to, so the share dialog can show it. */
  teamId?: string | null
}

export default function DiagramEditor({ diagramId, initialData, initialName, userId, userEmail, teamId }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const { saveStatus, dirty, save, saveVersion } = useDiagramSync(diagramId)
  const { capture } = useThumbnail(diagramId, userId)

  // Hydrate both stores from Supabase data on mount. All payload shapes —
  // v3 with LLD workspaces, v2 boards, and the legacy flat format — are handled
  // by migrateDocument, so there is no format branching here any more.
  useEffect(() => {
    if (!applyRawDocument(initialData)) {
      useDiagramStore.getState().setDiagramName(initialName)
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
          unsaved={dirty}
          onSave={handleSave}
          onHistoryOpen={() => setHistoryOpen(true)}
          userId={userId}
          userEmail={userEmail}
          teamId={teamId}
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
