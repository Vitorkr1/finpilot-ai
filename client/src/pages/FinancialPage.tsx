import { useEffect, useState, type FormEvent } from 'react'
import { AppLayout } from '../components/AppLayout'
import { Icon } from '../components/Icon'
import { downloadCsv, formatDate, isOverdue } from '../lib/format'
import { api } from '../lib/api'
import type { FinancialEntry, FinancialEntryType } from '../lib/types'

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function FinancialPage() {
  const [filter, setFilter] = useState('todos')
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    type: 'receita' as FinancialEntryType,
    description: '',
    amount: '',
    dueDate: '',
  })
  const [submitting, setSubmitting] = useState(false)

  async function loadEntries() {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<FinancialEntry[]>('/financial-entries')
      setEntries(data)
    } catch {
      setError('Não foi possível carregar o financeiro.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEntries()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/financial-entries', {
        ...form,
        amount: Number(form.amount),
      })
      setForm({ type: 'receita', description: '', amount: '', dueDate: '' })
      await loadEntries()
    } catch {
      setError('Não foi possível criar o lançamento.')
    } finally {
      setSubmitting(false)
    }
  }

  async function markPaid(id: string) {
    setPending(id)
    setError(null)
    try {
      await api.patch(`/financial-entries/${id}/mark-paid`)
      await loadEntries()
    } catch {
      setError('Não foi possível registrar o pagamento. Tente novamente.')
    } finally {
      setPending(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    setPending(id)
    setError(null)
    try {
      await api.delete(`/financial-entries/${id}`)
      await loadEntries()
    } catch {
      setError('Não foi possível excluir o lançamento. Tente novamente.')
    } finally {
      setPending(null)
    }
  }

  const receitas = entries
    .filter((e) => e.type === 'receita' && e.paidDate)
    .reduce((s, e) => s + e.amount, 0)
  const despesas = entries
    .filter((e) => e.type === 'despesa' && e.paidDate)
    .reduce((s, e) => s + e.amount, 0)

  const filtered = entries.filter(
    (e) =>
      e.description.toLowerCase().includes(query.toLowerCase()) &&
      (filter === 'todos' ||
        (filter === 'pendentes' && !e.paidDate) ||
        (filter === 'pagos' && !!e.paidDate) ||
        (filter === 'vencidos' && !e.paidDate && isOverdue(e.dueDate))),
  )
  function exportEntries() {
    downloadCsv('criaos-financeiro.csv', [
      ['Tipo', 'Descrição', 'Valor (BRL)', 'Vencimento', 'Status'],
      ...filtered.map((e) => [
        e.type,
        e.description,
        e.amount.toFixed(2).replace('.', ','),
        formatDate(e.dueDate),
        e.paidDate ? 'Pago' : isOverdue(e.dueDate) ? 'Vencido' : 'Pendente',
      ]),
    ])
  }

  return (
    <AppLayout>
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Financeiro</h2>
      <p className="page-description">
        Receitas, despesas e vencimentos. Clareza para decidir o próximo passo.
      </p>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Recebido</p>
          <p className="text-lg font-semibold text-green-700">
            {currency.format(receitas)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Pago</p>
          <p className="text-lg font-semibold text-red-700">
            {currency.format(despesas)}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mb-8 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4"
      >
        <select
          aria-label="Tipo de lançamento"
          value={form.type}
          onChange={(e) =>
            setForm({ ...form, type: e.target.value as FinancialEntryType })
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="receita">Receita</option>
          <option value="despesa">Despesa</option>
        </select>
        <label className="form-field">
          <span>Descrição</span>
          <input
            aria-label="Descrição"
            placeholder="Descrição"
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="form-field">
          <span>Valor</span>
          <input
            aria-label="Valor"
            type="number"
            min={0}
            step="0.01"
            placeholder="Valor"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <input
          aria-label="Vencimento"
          type="date"
          required
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {error && <p className="sm:col-span-4 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="sm:col-span-4 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {submitting ? 'Salvando...' : 'Adicionar lançamento'}
        </button>
      </form>

      <div className="list-toolbar">
        <div className="filter-tabs" aria-label="Filtrar lançamentos">
          {[
            ['todos', 'Todos'],
            ['pendentes', 'Pendentes'],
            ['pagos', 'Pagos'],
            ['vencidos', 'Vencidos'],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="secondary-button"
          onClick={exportEntries}
          disabled={loading || filtered.length === 0}
        >
          <Icon name="download" size={16} />
          Exportar CSV
        </button>
      </div>
      <div className="list-toolbar">
        <label className="list-search">
          <Icon name="search" size={17} />
          <input
            aria-label="Buscar lançamentos"
            placeholder="Buscar descrição..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="result-count" role="status">
          {filtered.length} lançamentos
        </span>
      </div>
      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhum lançamento encontrado. Adicione um registro ou ajuste os
          filtros.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Descrição</th>
                <th className="px-4 py-2">Valor</th>
                <th className="px-4 py-2">Vencimento</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry._id} className="border-t border-slate-100">
                  <td className="px-4 py-2 capitalize text-slate-700">
                    {entry.type}
                  </td>
                  <td className="px-4 py-2 text-slate-900">
                    {entry.description}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {currency.format(entry.amount)}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {formatDate(entry.dueDate)}
                    {!entry.paidDate && isOverdue(entry.dueDate) && (
                      <div>
                        <span className="overdue-badge">Vencido</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {entry.paidDate ? (
                      <span className="text-xs font-medium text-green-700">
                        Pago
                      </span>
                    ) : (
                      <button
                        disabled={pending === entry._id}
                        onClick={() => markPaid(entry._id)}
                        className="text-xs font-medium text-brand-600 hover:underline"
                      >
                        Marcar como pago
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      disabled={pending === entry._id}
                      onClick={() => remove(entry._id)}
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
