import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'
import AuthLayout from '../pages/auth/AuthLayout'
import LoginPage from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'
import WorkspaceOnboardingPage from '../pages/auth/WorkspaceOnboardingPage'
import { useAuth } from './useAuth'
import { useWorkspace } from './useWorkspace'
import { WorkspaceProvider } from './WorkspaceProvider'

function LoadingScreen({ message }: { message: string }) {
  return (
    <AuthLayout title="Junobi Arbor">
      <p role="status" className="text-center text-sm font-medium text-[#555555]">{message}</p>
    </AuthLayout>
  )
}

function WorkspaceRouter({ children }: { children: ReactNode }) {
  const { signOut } = useAuth()
  const { status, loadError, reload, activeWorkspace } = useWorkspace()

  if (status === 'loading') return <LoadingScreen message="Checking your workspace..." />

  if (status === 'error') {
    return (
      <AuthLayout title="Something went wrong" subtitle="We couldn't load your workspaces">
        <p role="alert" className="text-center text-sm font-bold text-[#b3261e]">{loadError}</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="mt-5 w-full rounded-full bg-[#2d2d2d] px-4 py-2.5 text-xs font-bold text-[#F5F5F5]"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-2 w-full rounded-full bg-[#2d2d2d]/10 px-4 py-2.5 text-xs font-bold text-[#555555]"
        >
          Log out
        </button>
      </AuthLayout>
    )
  }

  if (!activeWorkspace) return <WorkspaceOnboardingPage />

  // Keyed by workspace so switching remounts the app and no per-workspace state carries over.
  return <Fragment key={activeWorkspace.id}>{children}</Fragment>
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [view, setView] = useState<'login' | 'register'>('login')

  if (loading) return <LoadingScreen message="Loading..." />

  if (!user) {
    return view === 'login' ? (
      <LoginPage onShowRegister={() => setView('register')} />
    ) : (
      <RegisterPage onShowLogin={() => setView('login')} />
    )
  }

  return (
    <WorkspaceProvider key={user.id} userId={user.id}>
      <WorkspaceRouter>{children}</WorkspaceRouter>
    </WorkspaceProvider>
  )
}
