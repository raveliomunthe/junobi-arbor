import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../auth/useAuth'
import AuthLayout from './AuthLayout'

export default function LoginPage({ onShowRegister, demo = false }: { onShowRegister?: () => void; demo?: boolean }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const message = await signIn(email.trim(), password)
    if (message) {
      setError(message)
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Login" subtitle="Welcome back to Junobi Arbor">
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-xs font-bold">Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="mt-1.5 w-full rounded-xl bg-white/50 px-3 py-2.5 text-sm font-medium"
          />
        </label>
        <label className="block text-xs font-bold">Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            className="mt-1.5 w-full rounded-xl bg-white/50 px-3 py-2.5 text-sm font-medium"
          />
        </label>
        {error && <p role="alert" className="text-xs font-bold text-[#b3261e]">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-[#2d2d2d] px-4 py-2.5 text-xs font-bold text-[#F5F5F5] disabled:opacity-50"
        >
          {submitting ? 'Logging in...' : 'Login'}
        </button>
      </form>
      {demo ? (
        <p className="mt-4 text-center text-xs font-medium text-[#555555]">
          Demo account: demo@junobi.local<br />Password: demo123
        </p>
      ) : (
        <p className="mt-4 text-center text-xs font-medium text-[#555555]">
          Don't have an account?{' '}
          <button type="button" onClick={onShowRegister} className="font-bold text-[#2d2d2d] underline">
            Register
          </button>
        </p>
      )}
    </AuthLayout>
  )
}
