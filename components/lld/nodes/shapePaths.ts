/**
 * SVG geometry for every shape drawn as a raw outline.
 *
 * Kept as pure `(w, h) => path` builders separate from the React renderers so
 * the palette preview and the canvas node draw from the same source. A palette
 * icon that is hand-drawn separately from its shape will always drift.
 *
 * Notation follows the standard flowchart symbol set and the UML state machine /
 * activity references.
 */

export type PathBuilder = (w: number, h: number) => string

const clamp = (v: number, max: number) => Math.min(v, max)

// ─── classic flowchart symbols ───────────────────────────────────────────────

/** Input / output — parallelogram. */
export const dataPath: PathBuilder = (w, h) => {
  const s = clamp(w * 0.18, 26)
  return `M ${s},1 H ${w - 1} L ${w - s},${h - 1} H 1 Z`
}

/** Document — flat top, single wavy base. */
export const documentPath: PathBuilder = (w, h) => {
  const wave = clamp(h * 0.2, 16)
  const body = h - wave - 1
  return `M 1,1 H ${w - 1} V ${body} Q ${w * 0.75},${body + wave} ${w / 2},${body} Q ${w * 0.25},${body - wave} 1,${body} Z`
}

/** Manual input — rectangle with a sloped top edge. */
export const manualInputPath: PathBuilder = (w, h) => {
  const slope = clamp(h * 0.28, 20)
  return `M 1,${slope} L ${w - 1},1 V ${h - 1} H 1 Z`
}

/** Manual operation — trapezoid, narrower at the bottom. */
export const manualOperationPath: PathBuilder = (w, h) => {
  const s = clamp(w * 0.14, 22)
  return `M 1,1 H ${w - 1} L ${w - s},${h - 1} H ${s} Z`
}

/** Delay / wait — rectangle with a semicircular right end. */
export const delayPath: PathBuilder = (w, h) => {
  const r = h / 2 - 1
  return `M 1,1 H ${w - r - 1} A ${r} ${r} 0 0 1 ${w - r - 1},${h - 1} H 1 Z`
}

/** Preparation — elongated hexagon. */
export const preparationPath: PathBuilder = (w, h) => {
  const s = clamp(w * 0.16, 24)
  return `M ${s},1 H ${w - s} L ${w - 1},${h / 2} L ${w - s},${h - 1} H ${s} L 1,${h / 2} Z`
}

/** Stored data — rectangle with both vertical edges curved the same way. */
export const storedDataPath: PathBuilder = (w, h) => {
  const c = clamp(w * 0.12, 20)
  return `M ${c},1 H ${w - 1} Q ${w - c - 1},${h / 2} ${w - 1},${h - 1} H ${c} Q 1,${h / 2} ${c},1 Z`
}

/** Direct-access storage / database — cylinder seen from the side. */
export const databasePath: PathBuilder = (w, h) => {
  const ry = clamp(h * 0.16, 14)
  return `M 1,${ry} A ${w / 2 - 1} ${ry} 0 0 1 ${w - 1},${ry} V ${h - ry} A ${w / 2 - 1} ${ry} 0 0 1 1,${h - ry} Z`
}

/** Off-page connector — home-plate pentagon. */
export const offPagePath: PathBuilder = (w, h) => {
  const point = clamp(h * 0.3, 22)
  return `M 1,1 H ${w - 1} V ${h - point} L ${w / 2},${h - 1} L 1,${h - point} Z`
}

/** Display — rounded left edge, pointed right. */
export const displayPath: PathBuilder = (w, h) => {
  const s = clamp(w * 0.14, 22)
  const r = h / 2
  return `M ${s},1 H ${w - s} L ${w - 1},${h / 2} L ${w - s},${h - 1} H ${s} A ${r} ${r} 0 0 1 ${s},1 Z`
}

/** Sequential-access data — a tape reel. */
export const tapePath: PathBuilder = (w, h) => {
  const ry = clamp(h * 0.14, 12)
  return `M 1,${h / 2} A ${w / 2 - 1} ${h / 2 - 1} 0 1 1 ${w - 1},${h / 2 + ry} L ${w - 1},${h - 1} L ${w / 2},${h - 1} Z`
}

/** Extract / merge — triangles used in data-flow charts. */
export const extractPath: PathBuilder = (w, h) => `M ${w / 2},1 L ${w - 1},${h - 1} H 1 Z`
export const mergeFlowPath: PathBuilder = (w, h) => `M 1,1 H ${w - 1} L ${w / 2},${h - 1} Z`

/** Loop limit — rectangle with the top corners cut. */
export const loopLimitPath: PathBuilder = (w, h) => {
  const c = clamp(w * 0.12, 18)
  return `M ${c},1 H ${w - c} L ${w - 1},${c} V ${h - 1} H 1 V ${c} Z`
}

// ─── UML activity symbols ────────────────────────────────────────────────────

/** Send signal — rectangle with a convex point on the right. */
export const sendSignalPath: PathBuilder = (w, h) => {
  const point = clamp(w * 0.18, 26)
  return `M 1,1 H ${w - point} L ${w - 1},${h / 2} L ${w - point},${h - 1} H 1 Z`
}

/** Receive signal — rectangle with a concave notch on the left. */
export const receiveSignalPath: PathBuilder = (w, h) => {
  const notch = clamp(w * 0.18, 26)
  return `M 1,1 H ${w - 1} V ${h - 1} H 1 L ${notch},${h / 2} Z`
}

/** Time event — an hourglass. */
export const timeEventPath: PathBuilder = (w, h) =>
  `M 1,1 H ${w - 1} L 1,${h - 1} H ${w - 1} Z`

// ─── shared ──────────────────────────────────────────────────────────────────

export const diamondPath: PathBuilder = (w, h) =>
  `M ${w / 2},1 L ${w - 1},${h / 2} L ${w / 2},${h - 1} L 1,${h / 2} Z`

export const rectPath: PathBuilder = (w, h) => `M 1,1 H ${w - 1} V ${h - 1} H 1 Z`

/**
 * Every outline-drawn shape, keyed by its shape kind.
 *
 * `predefined`, `internal-storage`, `multi-document`, `or` and
 * `summing-junction` need more than one path element, so they are handled by the
 * renderer rather than living here.
 */
export const OUTLINE_PATHS = {
  data: dataPath,
  document: documentPath,
  'manual-input': manualInputPath,
  'manual-operation': manualOperationPath,
  delay: delayPath,
  preparation: preparationPath,
  'stored-data': storedDataPath,
  database: databasePath,
  'off-page': offPagePath,
  display: displayPath,
  tape: tapePath,
  extract: extractPath,
  'loop-limit': loopLimitPath,
  'send-signal': sendSignalPath,
  'receive-signal': receiveSignalPath,
  'time-event': timeEventPath,
  decision: diamondPath,
  merge: diamondPath,
} as const

export type OutlineShapeKind = keyof typeof OUTLINE_PATHS

export function hasOutlinePath(kind: string): kind is OutlineShapeKind {
  return kind in OUTLINE_PATHS
}
