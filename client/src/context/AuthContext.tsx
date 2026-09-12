import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, setAccessToken } from '../lib/api'
import type { Company, User } from '../lib/types'

interface AuthContextValue {
  user: User | null
  company: Company | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await api.post('/auth/refresh')
        setAccessToken(data.accessToken)
        const me = await api.get('/auth/me')
        setUser(me.data.user)
        setCompany(me.data.company)
      } catch {
        setAccessToken(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password })
    setAccessToken(data.accessToken)
    setUser(data.user)
    setCompany(data.company)
  }

  async function logout() {
    await api.post('/auth/logout')
    setAccessToken(null)
    setUser(null)
    setCompany(null)
  }

  return (
    <AuthContext.Provider value={{ user, company, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
