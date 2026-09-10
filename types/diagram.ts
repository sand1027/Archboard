import type { Node, Edge } from '@xyflow/react'
import type {
  ArchitectureNodeData,
  ArchitectureEdgeData,
  FrameNodeData,
  ShapeNodeData,
  Viewport,
  DiagramMetadata,
} from './architecture'

export type ArchitectureNode =
  | Node<ArchitectureNodeData, 'architecture'>
  | Node<FrameNodeData, 'frame'>
  | Node<ShapeNodeData, 'shape'>

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
