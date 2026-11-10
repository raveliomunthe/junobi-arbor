import type { ReactNode } from 'react'
import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { AuthContext } from './AuthContext'
import type { AuthContextValue } from './AuthContext'
import { WorkspaceContext } from './WorkspaceContext'
import type { WorkspaceContextValue } from './WorkspaceContext'
import type { Workspace } from './workspace'
import LoginPage from '../pages/auth/LoginPage'

const demoUser = { id: 'demo-user', email: 'demo@junobi.local' } as User

const demoWorkspace: Workspace = {
  id: 'demo-workspace',
  name: 'Demo Workspace',
  ownerId: 'demo-user',
  role: 'owner',
  createdAt: '1970-01-01T00:00:00.000Z',
  deletedAt: null,
}

const demoMessage = 'Demo mode: this action is disabled.'

const workspaceValue: WorkspaceContextValue = {
  status: 'ready',
  loadError: null,
  workspaces: [demoWorkspace],
  trashed: [],
  activeWorkspace: demoWorkspace,
  ownedCount: 1,
  canCreate: false,
  busy: false,
  reload: async () => {},
  switchWorkspace: () => {},
  createWorkspace: async () => demoMessage,
  renameWorkspace: async () => demoMessage,
  deleteWorkspace: async () => demoMessage,
  restoreWorkspace: async () => demoMessage,
}

export default function DemoProviders({
  children,
  autoSignIn = false,
  onExit,
}: {
  children: ReactNode
  autoSignIn?: boolean
  onExit?: () => void
}) {
  const [signedIn, setSignedIn] = useState(autoSignIn)
  const authValue: AuthContextValue = {
    session: null,
    user: signedIn ? demoUser : null,
    loading: false,
    signIn: async (email, password) => {
      if (email.toLowerCase() !== 'demo@junobi.local' || password !== 'demo123') {
        return 'Email atau password demo tidak sesuai.'
      }
      setSignedIn(true)
      return null
    },
    signUp: async () => ({ error: demoMessage, needsVerification: false }),
    signOut: async () => {
      setSignedIn(false)
      onExit?.()
      return null
    },
  }

  return (
    <AuthContext.Provider value={authValue}>
      {signedIn ? (
        <WorkspaceContext.Provider value={workspaceValue}>{children}</WorkspaceContext.Provider>
      ) : (
        <LoginPage demo />
      )}
    </AuthContext.Provider>
  )
}
