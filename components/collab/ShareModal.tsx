'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Loader2, Users, X } from 'lucide-react'
import { useUiStore } from '@/store/uiStore'
import { usePresenceStore } from '@/store/presenceStore'
import { checkInvite, remainingSlots } from '@/lib/collab/invites'
import { peerColor, peerInitials, peerName } from '@/lib/collab/identity'
import { MAX_DIAGRAM_COLLABORATORS } from '@/lib/supabase/types'
import type { DiagramShareRow, ShareRole, TeamRow } from '@/lib/supabase/types'

/**
 * Managing who can open a diagram.
 *
 * Two routes, presented as such: name up to three people directly, or point the diagram at a
 * team. The cap is a database trigger, so this shows the remaining count and explains the way
 * past it rather than discovering the limit by failing.
 */
export default function ShareModal({
  diagramId,
  ownerEmail,
  teamId,
}: {
  diagramId: string
  ownerEmail?: string
  teamId?: string | null
}) {
  const setShareModalOpen = useUiStore((s) => s.setShareModalOpen)
  const peers = usePresenceStore((s) => s.peers)

  const [shares, setShares] = useState<DiagramShareRow[]>([])
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ShareRole>('editor')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')

  // Starts true from initial state rather than being set here: setting state synchronously in
  // the mount effect causes a cascading render for no benefit, since the dialog opens loading.
  const load = useCallback(async () => {
    try {
      const [shareRes, teamRes] = await Promise.all([
        fetch(`/api/diagrams/${diagramId}/shares`),
        fetch('/api/teams'),
      ])
      if (shareRes.ok) setShares((await shareRes.json()).shares ?? [])
      if (teamRes.ok) setTeams((await teamRes.json()).teams ?? [])
    } finally {
      setLoading(false)
    }
  }, [diagramId])

  useEffect(() => {
    void load()
  }, [load])

  const invite = useCallback(async () => {
    // Checked locally first so the common mistakes produce a sentence rather than a Postgres
    // error. The trigger remains the actual authority.
    const check = checkInvite({
      email,
      existing: shares.map((s) => s.invited_email),
      ownerEmail,
    })
    if (!check.ok) {
      setError(check.message)
      return
    }

    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/diagrams/${diagramId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: check.email, role }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not send the invite.')
        return
      }
      setShares((current) => [...current, json.share as DiagramShareRow])
      setEmail('')
    } finally {
      setBusy(false)
    }
  }, [email, shares, ownerEmail, diagramId, role])

  const revoke = useCallback(
    async (shareId: string) => {
      setBusy(true)
      try {
        const res = await fetch(`/api/diagrams/${diagramId}/shares/${shareId}`, {
          method: 'DELETE',
        })
        if (res.ok) setShares((current) => current.filter((s) => s.id !== shareId))
      } finally {
        setBusy(false)
      }
    },
    [diagramId]
  )

  const changeRole = useCallback(
    async (shareId: string, next: ShareRole) => {
      setBusy(true)
      try {
        const res = await fetch(`/api/diagrams/${diagramId}/shares/${shareId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: next }),
        })
        if (res.ok) {
          setShares((current) =>
            current.map((s) => (s.id === shareId ? { ...s, role: next } : s))
          )
        }
      } finally {
        setBusy(false)
      }
    },
    [diagramId]
  )

  const attachTeam = useCallback(
    async (nextTeamId: string | null) => {
      setBusy(true)
      setError(null)
      try {
        const res = await fetch(`/api/diagrams/${diagramId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ team_id: nextTeamId }),
        })
        if (!res.ok) setError('Could not change the team.')
      } finally {
        setBusy(false)
      }
    },
    [diagramId]
  )

  const createTeam = useCallback(async () => {
    const name = newTeamName.trim()
    if (!name) return

    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not create the team.')
        return
      }
      setTeams((current) => [...current, json.team as TeamRow])
      setNewTeamName('')
      // Attaching immediately is almost always the intent — a team created from this dialog
      // exists in order to share this diagram.
      await attachTeam((json.team as TeamRow).id)
    } finally {
      setBusy(false)
    }
  }, [newTeamName, attachTeam])

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy the link.')
    }
  }, [])

  const left = remainingSlots(shares.length)
  const livePeers = Object.values(peers)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Share</h2>
            <p className="text-[11px] text-slate-400">
              {left > 0
                ? `${left} of ${MAX_DIAGRAM_COLLABORATORS} invites left`
                : 'All direct invites used — use a team for more'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShareModalOpen(false)}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto divide-y divide-slate-100">
          {/* Who is here right now */}
          {livePeers.length > 0 && (
            <div className="px-5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                In the diagram now
              </p>
              <div className="flex flex-wrap gap-1.5">
                {livePeers.map((peer) => (
                  <span
                    key={peer.userId}
                    className="flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 text-[11px] font-medium text-white"
                    style={{ background: peer.color }}
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/25 text-[8px]">
                      {peerInitials(peer.name)}
                    </span>
                    {peer.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Invite */}
          <div className="px-5 py-4 space-y-2">
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                placeholder="name@company.com"
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void invite()
                }}
                aria-label="Invite by email"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as ShareRole)}
                aria-label="Role"
                className="rounded-xl border border-slate-200 px-2 py-2 text-xs
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                type="button"
                onClick={() => void invite()}
                disabled={busy || !email.trim()}
                className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white
                  hover:bg-blue-700 disabled:opacity-40"
              >
                Invite
              </button>
            </div>

            {error && <p className="text-[11px] text-red-600">{error}</p>}

            <p className="text-[10px] text-slate-400">
              They do not need an account yet — access starts the moment they sign in with this
              address.
            </p>
          </div>

          {/* Current collaborators */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              People with access
            </p>

            {loading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading
              </div>
            ) : (
              <div className="space-y-1.5">
                {ownerEmail && (
                  <div className="flex items-center gap-2 text-xs">
                    <Avatar label={ownerEmail} />
                    <span className="flex-1 truncate text-slate-700">{ownerEmail}</span>
                    <span className="text-[10px] text-slate-400">Owner</span>
                  </div>
                )}

                {shares.map((share) => (
                  <div key={share.id} className="flex items-center gap-2 text-xs">
                    <Avatar label={share.invited_email} />
                    <span className="flex-1 truncate text-slate-700">{share.invited_email}</span>
                    {/* Pending until they sign in, which is when user_id gets filled in. */}
                    {!share.user_id && (
                      <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-600">
                        pending
                      </span>
                    )}
                    <select
                      value={share.role}
                      onChange={(e) => void changeRole(share.id, e.target.value as ShareRole)}
                      disabled={busy}
                      aria-label={`Role for ${share.invited_email}`}
                      className="shrink-0 rounded-lg border border-slate-200 px-1.5 py-1 text-[10px]"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void revoke(share.id)}
                      disabled={busy}
                      aria-label={`Remove ${share.invited_email}`}
                      className="shrink-0 text-slate-300 hover:text-red-500 disabled:opacity-40"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {shares.length === 0 && (
                  <p className="text-[11px] text-slate-400">Nobody else yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Team */}
          <div className="px-5 py-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <Users className="mr-1 inline h-3 w-3" />
              Team access
            </p>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Point this diagram at a team and every member gets in — no per-person limit.
            </p>

            <select
              value={teamId ?? ''}
              onChange={(e) => void attachTeam(e.target.value || null)}
              disabled={busy}
              aria-label="Team"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <input
                type="text"
                value={newTeamName}
                placeholder="New team name"
                onChange={(e) => setNewTeamName(e.target.value)}
                aria-label="New team name"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => void createTeam()}
                disabled={busy || !newTeamName.trim()}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium
                  text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={() => void copyLink()}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
          {/* The link is not a grant — someone without access still cannot open it. */}
          <p className="text-[10px] text-slate-400">Link works for people invited above</p>
        </div>
      </div>
    </div>
  )
}

function Avatar({ label }: { label: string }) {
  const name = peerName({ email: label })
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white"
      style={{ background: peerColor(label) }}
    >
      {peerInitials(name)}
    </span>
  )
}
