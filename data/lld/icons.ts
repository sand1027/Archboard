import type { LldCatalogItem } from '@/types/lld'

const ICONS: { id: string; name: string; iconName: string; tags: string[] }[] = [
  { id: 'icon-user', name: 'User', iconName: 'User', tags: ['user', 'person'] },
  { id: 'icon-users', name: 'Users', iconName: 'Users', tags: ['users', 'team'] },
  { id: 'icon-lock', name: 'Lock', iconName: 'Lock', tags: ['lock', 'security'] },
  { id: 'icon-key', name: 'Key', iconName: 'Key', tags: ['key', 'auth'] },
  { id: 'icon-db', name: 'Database', iconName: 'Database', tags: ['database', 'db'] },
  { id: 'icon-server', name: 'Server', iconName: 'Server', tags: ['server'] },
  { id: 'icon-mail', name: 'Mail', iconName: 'Mail', tags: ['mail', 'email'] },
  { id: 'icon-api', name: 'API', iconName: 'Webhook', tags: ['api', 'webhook'] },
  { id: 'icon-file', name: 'File', iconName: 'FileText', tags: ['file', 'doc'] },
  { id: 'icon-folder', name: 'Folder', iconName: 'Folder', tags: ['folder'] },
  { id: 'icon-cloud', name: 'Cloud', iconName: 'Cloud', tags: ['cloud'] },
  { id: 'icon-phone', name: 'Phone', iconName: 'Smartphone', tags: ['phone', 'mobile'] },
  { id: 'icon-globe', name: 'Globe', iconName: 'Globe', tags: ['web', 'globe'] },
  { id: 'icon-settings', name: 'Settings', iconName: 'Settings', tags: ['settings', 'config'] },
  { id: 'icon-bell', name: 'Bell', iconName: 'Bell', tags: ['notification', 'bell'] },
  { id: 'icon-cart', name: 'Cart', iconName: 'ShoppingCart', tags: ['cart', 'shop'] },
  { id: 'icon-credit', name: 'Payment', iconName: 'CreditCard', tags: ['payment', 'card'] },
  { id: 'icon-queue', name: 'Queue', iconName: 'ListOrdered', tags: ['queue', 'list'] },
  { id: 'icon-cache', name: 'Cache', iconName: 'Zap', tags: ['cache', 'fast'] },
  { id: 'icon-shield', name: 'Shield', iconName: 'Shield', tags: ['shield', 'secure'] },
]

export const iconItems: LldCatalogItem[] = ICONS.map((i) => ({
  id: i.id,
  name: i.name,
  description: `${i.name} icon`,
  tab: 'icons' as const,
  tags: i.tags,
  spawn: { kind: 'icon' as const, iconName: i.iconName, label: i.name },
}))
