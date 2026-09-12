import type { ComponentCategory } from '@/types/architecture'
import { INSTANCE_TYPE_IDS } from './instanceTypes'

/**
 * Per-component configuration.
 *
 * A database and a load balancer are not configured the same way, so one shared set of
 * four fields was a placeholder. A database has an engine, a version, storage and a
 * connection pool; a balancer has an algorithm, health checks and a connection ceiling; a
 * cache has an eviction policy and a memory ceiling.
 *
 * Schemas are declared by category with per-component overrides, the same shape as the
 * capacity profiles, so 233 components are covered without 233 schemas. Adding a specific
 * one is a few lines in CONFIG_BY_COMPONENT.
 *
 * Fields marked `drives` are wired into the simulation. That distinction matters: a form
 * that records numbers nothing reads is documentation pretending to be a model.
 */

export type ConfigFieldType = 'number' | 'text' | 'select' | 'boolean'

/** What a field feeds, when it feeds something. */
export type ConfigDriver = 'sizing' | 'concurrency'

export interface ConfigField {
  key: string
  label: string
  type: ConfigFieldType
  hint?: string
  unit?: string
  options?: readonly string[]
  placeholder?: string | number
  min?: number
  max?: number
  drives?: ConfigDriver
}

export interface ConfigGroup {
  title: string
  fields: readonly ConfigField[]
}

// ─── shared fields ────────────────────────────────────────────────────────────

const INSTANCE_TYPE_FIELD: ConfigField = {
  key: 'instanceType',
  label: 'Instance type',
  type: 'select',
  options: INSTANCE_TYPE_IDS,
  hint: 'Sets vCPU and RAM',
  drives: 'sizing',
}

const DEPLOYMENT_FIELDS: readonly ConfigField[] = [
  { key: 'environment', label: 'Environment', type: 'select', options: ['dev', 'staging', 'prod'] },
  { key: 'region', label: 'Region', type: 'text', placeholder: 'us-east-1' },
]

// ─── category schemas ─────────────────────────────────────────────────────────

const COMPUTE_FIELDS: readonly ConfigField[] = [
  INSTANCE_TYPE_FIELD,
  { key: 'runtime', label: 'Runtime', type: 'text', placeholder: 'node 22' },
  { key: 'autoscaling', label: 'Autoscaling', type: 'boolean' },
  { key: 'minInstances', label: 'Min instances', type: 'number', min: 0, max: 10_000 },
  { key: 'maxInstances', label: 'Max instances', type: 'number', min: 1, max: 10_000 },
  {
    key: 'maxConnections',
    label: 'Max connections',
    type: 'number',
    min: 1,
    max: 1_000_000,
    hint: 'Caps requests in flight',
    drives: 'concurrency',
  },
]

const DATABASE_FIELDS: readonly ConfigField[] = [
  INSTANCE_TYPE_FIELD,
  {
    key: 'engine',
    label: 'Engine',
    type: 'select',
    options: ['postgres', 'mysql', 'mariadb', 'sqlserver', 'oracle', 'mongodb', 'cassandra', 'dynamodb'],
  },
  { key: 'engineVersion', label: 'Version', type: 'text', placeholder: '16' },
  { key: 'storageGb', label: 'Storage', type: 'number', unit: 'GB', min: 0, max: 1_000_000 },
  {
    key: 'connectionPool',
    label: 'Connection pool',
    type: 'number',
    min: 1,
    max: 100_000,
    hint: 'The real concurrency ceiling for most databases',
    drives: 'concurrency',
  },
  { key: 'readReplicas', label: 'Read replicas', type: 'number', min: 0, max: 1_000 },
  { key: 'multiAz', label: 'Multi-AZ', type: 'boolean' },
  { key: 'backupRetentionDays', label: 'Backup retention', type: 'number', unit: 'days', min: 0, max: 3_650 },
]

const CACHE_FIELDS: readonly ConfigField[] = [
  INSTANCE_TYPE_FIELD,
  { key: 'maxMemoryGb', label: 'Max memory', type: 'number', unit: 'GB', min: 0, max: 65_536 },
  {
    key: 'evictionPolicy',
    label: 'Eviction',
    type: 'select',
    options: ['allkeys-lru', 'allkeys-lfu', 'volatile-lru', 'volatile-ttl', 'noeviction'],
  },
  { key: 'ttlSeconds', label: 'Default TTL', type: 'number', unit: 's', min: 0, max: 31_536_000 },
  { key: 'clusterMode', label: 'Cluster mode', type: 'boolean' },
]

const QUEUE_FIELDS: readonly ConfigField[] = [
  {
    key: 'partitions',
    label: 'Partitions',
    type: 'number',
    min: 1,
    max: 100_000,
    hint: 'Consumer parallelism',
    drives: 'concurrency',
  },
  { key: 'retentionHours', label: 'Retention', type: 'number', unit: 'h', min: 0, max: 87_600 },
  { key: 'consumerGroups', label: 'Consumer groups', type: 'number', min: 1, max: 10_000 },
  { key: 'deliveryGuarantee', label: 'Delivery', type: 'select', options: ['at-most-once', 'at-least-once', 'exactly-once'] },
  { key: 'dlq', label: 'Dead-letter queue', type: 'boolean' },
]

const BALANCER_FIELDS: readonly ConfigField[] = [
  {
    key: 'algorithm',
    label: 'Algorithm',
    type: 'select',
    options: ['round-robin', 'least-connections', 'ip-hash', 'weighted', 'random'],
  },
  {
    key: 'maxConnections',
    label: 'Max connections',
    type: 'number',
    min: 1,
    max: 10_000_000,
    hint: 'Caps requests in flight',
    drives: 'concurrency',
  },
  { key: 'healthCheckSeconds', label: 'Health check', type: 'number', unit: 's', min: 1, max: 3_600 },
  { key: 'timeoutSeconds', label: 'Timeout', type: 'number', unit: 's', min: 1, max: 3_600 },
  { key: 'tlsTermination', label: 'TLS termination', type: 'boolean' },
  { key: 'stickySessions', label: 'Sticky sessions', type: 'boolean' },
]

const STORAGE_FIELDS: readonly ConfigField[] = [
  { key: 'capacityGb', label: 'Capacity', type: 'number', unit: 'GB', min: 0, max: 1e9 },
  {
    key: 'storageClass',
    label: 'Class',
    type: 'select',
    options: ['standard', 'infrequent-access', 'one-zone', 'glacier', 'deep-archive'],
  },
  { key: 'versioning', label: 'Versioning', type: 'boolean' },
  { key: 'encryption', label: 'Encryption at rest', type: 'boolean' },
  { key: 'lifecycleDays', label: 'Lifecycle transition', type: 'number', unit: 'days', min: 0, max: 36_500 },
]

const RATE_LIMIT_FIELDS: readonly ConfigField[] = [
  { key: 'limitPerSecond', label: 'Limit', type: 'number', unit: 'req/s', min: 0, max: 10_000_000 },
  { key: 'burst', label: 'Burst', type: 'number', min: 0, max: 10_000_000 },
  { key: 'scope', label: 'Scope', type: 'select', options: ['global', 'per-user', 'per-ip', 'per-key'] },
  { key: 'onExceeded', label: 'When exceeded', type: 'select', options: ['reject', 'delay'] },
]

const SECURITY_FIELDS: readonly ConfigField[] = [
  { key: 'authMethod', label: 'Auth', type: 'select', options: ['jwt', 'oauth2', 'oidc', 'api-key', 'mtls', 'session'] },
  { key: 'tokenTtlSeconds', label: 'Token TTL', type: 'number', unit: 's', min: 0, max: 31_536_000 },
  { key: 'mfa', label: 'MFA required', type: 'boolean' },
]

const OBSERVABILITY_FIELDS: readonly ConfigField[] = [
  { key: 'retentionDays', label: 'Retention', type: 'number', unit: 'days', min: 0, max: 3_650 },
  { key: 'sampleRate', label: 'Sample rate', type: 'number', min: 0, max: 1 },
  { key: 'alerting', label: 'Alerting', type: 'boolean' },
]

const NETWORK_FIELDS: readonly ConfigField[] = [
  { key: 'protocolPort', label: 'Port', type: 'number', min: 1, max: 65_535 },
  { key: 'timeoutSeconds', label: 'Timeout', type: 'number', unit: 's', min: 1, max: 3_600 },
  { key: 'tlsTermination', label: 'TLS', type: 'boolean' },
]

export const CONFIG_BY_CATEGORY: Partial<Record<ComponentCategory, readonly ConfigField[]>> = {
  compute: COMPUTE_FIELDS,
  services: COMPUTE_FIELDS,
  databases: DATABASE_FIELDS,
  'db-internals': DATABASE_FIELDS,
  replication: DATABASE_FIELDS,
  sharding: DATABASE_FIELDS,
  caching: CACHE_FIELDS,
  'caching-patterns': CACHE_FIELDS,
  messaging: QUEUE_FIELDS,
  streaming: QUEUE_FIELDS,
  'load-balancing': BALANCER_FIELDS,
  networking: NETWORK_FIELDS,
  storage: STORAGE_FIELDS,
  'rate-limiting': RATE_LIMIT_FIELDS,
  security: SECURITY_FIELDS,
  observability: OBSERVABILITY_FIELDS,
}

// ─── component overrides ──────────────────────────────────────────────────────

/**
 * Specific components whose real configuration differs enough from their category to be
 * worth spelling out. Extends the category schema rather than replacing it, with matching
 * keys taking these definitions.
 */
export const CONFIG_BY_COMPONENT: Record<string, readonly ConfigField[]> = {
  'aws-ec2': [
    { key: 'ami', label: 'AMI', type: 'text', placeholder: 'ami-0abc123' },
    { key: 'ebsGb', label: 'EBS volume', type: 'number', unit: 'GB', min: 1, max: 65_536 },
    { key: 'ebsType', label: 'EBS type', type: 'select', options: ['gp3', 'gp2', 'io2', 'st1', 'sc1'] },
    { key: 'privateIp', label: 'Private IP', type: 'text', placeholder: '10.0.1.20' },
    { key: 'publicIp', label: 'Public IP', type: 'boolean' },
    { key: 'securityGroup', label: 'Security group', type: 'text', placeholder: 'sg-web' },
    { key: 'keyPair', label: 'Key pair', type: 'text' },
  ],

  'aws-lambda': [
    { key: 'memoryMb', label: 'Memory', type: 'number', unit: 'MB', min: 128, max: 10_240 },
    { key: 'timeoutSeconds', label: 'Timeout', type: 'number', unit: 's', min: 1, max: 900 },
    {
      key: 'reservedConcurrency',
      label: 'Reserved concurrency',
      type: 'number',
      min: 1,
      max: 1_000_000,
      hint: 'Hard ceiling on parallel executions',
      drives: 'concurrency',
    },
    { key: 'runtime', label: 'Runtime', type: 'text', placeholder: 'nodejs22.x' },
  ],

  'aws-s3': [
    {
      key: 'storageClass',
      label: 'Storage class',
      type: 'select',
      options: ['STANDARD', 'STANDARD_IA', 'ONEZONE_IA', 'INTELLIGENT_TIERING', 'GLACIER_IR', 'DEEP_ARCHIVE'],
    },
    { key: 'bucketName', label: 'Bucket', type: 'text', placeholder: 'my-assets' },
    { key: 'publicAccess', label: 'Public access', type: 'boolean' },
  ],

  kubernetes: [
    { key: 'replicas', label: 'Replicas', type: 'number', min: 0, max: 10_000 },
    { key: 'cpuRequest', label: 'CPU request', type: 'number', unit: 'cores', min: 0, max: 1_024 },
    { key: 'memRequestGb', label: 'Memory request', type: 'number', unit: 'GB', min: 0, max: 65_536 },
    { key: 'hpaTargetCpu', label: 'HPA target CPU', type: 'number', unit: '%', min: 1, max: 100 },
    { key: 'namespace', label: 'Namespace', type: 'text', placeholder: 'default' },
  ],

  dns: [
    { key: 'recordType', label: 'Record type', type: 'select', options: ['A', 'AAAA', 'CNAME', 'ALIAS', 'NS'] },
    { key: 'ttlSeconds', label: 'TTL', type: 'number', unit: 's', min: 0, max: 604_800 },
    { key: 'domain', label: 'Domain', type: 'text', placeholder: 'example.com' },
  ],

  cdn: [
    { key: 'edgeLocations', label: 'Edge locations', type: 'number', min: 1, max: 1_000 },
    { key: 'cacheTtlSeconds', label: 'Cache TTL', type: 'number', unit: 's', min: 0, max: 31_536_000 },
    { key: 'compression', label: 'Compression', type: 'boolean' },
    { key: 'originShield', label: 'Origin shield', type: 'boolean' },
  ],

  'api-gateway': [
    { key: 'authMethod', label: 'Auth', type: 'select', options: ['none', 'jwt', 'oauth2', 'api-key', 'iam'] },
    {
      key: 'throttlePerSecond',
      label: 'Throttle',
      type: 'number',
      unit: 'req/s',
      min: 0,
      max: 10_000_000,
    },
    { key: 'stage', label: 'Stage', type: 'text', placeholder: 'prod' },
    { key: 'timeoutSeconds', label: 'Timeout', type: 'number', unit: 's', min: 1, max: 3_600 },
  ],
}

/**
 * The fields to show for a node: its component's specifics merged over its category's,
 * plus deployment details that apply to everything.
 *
 * Grouped rather than flat so the inspector can show "Configuration" separately from
 * "Deployment" — a long ungrouped list of fifteen inputs is unusable.
 */
export function configGroupsFor(componentId: unknown, category: unknown): ConfigGroup[] {
  const categoryFields =
    (typeof category === 'string'
      ? CONFIG_BY_CATEGORY[category as ComponentCategory]
      : undefined) ?? []

  const componentFields =
    (typeof componentId === 'string' ? CONFIG_BY_COMPONENT[componentId] : undefined) ?? []

  // Component definitions win on key collision; order keeps the specific ones first.
  const seen = new Set(componentFields.map((f) => f.key))
  const merged = [...componentFields, ...categoryFields.filter((f) => !seen.has(f.key))]

  const groups: ConfigGroup[] = []
  if (merged.length > 0) groups.push({ title: 'Configuration', fields: merged })
  groups.push({ title: 'Deployment', fields: DEPLOYMENT_FIELDS })
  return groups
}

/** Every field that could apply to a node, flattened — for lookups and validation. */
export function configFieldsFor(componentId: unknown, category: unknown): ConfigField[] {
  return configGroupsFor(componentId, category).flatMap((g) => [...g.fields])
}

/** The first field driving `driver`, if the node has one. */
export function fieldDriving(
  componentId: unknown,
  category: unknown,
  driver: ConfigDriver
): ConfigField | undefined {
  return configFieldsFor(componentId, category).find((f) => f.drives === driver)
}
