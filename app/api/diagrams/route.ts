import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DiagramRow } from '@/lib/supabase/types'

// GET /api/diagrams — list all diagrams
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('diagrams')
    // user_id is selected rather than filtered on, so the caller can tell an owned diagram
    // from a shared one. Filtering would hide everything shared with them.
    .select('id, name, thumbnail_url, created_at, updated_at, user_id')
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ diagrams: data as Partial<DiagramRow>[] })
}

// POST /api/diagrams — create new diagram
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name = 'Untitled Diagram', data = {} } = body

  const { data: diagram, error } = await supabase
    .from('diagrams')
    .insert({ user_id: user.id, name, data })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ diagram: diagram as DiagramRow })
}
