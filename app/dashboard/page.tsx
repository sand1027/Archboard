import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/dashboard/DashboardClient'

export const metadata = { title: 'Dashboard — ArchBoard' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: diagrams } = await supabase
    .from('diagrams')
    .select('id, name, thumbnail_url, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  return (
    <DashboardClient
      initialDiagrams={diagrams ?? []}
      user={{ id: user.id, email: user.email ?? '' }}
    />
  )
}
