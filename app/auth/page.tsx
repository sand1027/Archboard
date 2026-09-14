import Image from 'next/image'
import Link from 'next/link'
import AuthForm from '@/components/auth/AuthForm'

export const metadata = {
  title: 'Sign in — ArchBoard',
}

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="/brand/archboard-logo.png"
            alt="ArchBoard"
            width={160}
            height={36}
            className="h-8 w-auto mx-auto mb-2"
            priority
          />
          <p className="text-sm text-gray-500">System design whiteboard for engineers</p>
        </div>

        <AuthForm />

        {/*
          The way past the wall.

          Requiring an account before anyone can see what the app does costs more than it
          protects — the editor works perfectly well against localStorage, so there is no
          reason a first look should need an email address.
        */}
        <div className="mt-6 text-center">
          <Link
            href="/try"
            className="text-sm text-gray-500 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gray-800"
          >
            Or try it without an account
          </Link>
          <p className="mt-1.5 text-xs text-gray-400">
            Saves in your browser. No sharing or version history.
          </p>
        </div>
      </div>
    </div>
  )
}
