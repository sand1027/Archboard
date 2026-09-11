import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Logged in → go to dashboard
  if (user) {
    redirect('/dashboard')
  }

  // Not logged in → go to auth
  redirect('/auth')
}
