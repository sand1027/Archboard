'use client'

import Link from 'next/link'
import { HardDrive } from 'lucide-react'

/**
 * The strip shown when a diagram has no account behind it.
 *
 * Guest mode saves to this browser and nowhere else, which is a genuinely useful way to try
 * the app but a bad thing to discover later. Sharing, version history and collaboration are
 * all unavailable, and clearing site data loses the work — so it says so, and stays on screen
 * rather than being dismissible.
 */
export default function LocalModeBanner() {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[11px] text-amber-900">
      <HardDrive className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      <p className="min-w-0">
        <span className="font-semibold">Guest mode.</span> Click Save to keep this diagram in
        this browser — clearing site data will lose it, and sharing and version history need an
        account.
      </p>
      <Link
        href="/auth"
        className="ml-auto shrink-0 rounded-md bg-amber-900 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-amber-800"
      >
        Sign in to save
      </Link>
    </div>
  )
}
