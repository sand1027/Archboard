import type { Metadata } from 'next'
import WhiteboardApp from '@/components/WhiteboardApp'

export const metadata: Metadata = {
  title: 'ArchBoard — System Design Whiteboard',
  description: 'Professional system architecture diagramming tool for engineers',
}

export default function Page() {
  return <WhiteboardApp />
}
