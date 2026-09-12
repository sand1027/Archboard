/**
 * Single source of truth for canvas entity ids.
 *
 * This body was previously copy-pasted verbatim in five places
 * (Whiteboard, diagramStore, spawnLldNode, ComponentLibrary, ContextMenu).
 * Keep the format stable — persisted documents contain these ids.
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Prefixed id, for sub-entities that benefit from being readable in a JSON dump. */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}-${generateId()}`
}
