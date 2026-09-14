import { useEffect, useState, type FormEvent } from 'react'
import { useSuperAdminAuth } from '../context/SuperAdminAuthContext'
import { api } from '../lib/api'
import { DarkFooter } from '../components/DarkFooter'
import type { Company, Plan } from '../lib/types'

const STATUS_BADGE: Record<Company['subscriptionStatus'], string> = {
  active: 'bg-green-100 text-green-800',
  overdue: 'bg-amber-100 text-amber-800',
  suspended: 'bg-red-100 text-red-800',
}

const STATUS_LABEL: Record<Company['subscriptionStatus'], string> = {
  active: 'Em dia',
  overdue: 'Atrasado',
  suspended: 'Suspenso',
}

export function SuperAdminDashboardPage() {
  const { user, logout } = useSuperAdminAuth()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    cnpj: '',
    plan: 'basic' as Plan,
  })
  const [submitting, setSubmitting] = useState(false)
  const [createdInfo, setCreatedInfo] = useState<string | null>(null)

  async function loadCompanies() {
    setLoading(true)
    try {
      const { data } = await api.get<Company[]>('/companies')
      setCompanies(data)
    } catch {
      setError('Não foi possível carregar as empresas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCompanies()
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setCreatedInfo(null)
    try {
      const { data } = await api.post('/companies', form)
      setCreatedInfo(
        `Empresa criada. Login do admin: ${data.adminUser.email} · senha temporária: ${data.tempPassword}`,
      )
      setForm({ name: '', email: '', cnpj: '', plan: 'basic' })
      await loadCompanies()
    } catch {
      setError('Não foi possível criar a empresa. Verifique os dados.')
    } finally {
      setSubmitting(false)
    }
  }

  async function setPlan(id: string, plan: Plan) {
    await api.patch(`/companies/${id}/plan`, { plan })
    await loadCompanies()
  }

  async function markPaid(id: string) {
    const nextDueDate = window.prompt(
      'Próximo vencimento (AAAA-MM-DD), opcional:',
    )
    if (nextDueDate === null) return
    await api.patch(
      `/companies/${id}/mark-paid`,
      nextDueDate ? { nextDueDate } : {},
    )
    await loadCompanies()
  }

  async function suspend(id: string) {
    if (!confirm('Suspender esta empresa?')) return
    await api.patch(`/companies/${id}/suspend`)
    await loadCompanies()
  }

  async function editName(company: Company) {
    const name = window.prompt('Novo nome da empresa:', company.name)
    if (!name || name === company.name) return
    await api.patch(`/companies/${company._id}`, { name })
    await loadCompanies()
  }

  async function remove(id: string, name: string) {
    if (
      !confirm(
        `Excluir "${name}" e todos os seus usuários? Esta ação não pode ser desfeita.`,
      )
    )
      return
    await api.delete(`/companies/${id}`, { data: { confirm: true } })
    await loadCompanies()
  }

  return (
    <div className="admin-surface flex min-h-screen flex-col bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto w-full max-w-5xl flex-1">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Painel CriaTech</h1>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span>{user?.name}</span>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-700 px-3 py-1.5 hover:bg-slate-800"
            >
              Sair
            </button>
          </div>
        </div>

        <p className="mb-6 text-sm text-slate-400">
          Visão central das empresas, planos e assinaturas da Cria Tech.
        </p>
        {!loading && (
          <div className="admin-metrics">
            <div>
              <span>Empresas cadastradas</span>
              <strong>{companies.length}</strong>
            </div>
            <div>
              <span>Assinaturas em dia</span>
              <strong>
                {
                  companies.filter((c) => c.subscriptionStatus === 'active')
                    .length
                }
              </strong>
            </div>
            <div>
              <span>Pagamentos em atraso</span>
              <strong>
                {
                  companies.filter((c) => c.subscriptionStatus === 'overdue')
                    .length
                }
              </strong>
            </div>
          </div>
        )}
        <form
          onSubmit={handleCreate}
          className="mb-8 grid gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-5"
        >
          <label className="form-field">
            <span>Nome da empresa</span>
            <input
              aria-label="Nome da empresa"
              placeholder="Nome da empresa"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="form-field">
            <span>E-mail do admin</span>
            <input
              aria-label="E-mail do admin"
              placeholder="E-mail do admin"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="form-field">
            <span>CNPJ</span>
            <input
              aria-label="CNPJ"
              placeholder="CNPJ"
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <select
            value={form.plan}
            onChange={(e) => setForm({ ...form, plan: e.target.value as Plan })}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
          >
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-white disabled:opacity-60"
          >
            {submitting ? 'Criando...' : 'Criar empresa'}
          </button>
          {createdInfo && (
            <p className="sm:col-span-5 text-sm text-green-400">
              {createdInfo}
            </p>
          )}
          {error && (
            <p className="sm:col-span-5 text-sm text-red-400">{error}</p>
          )}
        </form>

        {loading ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Plano</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Próx. vencimento</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c._id} className="border-t border-slate-800">
                    <td className="px-4 py-2 font-medium">{c.name}</td>
                    <td className="px-4 py-2">
                      <select
                        value={c.plan}
                        onChange={(e) => setPlan(c._id, e.target.value as Plan)}
                        className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
                      >
                        <option value="basic">Basic</option>
                        <option value="pro">Pro</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[c.subscriptionStatus]}`}
                      >
                        {STATUS_LABEL[c.subscriptionStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {c.nextDueDate
                        ? new Date(c.nextDueDate).toLocaleDateString('pt-BR')
                        : '-'}
                    </td>
                    <td className="space-x-3 px-4 py-2 text-right text-xs">
                      <button
                        onClick={() => editName(c)}
                        className="text-slate-300 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => markPaid(c._id)}
                        className="text-green-400 hover:underline"
                      >
                        Marcar pago
                      </button>
                      <button
                        onClick={() => suspend(c._id)}
                        className="text-amber-400 hover:underline"
                      >
                        Suspender
                      </button>
                      <button
                        onClick={() => remove(c._id, c.name)}
                        className="text-red-400 hover:underline"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <DarkFooter />
    </div>
  )
}
