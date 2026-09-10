import type { LldCatalogItem, LldLibraryTab } from '@/types/lld'
import { flowchartItems } from './flowchart'
import { umlItems } from './uml'
import { erItems } from './er'
import { sequenceItems } from './sequence'
import { iconItems } from './icons'

export const lldCatalog: LldCatalogItem[] = [
  ...flowchartItems,
  ...umlItems,
  ...erItems,
  ...sequenceItems,
  ...iconItems,
]

export function getLldByTab(tab: LldLibraryTab): LldCatalogItem[] {
  return lldCatalog.filter((i) => i.tab === tab)
}

export function searchLldCatalog(query: string): LldCatalogItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return lldCatalog
  return lldCatalog.filter(
    (i) =>
      i.name.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.tags.some((t) => t.includes(q))
  )
}

export function findLldItem(id: string): LldCatalogItem | undefined {
  return lldCatalog.find((i) => i.id === id)
}
