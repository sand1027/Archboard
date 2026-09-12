import type { ArchitectureNode } from '@/types/diagram'
import type { LldCatalogItem } from '@/types/lld'
import type { ShapeNodeData } from '@/types/architecture'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function spawnLldNode(
  item: LldCatalogItem,
  position: { x: number; y: number }
): ArchitectureNode {
  const id = generateId()
  const spawn = item.spawn

  if (spawn.kind === 'shape') {
    const w = spawn.w ?? 160
    const h = spawn.h ?? 100
    const data: ShapeNodeData = {
      shapeType: spawn.shapeType as ShapeNodeData['shapeType'],
      label: spawn.defaultLabel ?? '',
      fill: '#ffffff',
      fillOpacity: 1,
      stroke: '#334155',
      strokeWidth: 2,
      strokeStyle: 'solid',
      opacity: 100,
      cornerRadius: spawn.shapeType === 'terminator' ? 999 : 4,
      fontSize: 10,
      textAlign: 'right',
      textColor: '#0f172a',
    }
    return {
      id,
      type: 'shape',
      position: { x: position.x - w / 2, y: position.y - h / 2 },
      data,
      style: { width: w, height: h },
      width: w,
      height: h,
      connectable: true,
      zIndex: 0,
    }
  }

  if (spawn.kind === 'note') {
    const w = 140
    const h = 100
    return {
      id,
      type: 'shape',
      position: { x: position.x - w / 2, y: position.y - h / 2 },
      data: {
        shapeType: 'note',
        label: spawn.label ?? 'Note',
        fill: '#FFFBEB',
        fillOpacity: 1,
        stroke: '#D97706',
        strokeWidth: 1.5,
        strokeStyle: 'solid',
        opacity: 100,
        cornerRadius: 0,
        fontSize: 10,
        textAlign: 'right',
        textColor: '#78350F',
      } satisfies ShapeNodeData,
      style: { width: w, height: h },
      width: w,
      height: h,
      connectable: false,
      zIndex: 5,
    }
  }

  if (spawn.kind === 'umlClass') {
    const w = 200
    const h = 160
    const isEnum = spawn.stereotype === 'enum'
    return {
      id,
      type: 'umlClass',
      position: { x: position.x - w / 2, y: position.y - h / 2 },
      data: {
        name: spawn.name ?? 'ClassName',
        stereotype: spawn.stereotype ?? 'class',
        attributes: isEnum ? ['VALUE_A', 'VALUE_B'] : ['+ id: string'],
        methods: isEnum || spawn.stereotype === 'package' ? [] : ['+ execute(): void'],
        isAbstract: spawn.stereotype === 'abstract',
        fill: '#ffffff',
        stroke: '#334155',
      },
      style: { width: w, height: h },
      width: w,
      height: h,
      connectable: true,
      zIndex: 10,
    }
  }

  if (spawn.kind === 'umlEntity') {
    const w = 180
    const h = 140
    return {
      id,
      type: 'umlEntity',
      position: { x: position.x - w / 2, y: position.y - h / 2 },
      data: {
        name: spawn.name ?? 'Entity',
        weak: spawn.weak,
        attributes: [
          { name: 'id', type: 'uuid', kind: 'pk' },
          { name: 'created_at', type: 'timestamp', kind: 'attr' },
        ],
        fill: '#ffffff',
        stroke: '#334155',
      },
      style: { width: w, height: h },
      width: w,
      height: h,
      connectable: true,
      zIndex: 10,
    }
  }

  if (spawn.kind === 'umlLifeline') {
    const w = 120
    const h = 360
    return {
      id,
      type: 'umlLifeline',
      position: { x: position.x - w / 2, y: position.y },
      data: {
        label: spawn.label ?? 'Object',
        kind: spawn.lifelineKind,
        lifeHeight: 280,
        activations: [{ start: 100, end: 240 }],
        fill: '#ffffff',
        stroke: '#334155',
      },
      style: { width: w, height: h },
      width: w,
      height: h,
      connectable: true,
      zIndex: 10,
    }
  }

  // icon
  const iw = 72
  const ih = 80
  return {
    id,
    type: 'icon',
    position: { x: position.x - iw / 2, y: position.y - ih / 2 },
    data: {
      label: spawn.kind === 'icon' ? spawn.label ?? item.name : item.name,
      iconName: spawn.kind === 'icon' ? spawn.iconName : 'Box',
      color: '#334155',
      fill: '#F8FAFC',
      stroke: '#E2E8F0',
    },
    style: { width: iw, height: ih },
    width: iw,
    height: ih,
    connectable: false,
    zIndex: 10,
  }
}
