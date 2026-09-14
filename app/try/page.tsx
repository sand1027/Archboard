import WhiteboardApp from '@/components/WhiteboardApp'

export const metadata = {
  title: 'Try ArchBoard',
  description:
    'Design a system architecture in the browser — no account needed. Simulate traffic, size capacity and write diagrams as code.',
}

/**
 * The editor, without an account.
 *
 * Everything behind the auth wall is fine for a product and hostile for a demo: someone
 * following a link to see what this is should not have to hand over an email first. The whole
 * editor already works locally — `WhiteboardApp` with no `diagramId` skips the cloud paths and
 * `useDiagramPersistence` autosaves to localStorage — so this route only has to decline to
 * pass one.
 *
 * Not covered by the middleware matcher's protected list, so it stays reachable when signed
 * out. Signed-in users can use it too; it is simply a scratch board that never leaves the
 * browser.
 */
export default function TryPage() {
  return <WhiteboardApp />
}
