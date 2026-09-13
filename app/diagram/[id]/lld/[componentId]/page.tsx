import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft, TriangleAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { migrateDocument } from '@/lib/persistence/documentPayload'
import LldWorkspaceShell from '@/components/lld/LldWorkspaceShell'
import type { DiagramRow } from '@/lib/supabase/types'
import type { ArchitectureEdge, ArchitectureNode } from '@/types/diagram'

type Params = Promise<{ id: string; componentId: string }>

// No middleware change needed for this route — lib/supabase/proxy.ts already
// gates every path starting with /diagram.

interface WorkspaceContext {
  diagramName: string
  component: ArchitectureNode
  hldNodes: ArchitectureNode[]
  hldEdges: ArchitectureEdge[]
}

/** Distinguishes "no such diagram" from "diagram exists, component doesn't". */
type LoadResult =
  | { ok: true; context: WorkspaceContext }
  | { ok: false; reason: 'no-diagram' }
  | { ok: false; reason: 'no-component'; diagramName: string; componentCount: number }

export async function generateMetadata({ params }: { params: Params }) {
  const { id, componentId } = await params
  const result = await loadWorkspaceContext(id, componentId)

  if (!result.ok) return { title: 'LLD — ArchBoard' }
  return {
    title: `${label(result.context.component)} · LLD — ${result.context.diagramName} — ArchBoard`,
  }
}

export default async function LldWorkspacePage({ params }: { params: Params }) {
  const { id, componentId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const result = await loadWorkspaceContext(id, componentId)

  // A missing diagram row is a genuine 404.
  if (!result.ok && result.reason === 'no-diagram') notFound()

  // A missing component is recoverable and worth explaining — a bare 404 here
  // hides the cause, which is usually a link built from the wrong id.
  if (!result.ok) {
    return (
      <ComponentNotFound
        diagramId={id}
        componentId={componentId}
        diagramName={result.diagramName}
        componentCount={result.componentCount}
      />
    )
  }

  const { context } = result

  return (
    <LldWorkspaceShell
      diagramId={id}
      diagramName={context.diagramName}
      componentId={componentId}
      title={label(context.component)}
      component={context.component}
      hldNodes={context.hldNodes}
      hldEdges={context.hldEdges}
    />
  )
}

async function loadWorkspaceContext(
  diagramId: string,
  componentId: string
): Promise<LoadResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'no-diagram' }

  const { data, error } = await supabase
    .from('diagrams')
    .select('*')
    .eq('id', diagramId)
    // RLS decides; a collaborator opening a component's LLD is legitimate.
    .single()

  if (error || !data) return { ok: false, reason: 'no-diagram' }

  const row = data as DiagramRow
  const doc = migrateDocument(row.data)
  const hldNodes = (doc?.boards.hld.nodes ?? []) as ArchitectureNode[]
  const hldEdges = doc?.boards.hld.edges ?? []

  const component = hldNodes.find((n) => n.id === componentId)
  if (!component || component.type !== 'architecture') {
    return {
      ok: false,
      reason: 'no-component',
      diagramName: row.name,
      componentCount: hldNodes.filter((n) => n.type === 'architecture').length,
    }
  }

  return {
    ok: true,
    context: { diagramName: row.name, component, hldNodes, hldEdges },
  }
}

function ComponentNotFound({
  diagramId,
  componentId,
  diagramName,
  componentCount,
}: {
  diagramId: string
  componentId: string
  diagramName: string
  componentCount: number
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <TriangleAlert className="h-4.5 w-4.5" />
        </span>

        <h1 className="text-base font-semibold text-slate-900">Component not on this canvas</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          “{diagramName}” has {componentCount} component
          {componentCount === 1 ? '' : 's'}, but none with the id in this URL. It was probably
          deleted, or the link was built before the canvas was saved.
        </p>

        <p className="mt-3 break-all rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-500">
          {componentId}
        </p>

        <Link
          href={`/diagram/${diagramId}`}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to {diagramName}
        </Link>
      </div>
    </main>
  )
}

function label(node: ArchitectureNode): string {
  const value = (node.data as Record<string, unknown>).label
  return typeof value === 'string' && value ? value : 'Component'
}
