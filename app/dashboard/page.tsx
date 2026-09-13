import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/dashboard/DashboardClient'

export const metadata = { title: 'Dashboard — ArchBoard' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  // Attach any invites addressed to this email to the account now that it exists. Access
  // already worked without this — the policies also match on the JWT email — but resolving it
  // means the owner's share list stops showing them as pending.
  await supabase.rpc('claim_pending_shares')

  // No user_id filter: RLS returns everything this person can open, which is what makes a
  // shared diagram findable. Filtering by owner here is why an invited user saw an empty
  // dashboard even though their access was working.
  const { data: diagrams } = await supabase
    .from('diagrams')
    .select('id, name, thumbnail_url, created_at, updated_at, user_id')
    .order('updated_at', { ascending: false })

  return (
    <DashboardClient
      initialDiagrams={diagrams ?? []}
      user={{ id: user.id, email: user.email ?? '' }}
    />
  )
}
