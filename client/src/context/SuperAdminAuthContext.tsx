import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { adminApi as api, setAdminAccessToken as setAccessToken } from '../lib/api'
import type { User } from '../lib/types'

// Contexto de autenticação separado do AuthContext dos tenants — login
// próprio do super admin (Seção 6 do spec: "completamente separado do login
// dos tenants", nunca só uma URL escondida). Usa /auth/admin-login e
// /auth/admin-refresh, com cookie de sessão próprio, para nunca colidir com
// a sessão de um tenant aberta no mesmo navegador.
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
  const epoch = useRef(0)

  useEffect(() => {
    let active = true
    const started = epoch.current
    ;(async () => {
      try {
        const { data } = await api.post('/auth/admin-refresh')
        if (!active || epoch.current !== started) return
        setAccessToken(data.accessToken)
        setUser(data.user)
      } catch {
        if (active && epoch.current === started) setAccessToken(null)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    const ended = () => { epoch.current++; setUser(null) }
    window.addEventListener('criaos:admin-session-ended', ended)
    return () => window.removeEventListener('criaos:admin-session-ended', ended)
  }, [])

  async function login(email: string, password: string) {
    epoch.current++
    const { data } = await api.post('/auth/admin-login', { email, password })
    setAccessToken(data.accessToken)
    setUser(data.user)
  }

  async function logout() {
    epoch.current++
    await api.post('/auth/admin-logout')
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
