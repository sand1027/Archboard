import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Where to send the user after the code exchange.
 *
 * `new URL(request.url).origin` is the origin the *server* sees. Behind a proxy —
 * which is every managed host, Vercel included — that is the internal origin, often
 * literally `http://localhost:3000` inside the container. Redirecting to it sends
 * someone who just signed in on the deployed site to localhost.
 *
 * Preference order:
 *   1. NEXT_PUBLIC_SITE_URL — explicit, and the only one that cannot be spoofed.
 *   2. The forwarded headers, which carry the origin the browser actually used.
 *   3. The request's own origin, which is correct in local development.
 */
function publicOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')

  // A request through several proxies carries a comma-separated list; the first
  // entry is the one the client used.
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  if (forwardedHost) {
    const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? 'https'
    return `${proto}://${forwardedHost}`
  }

  return new URL(request.url).origin
}

/**
 * Constrain the post-login destination to a path on this site.
 *
 * `next` arrives from the query string, so without this an attacker could craft a
 * sign-in link that lands the user somewhere else. A leading `//` is rejected as well
 * as an absolute URL, since browsers read `//host` as protocol-relative.
 */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dashboard'
  return raw
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))
  const origin = publicOrigin(request)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=callback`)
}
