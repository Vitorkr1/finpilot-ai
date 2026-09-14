import { useEffect, useState, type FormEvent } from 'react'
import { AppLayout } from '../components/AppLayout'
import { api } from '../lib/api'
import type { Role, User } from '../lib/types'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  financeiro: 'Financeiro',
  tecnico: 'Técnico',
}

export function CompanyUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createdInfo, setCreatedInfo] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'tecnico' as Role,
  })
  const [submitting, setSubmitting] = useState(false)

  async function loadUsers() {
    setLoading(true)
    try {
      const { data } = await api.get<User[]>('/company-users')
      setUsers(data)
    } catch {
      setError('Não foi possível carregar os usuários.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setCreatedInfo(null)
    try {
      const { data } = await api.post('/company-users', form)
      setCreatedInfo(
        `Usuário criado: ${data.user.email} · senha temporária: ${data.tempPassword} (copie agora, só aparece uma vez)`,
      )
      setForm({ name: '', email: '', role: 'tecnico' })
      await loadUsers()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Não foi possível criar o usuário.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(userToToggle: User) {
    await api.patch(`/company-users/${userToToggle._id}/active`, {
      active: !userToToggle.active,
    })
    await loadUsers()
  }

  return (
    <AppLayout>
      <h2 className="mb-1 text-xl font-semibold text-slate-900">
        Usuários da empresa
      </h2>
      <p className="page-description">
        Conecte sua equipe e organize os acessos da sua empresa.
      </p>
      <p className="mb-4 text-sm text-slate-500">
        Crie técnicos (para aparecer na Agenda), financeiro e outros admins.
        Basic permite até 3 usuários ativos, Pro até 30.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mb-8 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4"
      >
        <label className="form-field">
          <span>Nome</span>
          <input
            aria-label="Nome"
            placeholder="Nome"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="form-field">
          <span>E-mail</span>
          <input
            aria-label="E-mail"
            placeholder="E-mail"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="tecnico">Técnico</option>
          <option value="financeiro">Financeiro</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {submitting ? 'Criando...' : 'Adicionar usuário'}
        </button>
        {createdInfo && (
          <p className="sm:col-span-4 text-sm text-green-700">{createdInfo}</p>
        )}
        {error && <p className="sm:col-span-4 text-sm text-red-600">{error}</p>}
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum usuário ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">E-mail</th>
                <th className="px-4 py-2">Função</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {u.name}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{u.email}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {ROLE_LABEL[u.role] || u.role}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs font-medium ${u.active ? 'text-green-700' : 'text-slate-400'}`}
                    >
                      {u.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => toggleActive(u)}
                      className="text-brand-600 hover:underline"
                    >
                      {u.active ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  )
}
