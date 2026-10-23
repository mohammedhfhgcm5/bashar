import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, refreshSession, setAccessToken, type SessionUser } from './api'

type AuthContextValue = {
  user: SessionUser | null
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: {
    fullName: string
    email: string
    phone: string
    password: string
    role: 'CITIZEN' | 'RESIDENT'
  }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    refreshSession()
      .then((session) => setUser(session?.user ?? null))
      .finally(() => setReady(true))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      async login(email, password) {
        const result = await api<{ accessToken: string; user: SessionUser }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
        setAccessToken(result.accessToken)
        setUser(result.user)
      },
      async register(input) {
        const result = await api<{ accessToken: string; user: SessionUser }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(input),
        })
        setAccessToken(result.accessToken)
        setUser(result.user)
      },
      async logout() {
        await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
        setAccessToken(null)
        setUser(null)
      },
    }),
    [user, ready],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider missing')
  return value
}
