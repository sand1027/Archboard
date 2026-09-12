'use client'

import { OUTLINE_PATHS, hasOutlinePath } from './nodes/shapePaths'
import type { LldSpawn } from '@/types/lld'

/**
 * Miniature previews of the actual shape a palette item spawns.
 *
 * The HLD palette shows the real product icon, so you drag what you see. A
 * shape palette should do the same: a 3-compartment box for a class, a headed
 * grid for a table, a stick figure for an actor. Generic outline icons would
 * make every item look alike.
 */

const STROKE = '#475569'
const FILL = '#ffffff'
const ACCENT = '#94A3B8'
const SW = 1.2

export function LldShapePreview({
  spawn,
  className = 'h-6 w-6',
}: {
  spawn: LldSpawn
  className?: string
}) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      {glyph(spawn)}
    </svg>
  )
}

function glyph(spawn: LldSpawn) {
  switch (spawn.shape) {
    case 'lldObject':
      return objectGlyph(spawn.isMultiObject)
    case 'lldDeployNode':
      return deployNodeGlyph()
    case 'lldArtifact':
      return artifactGlyph()
    case 'lldComponent':
      return componentGlyph()
    case 'lldInterface':
      return interfaceGlyph(spawn.direction)
    case 'lldActor':
      return actorGlyph(spawn.isSystem)
    case 'lldUseCase':
      return ucEllipseGlyph(spawn.isAbstract)
    case 'lldBoundary':
      return boundaryGlyph()
    case 'lldPackage':
      return packageGlyph()
    case 'lldClass':
      return classGlyph(spawn.stereotype)
    case 'lldTable':
      return tableGlyph(spawn.tableKind)
    case 'lldLifeline':
      return lifelineGlyph(spawn.lifelineKind)
    case 'lldActivation':
      return activationGlyph()
    case 'lldFragment':
      return fragmentGlyph()
    case 'lldEndpoint':
      return endpointGlyph()
    case 'lldSchema':
      return schemaGlyph(spawn.role)
    case 'lldAnnotation':
      return annotationGlyph()
    case 'lldState':
      return stateGlyph(spawn.stateKind)
    case 'lldActivity':
      return activityGlyph(spawn.activityKind)
    case 'lldSwimlane':
      return swimlaneGlyph()
    case 'lldModule':
      return moduleGlyph()
    case 'lldNote':
      return noteGlyph()
  }
}

// ─── structural family ───────────────────────────────────────────────────────

function objectGlyph(multi?: boolean) {
  return (
    <>
      {multi && <rect x={7} y={4} width={22} height={22} fill={FILL} stroke={STROKE} strokeWidth={SW} />}
      <rect x={3} y={7} width={22} height={22} fill={FILL} stroke={STROKE} strokeWidth={SW} />
      <line x1={3} y1={15} x2={25} y2={15} stroke={STROKE} strokeWidth={SW} />
      {/* underline marks an instance rather than a classifier */}
      <line x1={7} y1={12.5} x2={21} y2={12.5} stroke={ACCENT} strokeWidth={SW} />
      <line x1={7} y1={20} x2={20} y2={20} stroke={ACCENT} strokeWidth={SW} />
    </>
  )
}

function deployNodeGlyph() {
  return (
    <>
      <path d="M3 11 L8 6 H29 L24 11 Z" fill="#E2E8F0" stroke={STROKE} strokeWidth={SW} />
      <path d="M24 11 L29 6 V22 L24 27 Z" fill="#E2E8F0" stroke={STROKE} strokeWidth={SW} />
      <rect x={3} y={11} width={21} height={16} fill={FILL} stroke={STROKE} strokeWidth={SW} />
    </>
  )
}

function artifactGlyph() {
  return (
    <>
      <rect x={5} y={5} width={22} height={22} fill={FILL} stroke={STROKE} strokeWidth={SW} />
      <path d="M19 7 H23 L25 9 V13 H19 Z" fill="none" stroke={ACCENT} strokeWidth={SW} />
      <line x1={9} y1={19} x2={20} y2={19} stroke={ACCENT} strokeWidth={SW} />
      <line x1={9} y1={23} x2={16} y2={23} stroke={ACCENT} strokeWidth={SW} />
    </>
  )
}

function componentGlyph() {
  return (
    <>
      <rect x={8} y={6} width={20} height={20} fill={FILL} stroke={STROKE} strokeWidth={SW} />
      <rect x={4} y={10} width={8} height={4} fill={FILL} stroke={STROKE} strokeWidth={SW} />
      <rect x={4} y={18} width={8} height={4} fill={FILL} stroke={STROKE} strokeWidth={SW} />
    </>
  )
}

function interfaceGlyph(direction: 'provided' | 'required') {
  return (
    <>
      <line x1={3} y1={16} x2={18} y2={16} stroke={STROKE} strokeWidth={SW} />
      {direction === 'provided' ? (
        <circle cx={23} cy={16} r={5} fill={STROKE} />
      ) : (
        <path d="M18 9 A 7 7 0 0 0 18 23" fill="none" stroke={STROKE} strokeWidth={2} />
      )}
    </>
  )
}

// ─── use case family ─────────────────────────────────────────────────────────

function actorGlyph(isSystem?: boolean) {
  if (isSystem) {
    return (
      <>
        <rect x={6} y={8} width={20} height={16} rx={2} fill={FILL} stroke={STROKE} strokeWidth={SW} />
        <line x1={10} y1={16} x2={22} y2={16} stroke={ACCENT} strokeWidth={SW} />
      </>
    )
  }
  return (
    <>
      <circle cx={16} cy={8} r={4} fill="none" stroke={STROKE} strokeWidth={SW} />
      <path
        d="M16 12 V21 M10 16 H22 M16 21 L11 29 M16 21 L21 29"
        fill="none"
        stroke={STROKE}
        strokeWidth={SW}
        strokeLinecap="round"
      />
    </>
  )
}

function ucEllipseGlyph(isAbstract?: boolean) {
  return (
    <ellipse
      cx={16}
      cy={16}
      rx={14}
      ry={8}
      fill={FILL}
      stroke={STROKE}
      strokeWidth={SW}
      strokeDasharray={isAbstract ? '3 2' : undefined}
    />
  )
}

function boundaryGlyph() {
  return (
    <>
      <rect x={3} y={4} width={26} height={24} rx={2} fill="none" stroke={STROKE} strokeWidth={SW} />
      <line x1={6} y1={9} x2={16} y2={9} stroke={ACCENT} strokeWidth={SW} />
      <ellipse cx={16} cy={19} rx={8} ry={5} fill={FILL} stroke={ACCENT} strokeWidth={SW} />
    </>
  )
}

function packageGlyph() {
  return (
    <>
      <path d="M4 9 H15 V5 H4 Z" fill="#E2E8F0" stroke={STROKE} strokeWidth={SW} />
      <rect x={4} y={9} width={24} height={18} fill={FILL} stroke={STROKE} strokeWidth={SW} />
    </>
  )
}

// ─── class family ────────────────────────────────────────────────────────────

function classGlyph(stereotype: string) {
  const dashed = stereotype === 'abstract'
  return (
    <>
      <rect
        x={5}
        y={5}
        width={22}
        height={22}
        rx={1}
        fill={FILL}
        stroke={STROKE}
        strokeWidth={SW}
        strokeDasharray={dashed ? '3 2' : undefined}
      />
      {/* name compartment */}
      <line x1={5} y1={13} x2={27} y2={13} stroke={STROKE} strokeWidth={SW} />
      {stereotype === 'enum' ? (
        <>
          <line x1={9} y1={18} x2={20} y2={18} stroke={ACCENT} strokeWidth={SW} />
          <line x1={9} y1={22} x2={17} y2={22} stroke={ACCENT} strokeWidth={SW} />
        </>
      ) : (
        <>
          <line x1={5} y1={20} x2={27} y2={20} stroke={STROKE} strokeWidth={SW} />
          <line x1={9} y1={16.5} x2={18} y2={16.5} stroke={ACCENT} strokeWidth={SW} />
          <line x1={9} y1={24} x2={20} y2={24} stroke={ACCENT} strokeWidth={SW} />
        </>
      )}
      {stereotype === 'interface' && <circle cx={16} cy={9} r={2.4} fill="none" stroke={STROKE} strokeWidth={SW} />}
      {stereotype === 'struct' && <line x1={9} y1={9} x2={23} y2={9} stroke={ACCENT} strokeWidth={SW} />}
    </>
  )
}

// ─── ER ──────────────────────────────────────────────────────────────────────

function tableGlyph(kind: 'table' | 'view') {
  return (
    <>
      <rect
        x={4}
        y={6}
        width={24}
        height={20}
        rx={1}
        fill={FILL}
        stroke={STROKE}
        strokeWidth={SW}
        strokeDasharray={kind === 'view' ? '3 2' : undefined}
      />
      <rect x={4} y={6} width={24} height={6} fill="#E2E8F0" stroke={STROKE} strokeWidth={SW} />
      <line x1={4} y1={18} x2={28} y2={18} stroke={ACCENT} strokeWidth={SW} />
      <circle cx={8} cy={15} r={1.3} fill="#F59E0B" />
      <line x1={12} y1={15} x2={24} y2={15} stroke={ACCENT} strokeWidth={SW} />
      <line x1={12} y1={22} x2={24} y2={22} stroke={ACCENT} strokeWidth={SW} />
    </>
  )
}

// ─── sequence ────────────────────────────────────────────────────────────────

function lifelineGlyph(kind: string) {
  if (kind === 'actor') {
    return (
      <>
        <circle cx={16} cy={7} r={3} fill="none" stroke={STROKE} strokeWidth={SW} />
        <path
          d="M16 10 L16 17 M11 13 L21 13 M16 17 L12 23 M16 17 L20 23"
          fill="none"
          stroke={STROKE}
          strokeWidth={SW}
          strokeLinecap="round"
        />
        <line x1={16} y1={24} x2={16} y2={30} stroke={ACCENT} strokeWidth={SW} strokeDasharray="2 2" />
      </>
    )
  }
  return (
    <>
      <rect x={7} y={4} width={18} height={9} rx={1} fill={FILL} stroke={STROKE} strokeWidth={SW} />
      <line x1={16} y1={13} x2={16} y2={30} stroke={ACCENT} strokeWidth={SW} strokeDasharray="2 2" />
      {/* activation bar */}
      <rect x={14} y={17} width={4} height={9} fill="#E2E8F0" stroke={STROKE} strokeWidth={0.9} />
    </>
  )
}

function activationGlyph() {
  return (
    <>
      <line x1={16} y1={2} x2={16} y2={30} stroke={ACCENT} strokeWidth={SW} strokeDasharray="2 2" />
      <rect x={13} y={8} width={6} height={16} fill="#E2E8F0" stroke={STROKE} strokeWidth={SW} />
    </>
  )
}

function fragmentGlyph() {
  return (
    <>
      <rect x={4} y={6} width={24} height={20} fill="none" stroke={STROKE} strokeWidth={SW} />
      <path d="M4 6 H14 L14 12 H4 Z" fill="#E2E8F0" stroke={STROKE} strokeWidth={0.9} />
      <line x1={4} y1={18} x2={28} y2={18} stroke={ACCENT} strokeWidth={SW} strokeDasharray="3 2" />
    </>
  )
}

// ─── API ─────────────────────────────────────────────────────────────────────

function endpointGlyph() {
  return (
    <>
      <rect x={3} y={11} width={26} height={10} rx={5} fill={FILL} stroke={STROKE} strokeWidth={SW} />
      <rect x={5} y={13} width={9} height={6} rx={1.5} fill="#059669" />
      <line x1={17} y1={16} x2={26} y2={16} stroke={ACCENT} strokeWidth={SW} />
    </>
  )
}

function schemaGlyph(role: 'request' | 'response') {
  return (
    <>
      <rect x={5} y={5} width={22} height={22} rx={1} fill={FILL} stroke={STROKE} strokeWidth={SW} />
      <rect
        x={5}
        y={5}
        width={22}
        height={6}
        fill={role === 'request' ? '#DBEAFE' : '#DCFCE7'}
        stroke={STROKE}
        strokeWidth={SW}
      />
      <line x1={9} y1={15} x2={22} y2={15} stroke={ACCENT} strokeWidth={SW} />
      <line x1={9} y1={19} x2={19} y2={19} stroke={ACCENT} strokeWidth={SW} />
      <line x1={9} y1={23} x2={22} y2={23} stroke={ACCENT} strokeWidth={SW} />
    </>
  )
}

function annotationGlyph() {
  return (
    <>
      <rect x={3} y={11} width={26} height={10} rx={5} fill="#FFFBEB" stroke="#D97706" strokeWidth={SW} />
      <circle cx={9} cy={16} r={2} fill="#D97706" />
      <line x1={14} y1={16} x2={25} y2={16} stroke="#D97706" strokeWidth={SW} opacity={0.5} />
    </>
  )
}

// ─── state ───────────────────────────────────────────────────────────────────

function stateGlyph(kind: string) {
  if (kind === 'initial') return <circle cx={16} cy={16} r={7} fill={STROKE} />
  if (kind === 'final')
    return (
      <>
        <circle cx={16} cy={16} r={9} fill={FILL} stroke={STROKE} strokeWidth={SW} />
        <circle cx={16} cy={16} r={5.5} fill={STROKE} />
      </>
    )
  if (kind === 'choice')
    return (
      <polygon points="16,5 27,16 16,27 5,16" fill={FILL} stroke={STROKE} strokeWidth={SW} />
    )
  if (kind === 'history-shallow' || kind === 'history-deep')
    return (
      <>
        <circle cx={16} cy={16} r={9} fill={FILL} stroke={STROKE} strokeWidth={SW} />
        <text x={16} y={20} textAnchor="middle" fontSize={10} fontWeight={700} fill={STROKE}>
          {kind === 'history-deep' ? 'H*' : 'H'}
        </text>
      </>
    )
  if (kind === 'junction') return <circle cx={16} cy={16} r={5} fill={STROKE} />
  if (kind === 'entry-point')
    return <circle cx={16} cy={16} r={7} fill={FILL} stroke={STROKE} strokeWidth={SW} />
  if (kind === 'exit-point')
    return (
      <>
        <circle cx={16} cy={16} r={7} fill={FILL} stroke={STROKE} strokeWidth={SW} />
        <path d="M11 11 L21 21 M21 11 L11 21" stroke={STROKE} strokeWidth={SW} />
      </>
    )
  if (kind === 'terminate')
    return <path d="M7 7 L25 25 M25 7 L7 25" stroke={STROKE} strokeWidth={2} strokeLinecap="round" />
  if (kind === 'fork' || kind === 'join')
    return <rect x={3} y={14} width={26} height={4} rx={1} fill={STROKE} />
  if (kind === 'composite' || kind === 'submachine')
    return (
      <>
        <rect x={3} y={7} width={26} height={18} rx={5} fill={FILL} stroke={STROKE} strokeWidth={SW} />
        <line x1={3} y1={13} x2={29} y2={13} stroke={STROKE} strokeWidth={SW} />
        {kind === 'composite' && (
          <rect x={8} y={16} width={16} height={6} rx={2} fill="none" stroke={ACCENT} strokeWidth={SW} />
        )}
      </>
    )
  return (
    <>
      <rect x={4} y={9} width={24} height={14} rx={6} fill={FILL} stroke={STROKE} strokeWidth={SW} />
      <line x1={10} y1={16} x2={22} y2={16} stroke={ACCENT} strokeWidth={SW} />
    </>
  )
}

// ─── activity ────────────────────────────────────────────────────────────────

function activityGlyph(kind: string) {
  switch (kind) {
    case 'start':
      return (
        <rect x={4} y={11} width={24} height={10} rx={5} fill="#ECFDF5" stroke="#059669" strokeWidth={SW} />
      )
    case 'end':
      return (
        <rect x={4} y={11} width={24} height={10} rx={5} fill="#FEF2F2" stroke="#DC2626" strokeWidth={SW} />
      )
    case 'decision':
    case 'merge':
      return <polygon points="16,6 28,16 16,26 4,16" fill={FILL} stroke={STROKE} strokeWidth={SW} />
    case 'fork':
    case 'join':
      return <rect x={4} y={14} width={24} height={4} rx={1} fill={STROKE} />
    case 'data':
    case 'document':
    case 'manual-input':
    case 'manual-operation':
    case 'delay':
    case 'preparation':
    case 'stored-data':
    case 'database':
    case 'off-page':
    case 'display':
    case 'tape':
    case 'extract':
    case 'loop-limit':
    case 'send-signal':
    case 'receive-signal':
    case 'time-event':
      // Drawn from the same path builders the canvas uses, so the palette icon
      // can never drift from the shape it spawns.
      return (
        <path
          d={hasOutlinePath(kind) ? OUTLINE_PATHS[kind](30, 22) : ''}
          transform="translate(1 5)"
          fill={FILL}
          stroke={STROKE}
          strokeWidth={SW}
        />
      )
    case 'or':
      return (
        <>
          <circle cx={16} cy={16} r={9} fill={FILL} stroke={STROKE} strokeWidth={SW} />
          <path d="M16 7 V25 M7 16 H25" stroke={STROKE} strokeWidth={SW} />
        </>
      )
    case 'summing-junction':
      return (
        <>
          <circle cx={16} cy={16} r={9} fill={FILL} stroke={STROKE} strokeWidth={SW} />
          <path d="M10 10 L22 22 M22 10 L10 22" stroke={STROKE} strokeWidth={SW} />
        </>
      )
    case 'internal-storage':
      return (
        <>
          <rect x={3} y={9} width={26} height={14} fill={FILL} stroke={STROKE} strokeWidth={SW} />
          <line x1={8} y1={9} x2={8} y2={23} stroke={STROKE} strokeWidth={SW} />
          <line x1={3} y1={13} x2={29} y2={13} stroke={STROKE} strokeWidth={SW} />
        </>
      )
    case 'multi-document':
      return (
        <>
          <path d="M9 6 H29 V19 Q22 23 16 19 Q11 16 9 19 Z" fill={FILL} stroke={STROKE} strokeWidth={SW} />
          <path d="M5 9 H25 V22 Q18 26 12 22 Q7 19 5 22 Z" fill={FILL} stroke={STROKE} strokeWidth={SW} />
        </>
      )
    case 'object-node':
      return <rect x={3} y={11} width={26} height={11} fill={FILL} stroke={STROKE} strokeWidth={SW} />
    case 'final-flow':
      return (
        <>
          <circle cx={16} cy={16} r={9} fill={FILL} stroke={STROKE} strokeWidth={SW} />
          <path d="M10 10 L22 22 M22 10 L10 22" stroke={STROKE} strokeWidth={1.6} />
        </>
      )
    case 'document':
      // Rectangle with a wavy base
      return (
        <path
          d="M4 8 H28 V22 Q22 26 16 22 Q10 18 4 22 Z"
          fill={FILL}
          stroke={STROKE}
          strokeWidth={SW}
        />
      )
    case 'predefined':
      // Subroutine — double side bars
      return (
        <>
          <rect x={3} y={10} width={26} height={12} fill={FILL} stroke={STROKE} strokeWidth={SW} />
          <line x1={7} y1={10} x2={7} y2={22} stroke={STROKE} strokeWidth={SW} />
          <line x1={25} y1={10} x2={25} y2={22} stroke={STROKE} strokeWidth={SW} />
        </>
      )
    case 'connector':
      return <circle cx={16} cy={16} r={7} fill={FILL} stroke={STROKE} strokeWidth={SW} />
    default:
      return (
        <>
          <rect x={4} y={10} width={24} height={12} rx={2} fill={FILL} stroke={STROKE} strokeWidth={SW} />
          <line x1={9} y1={16} x2={23} y2={16} stroke={ACCENT} strokeWidth={SW} />
        </>
      )
  }
}

function swimlaneGlyph() {
  return (
    <>
      <rect x={3} y={8} width={26} height={16} fill="none" stroke={STROKE} strokeWidth={SW} />
      <rect x={3} y={8} width={6} height={16} fill="#E2E8F0" stroke={STROKE} strokeWidth={0.9} />
      <line x1={9} y1={16} x2={29} y2={16} stroke={ACCENT} strokeWidth={SW} strokeDasharray="3 2" />
    </>
  )
}

// ─── internal ────────────────────────────────────────────────────────────────

function moduleGlyph() {
  return (
    <>
      <rect x={5} y={9} width={22} height={14} rx={2} fill={FILL} stroke={STROKE} strokeWidth={SW} />
      <rect x={5} y={9} width={22} height={3} rx={1} fill="#7C3AED" />
      <line x1={10} y1={18} x2={20} y2={18} stroke={ACCENT} strokeWidth={SW} />
      {/* ports */}
      <rect x={2.5} y={14} width={4} height={4} fill="#7C3AED" />
      <rect x={25.5} y={14} width={4} height={4} fill={FILL} stroke="#7C3AED" strokeWidth={SW} />
    </>
  )
}

function noteGlyph() {
  return (
    <path
      d="M5 5 H27 V21 L21 27 H5 Z"
      fill="#FFFBEB"
      stroke="#D97706"
      strokeWidth={SW}
    />
  )
}
