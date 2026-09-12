import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useSuperAdminAuth } from '../context/SuperAdminAuthContext'

export function SuperAdminProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useSuperAdminAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Carregando...</div>
  }

  if (!user) {
    return <Navigate to="login" replace />
  }

  return <>{children}</>
}
