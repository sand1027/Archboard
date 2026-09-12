/**
 * Instance type catalogue.
 *
 * Picking a machine is how people actually size a tier — nobody thinks "6 vCPU", they
 * think "three m5.large". Selecting a type fills in vCPU and RAM, which feeds the
 * concurrency the simulation uses, so the config is load-bearing rather than decorative.
 *
 * Deliberately a small, recognisable set rather than an exhaustive one. The point is to
 * anchor the arithmetic in familiar hardware; anyone needing an exact SKU can type the
 * vCPU and RAM directly.
 */

export interface InstanceType {
  id: string
  /** vCPU per instance. */
  vcpu: number
  /** RAM per instance, in GB. */
  memoryGb: number
  /** Rough shape, so the picker can group them. */
  family: 'general' | 'compute' | 'memory' | 'burstable'
}

export const INSTANCE_TYPES: readonly InstanceType[] = [
  // AWS burstable — the default choice for small services.
  { id: 't3.micro', vcpu: 2, memoryGb: 1, family: 'burstable' },
  { id: 't3.small', vcpu: 2, memoryGb: 2, family: 'burstable' },
  { id: 't3.medium', vcpu: 2, memoryGb: 4, family: 'burstable' },
  { id: 't3.large', vcpu: 2, memoryGb: 8, family: 'burstable' },

  // AWS general purpose.
  { id: 'm5.large', vcpu: 2, memoryGb: 8, family: 'general' },
  { id: 'm5.xlarge', vcpu: 4, memoryGb: 16, family: 'general' },
  { id: 'm5.2xlarge', vcpu: 8, memoryGb: 32, family: 'general' },
  { id: 'm5.4xlarge', vcpu: 16, memoryGb: 64, family: 'general' },

  // Compute optimised — CPU-bound work.
  { id: 'c5.large', vcpu: 2, memoryGb: 4, family: 'compute' },
  { id: 'c5.xlarge', vcpu: 4, memoryGb: 8, family: 'compute' },
  { id: 'c5.4xlarge', vcpu: 16, memoryGb: 32, family: 'compute' },

  // Memory optimised — caches and databases.
  { id: 'r5.large', vcpu: 2, memoryGb: 16, family: 'memory' },
  { id: 'r5.xlarge', vcpu: 4, memoryGb: 32, family: 'memory' },
  { id: 'r5.2xlarge', vcpu: 8, memoryGb: 64, family: 'memory' },
  { id: 'r5.4xlarge', vcpu: 16, memoryGb: 128, family: 'memory' },

  // GCP equivalents, for diagrams that are not on AWS.
  { id: 'e2-medium', vcpu: 2, memoryGb: 4, family: 'general' },
  { id: 'n2-standard-4', vcpu: 4, memoryGb: 16, family: 'general' },
  { id: 'n2-highmem-4', vcpu: 4, memoryGb: 32, family: 'memory' },
] as const

export const INSTANCE_TYPE_IDS: readonly string[] = INSTANCE_TYPES.map((t) => t.id)

const BY_ID = new Map(INSTANCE_TYPES.map((t) => [t.id, t]))

export function findInstanceType(id: unknown): InstanceType | undefined {
  return typeof id === 'string' ? BY_ID.get(id) : undefined
}

/** Human label for a picker: "m5.large — 2 vCPU, 8 GB". */
export function instanceTypeLabel(type: InstanceType): string {
  return `${type.id} — ${type.vcpu} vCPU, ${type.memoryGb} GB`
}
