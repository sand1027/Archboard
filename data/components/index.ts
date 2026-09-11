import type { ArchitectureComponent, ComponentCategory, Provider } from '@/types'
import { genericComponents } from './generic'
import { awsComponents } from './aws'
import { bytebytegoComponents } from './bytebytego'
import {
  shardingComponents,
  rateLimitingComponents,
  cachingPatternComponents,
  replicationComponents,
  loadBalancingComponents,
  streamingComponents,
  consistencyComponents,
  resilienceComponents,
  dbInternalsComponents,
  infraDevopsComponents,
  externalComponents,
  actorComponents,
  patternComponents,
} from './extended'

export const componentRegistry: ArchitectureComponent[] = [
  ...genericComponents,
  ...awsComponents,
  ...bytebytegoComponents,
  ...shardingComponents,
  ...rateLimitingComponents,
  ...cachingPatternComponents,
  ...replicationComponents,
  ...loadBalancingComponents,
  ...streamingComponents,
  ...consistencyComponents,
  ...resilienceComponents,
  ...dbInternalsComponents,
  ...infraDevopsComponents,
  ...externalComponents,
  ...actorComponents,
  ...patternComponents,
]

export function getComponentById(id: string): ArchitectureComponent | undefined {
  return componentRegistry.find((c) => c.id === id)
}

export function getComponentsByCategory(category: ComponentCategory): ArchitectureComponent[] {
  return componentRegistry.filter((c) => c.category === category)
}

export function getComponentsByProvider(provider: Provider): ArchitectureComponent[] {
  return componentRegistry.filter((c) => c.provider === provider)
}

export function searchComponents(query: string): ArchitectureComponent[] {
  const q = query.toLowerCase().trim()
  if (!q) return componentRegistry
  return componentRegistry.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      (c.provider && c.provider.toLowerCase().includes(q)) ||
      c.description.toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q))
  )
}

export function getAllCategories(): ComponentCategory[] {
  return Array.from(new Set(componentRegistry.map((c) => c.category)))
}

export function getAllProviders(): Provider[] {
  return Array.from(
    new Set(componentRegistry.map((c) => c.provider).filter(Boolean) as Provider[])
  )
}

export {
  genericComponents, awsComponents,
  shardingComponents, rateLimitingComponents, cachingPatternComponents,
  replicationComponents, loadBalancingComponents, streamingComponents,
  consistencyComponents, resilienceComponents, dbInternalsComponents,
  infraDevopsComponents, externalComponents, actorComponents, patternComponents,
}
