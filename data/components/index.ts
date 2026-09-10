import type { ArchitectureComponent, ComponentCategory, Provider } from '@/types'
import { genericComponents } from './generic'
import { awsComponents } from './aws'

// Combined registry — single source of truth
export const componentRegistry: ArchitectureComponent[] = [
  ...genericComponents,
  ...awsComponents,
]

// Lookup by id
export function getComponentById(id: string): ArchitectureComponent | undefined {
  return componentRegistry.find((c) => c.id === id)
}

// Filter by category
export function getComponentsByCategory(category: ComponentCategory): ArchitectureComponent[] {
  return componentRegistry.filter((c) => c.category === category)
}

// Filter by provider
export function getComponentsByProvider(provider: Provider): ArchitectureComponent[] {
  return componentRegistry.filter((c) => c.provider === provider)
}

// Search across name, category, provider, tags
export function searchComponents(query: string): ArchitectureComponent[] {
  const q = query.toLowerCase().trim()
  if (!q) return componentRegistry
  return componentRegistry.filter((c) => {
    return (
      c.name.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      (c.provider && c.provider.toLowerCase().includes(q)) ||
      c.description.toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q))
    )
  })
}

// All distinct categories in use
export function getAllCategories(): ComponentCategory[] {
  const cats = new Set(componentRegistry.map((c) => c.category))
  return Array.from(cats)
}

// All distinct providers in use
export function getAllProviders(): Provider[] {
  const provs = new Set(
    componentRegistry.map((c) => c.provider).filter(Boolean) as Provider[]
  )
  return Array.from(provs)
}

export { genericComponents, awsComponents }
