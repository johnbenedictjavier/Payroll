import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getLinkedEmployee, getProfile, getRole } from '@/services/api'
import type { Employee, Profile, Role } from '@/types/database'

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  employee: Employee | null
  role: Role | null
  isLoading: boolean
  isConfigured: boolean
  signIn: (employeeNumber: string, password: string) => Promise<Role>
  signOut: () => Promise<void>
  refreshIdentity: () => Promise<void>
  identityError: string | null
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [identityError, setIdentityError] = useState<string | null>(null)

  const loadIdentity = async (nextSession: Session | null): Promise<Role | null> => {
    setSession(nextSession)
    if (!nextSession?.user) {
      setProfile(null)
      setEmployee(null)
      setRole(null)
      setIdentityError(null)
      setIsLoading(false)
      return null
    }
    setIsLoading(true)
    try {
      const [nextProfile, nextRole, nextEmployee] = await Promise.all([
        getProfile(nextSession.user.id),
        getRole(nextSession.user.id),
        getLinkedEmployee(nextSession.user.id),
      ])
      if (!nextRole || (nextRole === 'employee' && !nextEmployee)) {
        throw new Error('Your account is not linked to a valid PMS role. Contact an administrator.')
      }
      setProfile(nextProfile)
      setRole(nextRole)
      setEmployee(nextEmployee)
      setIdentityError(null)
      return nextRole
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load your PMS account.'
      setProfile(null)
      setEmployee(null)
      setRole(null)
      setIdentityError(message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }
      void supabase.auth.getSession().then(async ({ data }) => {
       if (!mounted) return
       try { await loadIdentity(data.session) } catch { /* The login screen handles an unavailable identity. */ }
     }).catch(() => { if (mounted) setIsLoading(false) })
     const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
       void loadIdentity(nextSession).catch(() => undefined)
     })
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    employee,
    role,
    isLoading,
    isConfigured: isSupabaseConfigured,
    signIn: async (employeeNumber, password) => {
      if (!isSupabaseConfigured) throw new Error('PMS is not configured in this environment. Contact the PMS administrator.')
      const { data, error } = await supabase.functions.invoke('employee-login', { body: { employee_number: employeeNumber.trim(), password } })
      if (error) throw new Error('Invalid credentials.')
      if (!data?.session?.access_token || !data?.session?.refresh_token) throw new Error('Unable to complete sign-in.')
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession(data.session)
      if (sessionError) throw new Error('Unable to complete sign-in.')
      try {
        const signedInRole = await loadIdentity(sessionData.session ?? data.session)
        if (!signedInRole) throw new Error('Unable to load your PMS role.')
        return signedInRole
      } catch (error) {
        await supabase.auth.signOut()
        throw new Error(error instanceof Error ? error.message : 'Unable to load your PMS account.')
      }
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw new Error(error.message)
    },
    refreshIdentity: async () => { await loadIdentity(session) },
    identityError,
  }), [session, profile, employee, role, isLoading, identityError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
