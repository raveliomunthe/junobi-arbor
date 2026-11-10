import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from './AuthContext'
import type { AuthContextValue } from './AuthContext'
import { getAuthErrorMessage } from './authErrors'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session)
      })
      .catch(() => {
        if (active) setSession(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return error ? getAuthErrorMessage(error) : null
    } catch (error) {
      return getAuthErrorMessage(error as Error)
    }
  }, [])

  const signUp = useCallback<AuthContextValue['signUp']>(async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) return { error: getAuthErrorMessage(error), needsVerification: false }

      // With email confirmation on, Supabase hides duplicates by returning a user with no identities.
      if (data.user && data.user.identities?.length === 0) {
        return {
          error: 'An account with this email already exists. Try logging in instead.',
          needsVerification: false,
        }
      }

      return { error: null, needsVerification: !data.session }
    } catch (error) {
      return { error: getAuthErrorMessage(error as Error), needsVerification: false }
    }
  }, [])

  const signOut = useCallback<AuthContextValue['signOut']>(async () => {
    try {
      const { error } = await supabase.auth.signOut()
      return error ? getAuthErrorMessage(error) : null
    } catch (error) {
      return getAuthErrorMessage(error as Error)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, loading, signIn, signUp, signOut }),
    [session, loading, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
