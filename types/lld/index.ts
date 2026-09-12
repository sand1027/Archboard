// Legacy global-LLD-board types (UML/ER/lifeline/icon nodes + palette catalog).
// Kept and re-exported so every existing `@/types/lld` import keeps working.
export * from './legacy'

// Per-component LLD workspace model.
export * from './style'
export * from './shapes'
export * from './edges'
export * from './workspace'
export * from './palette'

/**
 * Exhaustiveness guard for discriminated-union switches.
 *
 * `default: return assertNever(x)` turns a missing union arm into a compile
 * error at every call site, which is how 7 diagram types stay consistent while
 * being added one at a time.
 */
export function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`)
}
