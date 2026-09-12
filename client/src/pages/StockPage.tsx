import { useEffect, useState, type FormEvent } from 'react'
import { AppLayout } from '../components/AppLayout'
import { api } from '../lib/api'
import type { StockItem } from '../lib/types'

export function StockPage() {
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', sku: '', quantity: '', minQuantity: '', unit: 'un' })
  const [submitting, setSubmitting] = useState(false)

  async function loadItems() {
    setLoading(true)
    try {
      const { data } = await api.get<StockItem[]>('/stock-items')
      setItems(data)
    } catch {
      setError('Não foi possível carregar o estoque.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/stock-items', {
        ...form,
        quantity: Number(form.quantity || 0),
        minQuantity: Number(form.minQuantity || 0),
      })
      setForm({ name: '', sku: '', quantity: '', minQuantity: '', unit: 'un' })
      await loadItems()
    } catch {
      setError('Não foi possível criar o item de estoque.')
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Excluir este item?')) return
    await api.delete(`/stock-items/${id}`)
    await loadItems()
  }

  return (
    <AppLayout>
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Estoque</h2>
      <p className="mb-4 text-sm text-slate-500">
        Recurso Pro. A baixa de materiais usados numa ordem de serviço decrementa a
        quantidade aqui automaticamente.
      </p>

      <form onSubmit={handleSubmit} className="mb-8 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-5">
        <input
          placeholder="Nome"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="SKU"
          value={form.sku}
          onChange={(e) => setForm({ ...form, sku: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="number"
          min={0}
          placeholder="Quantidade"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="number"
          min={0}
          placeholder="Qtd. mínima"
          value={form.minQuantity}
          onChange={(e) => setForm({ ...form, minQuantity: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Unidade"
          value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {error && <p className="sm:col-span-5 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="sm:col-span-5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {submitting ? 'Salvando...' : 'Adicionar item'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum item de estoque ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">Quantidade</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-900">{item.name}</td>
                  <td className="px-4 py-2 text-slate-600">{item.sku || '-'}</td>
                  <td className={`px-4 py-2 ${item.quantity <= item.minQuantity ? 'font-semibold text-red-600' : 'text-slate-700'}`}>
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => remove(item._id)} className="text-red-600 hover:underline">
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
