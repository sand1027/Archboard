import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { describeShareError, isValidEmail, normaliseEmail } from '@/lib/collab/invites'
import type { DiagramShareRow, ShareRole } from '@/lib/supabase/types'

/**
 * Who a diagram is shared with.
 *
 * Access is left to RLS throughout: `diagram_shares_select` admits anyone who can view the
 * diagram, and `diagram_shares_write` restricts changes to its owner. Re-checking ownership
 * here would duplicate a rule that already exists in one place — and the duplicate is the one
 * that would drift.
 */

// GET /api/diagrams/[id]/shares
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('diagram_shares')
    .select('*')
    .eq('diagram_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ shares: (data ?? []) as DiagramShareRow[] })
}

// POST /api/diagrams/[id]/shares — invite by email
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? normaliseEmail(body.email) : ''
  const role: ShareRole = body?.role === 'viewer' ? 'viewer' : 'editor'

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'That does not look like an email address.' }, { status: 400 })
  }

  // `user_id` is left null deliberately. Resolving an email to an account would need admin
  // privileges, and the policies match a pending invite on the JWT email instead — so the
  // share starts working the moment that person signs in, with no accept step to get stuck in.
  const { data, error } = await supabase
    .from('diagram_shares')
    .insert({ diagram_id: id, invited_email: email, role, invited_by: user.id })
    .select()
    .single()

  if (error) {
    // The 3-collaborator cap is a trigger, so it arrives here as an exception rather than a
    // validation result. Translate it instead of leaking the Postgres message.
    return NextResponse.json({ error: describeShareError(error.message) }, { status: 400 })
  }

  return NextResponse.json({ share: data as DiagramShareRow }, { status: 201 })
}
