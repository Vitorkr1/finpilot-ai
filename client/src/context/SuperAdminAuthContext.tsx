import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, setAccessToken } from '../lib/api'
import type { User } from '../lib/types'

// Contexto de autenticação separado do AuthContext dos tenants — login
// próprio do super admin (Seção 6 do spec: "completamente separado do login
// dos tenants", nunca só uma URL escondida).
interface SuperAdminAuthValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const SuperAdminAuthContext = createContext<SuperAdminAuthValue | null>(null)

export function SuperAdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await api.post('/auth/refresh')
        setAccessToken(data.accessToken)
        const me = await api.get('/auth/me')
        if (me.data.user.role === 'super_admin') {
          setUser(me.data.user)
        } else {
          setAccessToken(null)
        }
      } catch {
        setAccessToken(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password })
    if (data.user.role !== 'super_admin') {
      setAccessToken(null)
      throw new Error('Esta conta não é de super admin')
    }
    setAccessToken(data.accessToken)
    setUser(data.user)
  }

  async function logout() {
    await api.post('/auth/logout')
    setAccessToken(null)
    setUser(null)
  }

  return (
    <SuperAdminAuthContext.Provider value={{ user, loading, login, logout }}>{children}</SuperAdminAuthContext.Provider>
  )
}

export function useSuperAdminAuth() {
  const ctx = useContext(SuperAdminAuthContext)
  if (!ctx) throw new Error('useSuperAdminAuth deve ser usado dentro de <SuperAdminAuthProvider>')
  return ctx
}
