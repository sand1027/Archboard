import type { Node, Edge } from '@xyflow/react'
import type {
  ArchitectureNodeData,
  ArchitectureEdgeData,
  FrameNodeData,
  ShapeNodeData,
  Viewport,
  DiagramMetadata,
} from './architecture'
import type {
  UmlClassNodeData,
  UmlEntityNodeData,
  UmlLifelineNodeData,
  IconNodeData,
} from './lld'

export type ArchitectureNode =
  | Node<ArchitectureNodeData, 'architecture'>
  | Node<FrameNodeData, 'frame'>
  | Node<ShapeNodeData, 'shape'>
  | Node<UmlClassNodeData, 'umlClass'>
  | Node<UmlEntityNodeData, 'umlEntity'>
  | Node<UmlLifelineNodeData, 'umlLifeline'>
  | Node<IconNodeData, 'icon'>

export type ArchitectureEdge = Edge<ArchitectureEdgeData>

export interface Diagram {
  id: string
  name: string
  version: number
  nodes: ArchitectureNode[]
  edges: ArchitectureEdge[]
  viewport: Viewport
  metadata: DiagramMetadata
}

export interface DiagramSnapshot {
  nodes: ArchitectureNode[]
  edges: ArchitectureEdge[]
}

/** Canonical declaration lives in types/lld — re-exported here for consumers. */
export type { BoardMode } from './lld'

export interface BoardSnapshot {
  diagramId: string
  diagramName: string
  nodes: ArchitectureNode[]
  edges: ArchitectureEdge[]
  viewport: Viewport
}
