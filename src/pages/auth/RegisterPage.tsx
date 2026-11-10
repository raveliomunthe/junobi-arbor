import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../auth/useAuth'
import AuthLayout from './AuthLayout'

export default function RegisterPage({ onShowLogin }: { onShowLogin: () => void }) {
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    const trimmedEmail = email.trim()
    const result = await signUp(trimmedEmail, password)
    setSubmitting(false)

    if (result.error) {
      setError(result.error)
    } else if (result.needsVerification) {
      setVerificationEmail(trimmedEmail)
    }
  }

  if (verificationEmail) {
    return (
      <AuthLayout title="Verify your email" subtitle="One more step before you can log in">
        <p className="text-center text-sm font-medium text-[#555555]">
          We sent a verification link to <span className="font-bold text-[#2d2d2d]">{verificationEmail}</span>.
          Open it to verify your account, then come back to log in.
        </p>
        <button
          type="button"
          onClick={onShowLogin}
          className="mt-5 w-full rounded-full bg-[#2d2d2d] px-4 py-2.5 text-xs font-bold text-[#F5F5F5]"
        >
          Back to Login
        </button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Register" subtitle="Create your Junobi Arbor account">
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
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
            className="mt-1.5 w-full rounded-xl bg-white/50 px-3 py-2.5 text-sm font-medium"
          />
        </label>
        <label className="block text-xs font-bold">Confirm password
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat password"
            className="mt-1.5 w-full rounded-xl bg-white/50 px-3 py-2.5 text-sm font-medium"
          />
        </label>
        {error && <p role="alert" className="text-xs font-bold text-[#b3261e]">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-[#2d2d2d] px-4 py-2.5 text-xs font-bold text-[#F5F5F5] disabled:opacity-50"
        >
          {submitting ? 'Creating account...' : 'Register'}
        </button>
      </form>
      <p className="mt-4 text-center text-xs font-medium text-[#555555]">
        Already have an account?{' '}
        <button type="button" onClick={onShowLogin} className="font-bold text-[#2d2d2d] underline">
          Login
        </button>
      </p>
    </AuthLayout>
  )
}
