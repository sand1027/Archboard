import Image from 'next/image'
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
      </div>
    </div>
  )
}
