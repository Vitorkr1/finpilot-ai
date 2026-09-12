import { useEffect, useState, type FormEvent } from 'react'
import { AppLayout } from '../components/AppLayout'
import { api } from '../lib/api'
import type { FinancialEntry, FinancialEntryType } from '../lib/types'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function FinancialPage() {
  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ type: 'receita' as FinancialEntryType, description: '', amount: '', dueDate: '' })
  const [submitting, setSubmitting] = useState(false)

  async function loadEntries() {
    setLoading(true)
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
      await api.post('/financial-entries', { ...form, amount: Number(form.amount) })
      setForm({ type: 'receita', description: '', amount: '', dueDate: '' })
      await loadEntries()
    } catch {
      setError('Não foi possível criar o lançamento.')
    } finally {
      setSubmitting(false)
    }
  }

  async function markPaid(id: string) {
    await api.patch(`/financial-entries/${id}/mark-paid`)
    await loadEntries()
  }

  async function remove(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    await api.delete(`/financial-entries/${id}`)
    await loadEntries()
  }

  const receitas = entries.filter((e) => e.type === 'receita' && e.paidDate).reduce((s, e) => s + e.amount, 0)
  const despesas = entries.filter((e) => e.type === 'despesa' && e.paidDate).reduce((s, e) => s + e.amount, 0)

  return (
    <AppLayout>
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Financeiro</h2>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Recebido</p>
          <p className="text-lg font-semibold text-green-700">{currency.format(receitas)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Pago</p>
          <p className="text-lg font-semibold text-red-700">{currency.format(despesas)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mb-8 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as FinancialEntryType })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="receita">Receita</option>
          <option value="despesa">Despesa</option>
        </select>
        <input
          placeholder="Descrição"
          required
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="number"
          min={0}
          step="0.01"
          placeholder="Valor"
          required
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
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

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum lançamento ainda.</p>
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
              {entries.map((entry) => (
                <tr key={entry._id} className="border-t border-slate-100">
                  <td className="px-4 py-2 capitalize text-slate-700">{entry.type}</td>
                  <td className="px-4 py-2 text-slate-900">{entry.description}</td>
                  <td className="px-4 py-2 text-slate-700">{currency.format(entry.amount)}</td>
                  <td className="px-4 py-2 text-slate-600">{new Date(entry.dueDate).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-2">
                    {entry.paidDate ? (
                      <span className="text-xs font-medium text-green-700">Pago</span>
                    ) : (
                      <button onClick={() => markPaid(entry._id)} className="text-xs font-medium text-brand-600 hover:underline">
                        Marcar como pago
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => remove(entry._id)} className="text-red-600 hover:underline">
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
