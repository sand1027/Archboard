import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database, DiagramRow } from '@/lib/supabase/types'

type DiagramUpdate = Database['public']['Tables']['diagrams']['Update']

// GET /api/diagrams/[id]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // No user_id filter: access is decided by RLS, which also admits collaborators and team
  // members. Filtering here as well would have excluded exactly the people sharing is for,
  // and it would have done so as a silent 404.
  const { data, error } = await supabase
    .from('diagrams')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ diagram: data as DiagramRow })
}

// PATCH /api/diagrams/[id] — save the current document
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  // Typed rather than Record<string, unknown> so the column names are checked here; a typo
  // would otherwise be accepted and silently write nothing.
  const patch: DiagramUpdate = {}
  if (body.name          !== undefined) patch.name          = body.name
  if (body.data          !== undefined) patch.data          = body.data
  if (body.thumbnail_url !== undefined) patch.thumbnail_url = body.thumbnail_url
  // null detaches the diagram from its team. Membership of the target team is not checked
  // here: the foreign key proves the team exists, and `teams_select` means a user can only
  // ever have learned the id of a team they belong to.
  if (body.team_id       !== undefined) patch.team_id       = body.team_id

  // Editors need to be able to save. The `diagrams_update` policy gates this on
  // can_edit_diagram(), so a viewer's write is refused by the database rather than here.
  const { data, error } = await supabase
    .from('diagrams')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ diagram: data as DiagramRow })
}

// DELETE /api/diagrams/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Owner-only, kept explicit here as well as in the policy: an editor may change a diagram's
  // contents but should not be able to destroy someone else's diagram.
  const { error } = await supabase
    .from('diagrams')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
