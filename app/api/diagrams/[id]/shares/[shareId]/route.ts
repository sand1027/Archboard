import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { describeShareError } from '@/lib/collab/invites'
import type { DiagramShareRow, ShareRole } from '@/lib/supabase/types'

/**
 * Changing or revoking one person's access.
 *
 * Both operations are scoped by `diagram_id` as well as the share id. The id alone would be
 * enough for the database, but including it means a mismatched pair cannot silently act on a
 * share belonging to a different diagram.
 */

// PATCH /api/diagrams/[id]/shares/[shareId] — change role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> }
) {
  const { id, shareId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (body?.role !== 'viewer' && body?.role !== 'editor') {
    return NextResponse.json({ error: 'Role must be viewer or editor.' }, { status: 400 })
  }
  const role: ShareRole = body.role

  const { data, error } = await supabase
    .from('diagram_shares')
    .update({ role })
    .eq('id', shareId)
    .eq('diagram_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: describeShareError(error.message) }, { status: 400 })
  return NextResponse.json({ share: data as DiagramShareRow })
}

// DELETE /api/diagrams/[id]/shares/[shareId] — revoke
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> }
) {
  const { id, shareId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('diagram_shares')
    .delete()
    .eq('id', shareId)
    .eq('diagram_id', id)

  if (error) return NextResponse.json({ error: describeShareError(error.message) }, { status: 400 })
  return NextResponse.json({ success: true })
}
