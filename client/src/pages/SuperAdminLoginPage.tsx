import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSuperAdminAuth } from '../context/SuperAdminAuthContext'
import { DarkFooter } from '../components/DarkFooter'
import { SUPER_ADMIN_PATH } from '../lib/superAdminPath'

export function SuperAdminLoginPage() {
  const { login } = useSuperAdminAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(SUPER_ADMIN_PATH, { replace: true })
    } catch {
      setError('Credenciais inválidas.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-surface flex min-h-screen flex-col bg-slate-950 px-4">
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-sm">
          <h1 className="mb-1 text-lg font-semibold text-slate-100">
            CriaTech · Painel Admin
          </h1>
          <p className="mb-6 text-sm text-slate-400">
            Acesso restrito à equipe CriaTech
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-email"
                className="mb-1 block text-sm font-medium text-slate-300"
              >
                E-mail
              </label>
              <input
                id="admin-email"
                autoComplete="username"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Senha
              </label>
              <input
                id="admin-password"
                autoComplete="current-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-white disabled:opacity-60"
            >
              {submitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
      <DarkFooter />
    </div>
  )
}
