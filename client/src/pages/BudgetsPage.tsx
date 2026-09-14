import { useEffect, useState, type FormEvent } from 'react'
import { AppLayout } from '../components/AppLayout'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import type { Budget, BudgetItem, Client, BudgetStatus } from '../lib/types'

const STATUS_LABEL: Record<BudgetStatus, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
}

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function BudgetsPage() {
  const { company } = useAuth()
  const [statusFilter, setStatusFilter] = useState('todos')
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientId, setClientId] = useState('')
  const [items, setItems] = useState<BudgetItem[]>([
    { description: '', qty: 1, unitPrice: 0 },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [aiDescription, setAiDescription] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    try {
      const [budgetsRes, clientsRes] = await Promise.all([
        api.get<Budget[]>('/budgets'),
        api.get<Client[]>('/clients'),
      ])
      setBudgets(budgetsRes.data)
      setClients(clientsRes.data)
      if (!clientId && clientsRes.data[0]) setClientId(clientsRes.data[0]._id)
    } catch {
      setError('Não foi possível carregar os orçamentos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateItem(index: number, patch: Partial<BudgetItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    )
  }

  function addItem() {
    setItems((prev) => [...prev, { description: '', qty: 1, unitPrice: 0 }])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/budgets', { clientId, items })
      setItems([{ description: '', qty: 1, unitPrice: 0 }])
      await loadData()
    } catch {
      setError('Não foi possível criar o orçamento. Verifique os dados.')
    } finally {
      setSubmitting(false)
    }
  }

  async function updateStatus(id: string, status: BudgetStatus) {
    await api.patch(`/budgets/${id}`, { status })
    await loadData()
  }

  async function convert(id: string) {
    await api.post(`/budgets/${id}/convert`)
    await loadData()
  }

  async function downloadPdf(id: string) {
    if (downloadingPdf) return
    setDownloadingPdf(id)
    setPdfError(null)
    try {
      const { data } = await api.get<Blob>(`/budgets/${id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = `orcamento-${id}.pdf`
      document.body.appendChild(link)
      try { link.click() } finally {
        link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      }
    } catch {
      setPdfError('Não foi possível gerar o PDF. Tente novamente.')
    } finally {
      setDownloadingPdf(null)
    }
  }

  async function generateAiDraft() {
    if (!aiDescription.trim()) return
    setAiLoading(true)
    setError(null)
    try {
      const { data } = await api.post<{ items: BudgetItem[] }>(
        '/ai/budget-draft',
        { description: aiDescription },
      )
      if (data.items.length > 0) setItems(data.items)
    } catch {
      setError('Não foi possível gerar o rascunho com IA agora.')
    } finally {
      setAiLoading(false)
    }
  }

  const total = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0)

  return (
    <AppLayout>
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Orçamentos</h2>
      <p className="page-description">
        Da primeira proposta ao próximo serviço. Acompanhe cada oportunidade.
      </p>

      {company?.plan === 'pro' && (
        <div className="mb-4 rounded-xl border border-dashed border-brand-300 bg-brand-50 p-4">
          <p className="mb-2 text-sm font-medium text-brand-700">
            Rascunho de orçamento com IA
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              placeholder="Ex.: instalação de 4 câmeras e 1 DVR com cabeamento"
              className="min-w-[16rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={generateAiDraft}
              disabled={aiLoading}
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {aiLoading ? 'Gerando...' : 'Gerar itens com IA'}
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="mb-8 space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <select
          required
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Selecione o cliente
          </option>
          {clients.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex flex-wrap gap-2">
              <input
                aria-label="Descrição"
                placeholder="Descrição"
                required
                value={item.description}
                onChange={(e) =>
                  updateItem(index, { description: e.target.value })
                }
                className="min-w-[10rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                aria-label="Qtd"
                type="number"
                min={0}
                step="1"
                placeholder="Qtd"
                value={item.qty}
                onChange={(e) =>
                  updateItem(index, { qty: Number(e.target.value) })
                }
                className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                aria-label="Preço unit."
                type="number"
                min={0}
                step="0.01"
                placeholder="Preço unit."
                value={item.unitPrice}
                onChange={(e) =>
                  updateItem(index, { unitPrice: Number(e.target.value) })
                }
                className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-sm text-red-600"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="text-sm text-brand-600 hover:underline"
          >
            + adicionar item
          </button>
        </div>

        <p className="text-sm font-medium text-slate-700">
          Total: {currency.format(total)}
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !clientId}
          className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {submitting ? 'Salvando...' : 'Criar orçamento'}
        </button>
      </form>

      <div className="list-toolbar">
        <div className="filter-tabs" aria-label="Filtrar por status">
          <button
            aria-pressed={statusFilter === 'todos'}
            onClick={() => setStatusFilter('todos')}
          >
            Todos ({budgets.length})
          </button>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={statusFilter === value}
              onClick={() => setStatusFilter(value)}
            >
              {label} ({budgets.filter((item) => item.status === value).length})
            </button>
          ))}
        </div>
      </div>
      {pdfError && <p role="alert" className="mb-4 text-sm text-red-600">{pdfError}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : budgets.filter(
          (item) => statusFilter === 'todos' || item.status === statusFilter,
        ).length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum orçamento neste status.</p>
      ) : (
        <div className="space-y-3">
          {budgets
            .filter(
              (item) =>
                statusFilter === 'todos' || item.status === statusFilter,
            )
            .map((b) => (
              <div
                key={b._id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">
                      {clients.find((c) => c._id === b.clientId)?.name ||
                        'Cliente'}
                    </p>
                    <p className="font-medium text-slate-900">
                      {currency.format(b.total)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {b.items.length} item(ns)
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={b.status}
                      disabled={b.convertedToServiceOrder}
                      onChange={(e) =>
                        updateStatus(b._id, e.target.value as BudgetStatus)
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    >
                      {Object.entries(STATUS_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {b.status === 'aprovado' && !b.convertedToServiceOrder && (
                      <button
                        onClick={() => convert(b._id)}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                      >
                        Converter em OS
                      </button>
                    )}
                    {b.convertedToServiceOrder && (
                      <span className="text-xs font-medium text-green-700">
                        Convertido em OS
                      </span>
                    )}
                    <button
                      disabled={downloadingPdf !== null}
                      onClick={() => downloadPdf(b._id)}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      {downloadingPdf === b._id ? 'Gerando PDF...' : 'Baixar PDF'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </AppLayout>
  )
}
