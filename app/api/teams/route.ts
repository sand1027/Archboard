import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TeamRow } from '@/lib/supabase/types'

/**
 * Teams — the way past the 3-collaborator cap on a single diagram.
 *
 * A diagram points at one team, and every member of that team gets access. Teams are uncapped
 * on purpose: needing more than a handful of named people is precisely when a team is the right
 * shape, and repeating the cap here would just move the wall.
 */

// GET /api/teams — teams the user owns or belongs to
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // No owner filter: `teams_select` already admits owners and members, and filtering here
  // would hide the teams someone was invited to.
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ teams: (data ?? []) as TeamRow[] })
}

// POST /api/teams — create one
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (name.length < 1 || name.length > 80) {
    return NextResponse.json({ error: 'Team name must be 1–80 characters.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('teams')
    .insert({ name, owner_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // The owner is a member too, otherwise `can_edit_diagram` would not admit them through the
  // team path and they would lose access to a diagram they moved into their own team.
  const { error: memberError } = await supabase
    .from('team_members')
    .insert({ team_id: (data as TeamRow).id, user_id: user.id, role: 'admin' })

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 400 })
  }

  return NextResponse.json({ team: data as TeamRow }, { status: 201 })
}
