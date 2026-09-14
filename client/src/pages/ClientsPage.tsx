import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { Icon } from '../components/Icon'
import { api } from '../lib/api'
import type { Client } from '../lib/types'

export function ClientsPage() {
  const [query, setQuery] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    document: '',
    address: '',
  })
  const [submitting, setSubmitting] = useState(false)

  async function loadClients() {
    setLoading(true)
    setError(null)
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
    setDeleting(id)
    setError(null)
    try {
      await api.delete(`/clients/${id}`)
      await loadClients()
    } catch {
      setError('Não foi possível excluir o cliente. Tente novamente.')
    } finally {
      setDeleting(null)
    }
  }

  const normalized = query
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  const filtered = clients.filter((c) =>
    [c.name, c.phone, c.document, c.address].some((v) =>
      v
        ?.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(normalized),
    ),
  )

  return (
    <AppLayout>
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Clientes</h2>
      <p className="page-description">
        Relacionamentos bem cuidados começam com informações organizadas.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mb-8 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2"
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
          <span>Telefone</span>
          <input
            aria-label="Telefone"
            placeholder="Telefone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="form-field">
          <span>CPF/CNPJ</span>
          <input
            aria-label="CPF/CNPJ"
            placeholder="CPF/CNPJ"
            value={form.document}
            onChange={(e) => setForm({ ...form, document: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="form-field">
          <span>Endereço</span>
          <input
            aria-label="Endereço"
            placeholder="Endereço"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="sm:col-span-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {submitting ? 'Salvando...' : 'Adicionar cliente'}
        </button>
      </form>

      <div className="list-toolbar">
        <label className="list-search">
          <Icon name="search" size={17} />
          <input
            aria-label="Buscar clientes"
            placeholder="Buscar nome, telefone ou documento"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="result-count" role="status">
          {filtered.length} de {clients.length} clientes
        </span>
      </div>
      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500">
          {query
            ? 'Nenhum cliente encontrado para esta busca.'
            : 'Nenhum cliente cadastrado ainda. Preencha o formulário para começar.'}
        </p>
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
              {filtered.map((c) => (
                <tr key={c._id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {c.name}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{c.phone || '-'}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {c.document || '-'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      to={`/clientes/${c._id}/historico`}
                      className="mr-3 text-brand-600 hover:underline"
                    >
                      Histórico
                    </Link>
                    <button
                      disabled={deleting === c._id}
                      onClick={() => handleDelete(c._id)}
                      className="text-red-600 hover:underline"
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
    </AppLayout>
  )
}
