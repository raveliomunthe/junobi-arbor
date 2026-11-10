import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type SignUpResult = {
  error: string | null
  needsVerification: boolean
}

export type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<SignUpResult>
  signOut: () => Promise<string | null>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
