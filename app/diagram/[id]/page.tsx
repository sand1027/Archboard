import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DiagramEditor from '@/components/sync/DiagramEditor'
import type { DiagramRow } from '@/lib/supabase/types'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await (supabase as any).from('diagrams').select('name').eq('id', id).single()
  const row = data as Pick<DiagramRow, 'name'> | null
  return { title: row?.name ? `${row.name} — ArchBoard` : 'ArchBoard' }
}

export default async function DiagramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data, error } = await (supabase as any)
    .from('diagrams')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !data) notFound()

  const diagram = data as DiagramRow

  return (
    <DiagramEditor
      diagramId={id}
      initialData={diagram.data as any}
      initialName={diagram.name}
      userId={user.id}
      userEmail={user.email ?? ''}
    />
  )
}
