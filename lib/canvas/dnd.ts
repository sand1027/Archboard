/**
 * Drag-and-drop payload contract shared by every palette and canvas.
 *
 * The payload crossing the boundary is a bare id string — the full catalog
 * entry is re-resolved on drop from the in-memory registry. Keep it that way:
 * serialising the whole object into dataTransfer would let a stale palette
 * definition outlive a registry change.
 */
export const DND_MIME = {
  /** HLD component from the architecture registry */
  hldComponent: 'application/archboard-component',
  /** Legacy global LLD board catalog item */
  lldCatalog: 'application/archboard-lld',
  /** LLD workspace palette item (per-diagram-type shapes) */
  lldShape: 'application/archboard-lld-shape',
} as const

export type DndMime = (typeof DND_MIME)[keyof typeof DND_MIME]

export function setDragPayload(e: React.DragEvent, mime: DndMime, id: string): void {
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData(mime, id)
}

export function readDragPayload(e: React.DragEvent, mime: DndMime): string | null {
  return e.dataTransfer.getData(mime) || null
}
