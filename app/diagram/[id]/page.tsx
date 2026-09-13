import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DiagramEditor from '@/components/sync/DiagramEditor'
import type { DiagramRow } from '@/lib/supabase/types'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('diagrams').select('name').eq('id', id).single()
  const row = data as Pick<DiagramRow, 'name'> | null
  return { title: row?.name ? `${row.name} — ArchBoard` : 'ArchBoard' }
}

export default async function DiagramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Access is RLS's decision — it admits the owner, invited collaborators and team members.
  // Filtering on user_id here turned a valid share into a 404, which is what an invited user
  // hit when they opened the link they were given.
  const { data, error } = await supabase
    .from('diagrams')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) notFound()

  const diagram = data as DiagramRow

  return (
    <DiagramEditor
      diagramId={id}
      initialData={diagram.data}
      initialName={diagram.name}
      userId={user.id}
      userEmail={user.email ?? ''}
      teamId={diagram.team_id}
    />
  )
}
