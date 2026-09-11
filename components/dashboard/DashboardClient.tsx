'use client'

import Image from 'next/image'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, LogOut, Trash2, Clock, Search,
  FileText, MoreHorizontal, ExternalLink,
  LayoutGrid, Loader2, Pencil,
} from 'lucide-react'
import type { DiagramRow } from '@/lib/supabase/types'

interface Props {
  initialDiagrams: Pick<DiagramRow, 'id' | 'name' | 'thumbnail_url' | 'created_at' | 'updated_at'>[]
  user: { id: string; email: string }
}

export default function DashboardClient({ initialDiagrams, user }: Props) {
  const [diagrams, setDiagrams] = useState(initialDiagrams)
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  const filtered = diagrams.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleNew = () => {
    startTransition(async () => {
      const res = await fetch('/api/diagrams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled Diagram', data: {} }),
      })
      const { diagram } = await res.json()
      router.push(`/diagram/${diagram.id}`)
    })
  }

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await fetch(`/api/diagrams/${id}`, { method: 'DELETE' })
      setDiagrams((prev) => prev.filter((d) => d.id !== id))
    })
  }

  const handleRename = (id: string, name: string) => {
    setDiagrams((prev) => prev.map((d) => d.id === id ? { ...d, name } : d))
    fetch(`/api/diagrams/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  }

  const handleSignOut = () => {
    startTransition(async () => {
      await supabase.auth.signOut()
      router.push('/auth')
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA]">

      {/* ── Sidebar ── */}
      <div className="fixed inset-y-0 left-0 w-56 bg-white border-r border-gray-100 flex flex-col z-10">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-gray-100">
          <Image
            src="/brand/archboard-nav.png"
            alt="ArchBoard"
            width={130}
            height={28}
            className="h-6 w-auto"
            priority
          />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gray-100 text-gray-900 text-sm font-medium">
            <LayoutGrid className="w-4 h-4 text-gray-500" />
            All diagrams
          </div>
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-gray-100">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {user.email[0].toUpperCase()}
            </div>
            <span className="text-xs text-gray-600 truncate flex-1 min-w-0">{user.email}</span>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors flex-shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="ml-56 min-h-screen flex flex-col">

        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-100 flex items-center gap-4 px-6 sticky top-0 z-10">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search diagrams…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
            />
          </div>

          <div className="ml-auto">
            <button
              onClick={handleNew}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60 shadow-sm"
            >
              {isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Plus className="w-4 h-4" />
              }
              New diagram
            </button>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 px-8 py-8">
          <div className="flex items-baseline gap-3 mb-6">
            <h1 className="text-lg font-semibold text-gray-900">All diagrams</h1>
            <span className="text-sm text-gray-400">{filtered.length}</span>
          </div>

          {filtered.length === 0 ? (
            search ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <Search className="w-8 h-8 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-500">No results for &ldquo;{search}&rdquo;</p>
                <p className="text-xs text-gray-400 mt-1">Try a different name</p>
              </div>
            ) : (
              <EmptyState onNew={handleNew} isPending={isPending} />
            )
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {/* New diagram card */}
              <button
                onClick={handleNew}
                disabled={isPending}
                className="group flex flex-col items-center justify-center gap-2 aspect-[4/3] rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all text-gray-400 hover:text-blue-500 disabled:opacity-50"
              >
                {isPending
                  ? <Loader2 className="w-6 h-6 animate-spin" />
                  : <Plus className="w-6 h-6" />
                }
                <span className="text-xs font-medium">New diagram</span>
              </button>

              {filtered.map((d) => (
                <DiagramCard
                  key={d.id}
                  diagram={d}
                  onOpen={() => router.push(`/diagram/${d.id}`)}
                  onDelete={() => handleDelete(d.id)}
                  onRename={(name) => handleRename(d.id, name)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

// ─── Diagram card ─────────────────────────────────────────────────────────────

function DiagramCard({
  diagram, onOpen, onDelete, onRename,
}: {
  diagram: Pick<DiagramRow, 'id' | 'name' | 'thumbnail_url' | 'updated_at'>
  onOpen: () => void
  onDelete: () => void
  onRename: (name: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [nameValue, setNameValue] = useState(diagram.name)

  const commitRename = () => {
    setRenaming(false)
    if (nameValue.trim() && nameValue !== diagram.name) onRename(nameValue.trim())
    else setNameValue(diagram.name)
  }

  return (
    <div className="group relative flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden hover:border-gray-300 hover:shadow-md transition-all cursor-pointer">

      {/* Thumbnail */}
      <div
        className="aspect-[4/3] bg-slate-50 overflow-hidden border-b border-gray-100"
        onClick={onOpen}
      >
        {diagram.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={diagram.thumbnail_url}
            alt={diagram.name}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-gray-300" />
            </div>
            <span className="text-xs text-gray-300">No preview</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 flex items-center gap-2" onClick={onOpen}>
        <div className="flex-1 min-w-0">
          {renaming ? (
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') { setRenaming(false); setNameValue(diagram.name) }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full text-xs font-medium text-gray-900 bg-transparent border-b border-blue-400 outline-none pb-0.5"
            />
          ) : (
            <p className="text-xs font-medium text-gray-900 truncate">{diagram.name}</p>
          )}
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-gray-300" />
            <span className="text-[10px] text-gray-400">{formatRelative(new Date(diagram.updated_at))}</span>
          </div>
        </div>

        {/* Context menu */}
        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen((p) => !p)}
            className="p-1 rounded-md text-gray-300 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {menuOpen && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 bottom-full mb-1 z-20 bg-white border border-gray-200 rounded-xl shadow-xl py-1 w-40">
                <button
                  onClick={() => { setMenuOpen(false); onOpen() }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                  Open
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setRenaming(true) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-gray-400" />
                  Rename
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={() => { setMenuOpen(false); onDelete() }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onNew, isPending }: { onNew: () => void; isPending: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-5">
        <FileText className="w-9 h-9 text-gray-300" />
      </div>
      <h2 className="text-base font-semibold text-gray-700 mb-1.5">No diagrams yet</h2>
      <p className="text-sm text-gray-400 mb-6 max-w-xs">
        Start designing your first system architecture diagram
      </p>
      <button
        onClick={onNew}
        disabled={isPending}
        className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-60"
      >
        {isPending
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Plus className="w-4 h-4" />
        }
        Create diagram
      </button>
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatRelative(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
