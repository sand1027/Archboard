import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DiagramVersionRow } from '@/lib/supabase/types'

// GET — list versions (summary)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('diagram_versions')
    .select('id, version, name, thumbnail_url, created_at')
    .eq('diagram_id', id)
    // user_id on a version is whoever saved it, not who may read it. Filtering by it showed
    // only your own versions and hid the rest of the diagram's history.
    .order('version', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ versions: data as Partial<DiagramVersionRow>[] })
}

// POST — save a named version snapshot
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, data, thumbnail_url } = body

  // Get current max version
  const { data: existing } = await supabase
    .from('diagram_versions')
    .select('version')
    .eq('diagram_id', id)
    .order('version', { ascending: false })
    .limit(1)

  const nextVersion = ((existing as any[])?.[0]?.version ?? 0) + 1

  const { data: version, error } = await supabase
    .from('diagram_versions')
    .insert({
      diagram_id: id,
      user_id: user.id,
      version: nextVersion,
      name,
      data,
      thumbnail_url,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ version: version as DiagramVersionRow })
}

// PUT — fetch full version data for restore (?version_id=...)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const vid = searchParams.get('version_id')
  if (!vid) return NextResponse.json({ error: 'version_id required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('diagram_versions')
    .select('*')
    .eq('id', vid)
    .eq('diagram_id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ version: data as DiagramVersionRow })
}
