import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { api } from '../lib/api'
import type { Client } from '../lib/types'

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', document: '', address: '' })
  const [submitting, setSubmitting] = useState(false)

  async function loadClients() {
    setLoading(true)
    try {
      const { data } = await api.get<Client[]>('/clients')
      setClients(data)
    } catch {
      setError('Não foi possível carregar os clientes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClients()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/clients', form)
      setForm({ name: '', phone: '', document: '', address: '' })
      await loadClients()
    } catch {
      setError('Não foi possível criar o cliente. Verifique os dados.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este cliente?')) return
    await api.delete(`/clients/${id}`)
    await loadClients()
  }

  return (
    <AppLayout>
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Clientes</h2>

      <form onSubmit={handleSubmit} className="mb-8 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <input
          placeholder="Nome"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Telefone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="CPF/CNPJ"
          value={form.document}
          onChange={(e) => setForm({ ...form, document: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Endereço"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="sm:col-span-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {submitting ? 'Salvando...' : 'Adicionar cliente'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : clients.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum cliente cadastrado ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">Telefone</th>
                <th className="px-4 py-2">Documento</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c._id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-2 text-slate-600">{c.phone || '-'}</td>
                  <td className="px-4 py-2 text-slate-600">{c.document || '-'}</td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/clientes/${c._id}/historico`} className="mr-3 text-brand-600 hover:underline">
                      Histórico
                    </Link>
                    <button onClick={() => handleDelete(c._id)} className="text-red-600 hover:underline">
                      Excluir
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
