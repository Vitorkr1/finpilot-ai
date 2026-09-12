import { useEffect, useState, type FormEvent } from 'react'
import { AppLayout } from '../components/AppLayout'
import { api } from '../lib/api'
import type { Client, ServiceOrder, ServiceOrderStatus } from '../lib/types'

const SEGMENTS = [
  { value: 'eletrica', label: 'Elétrica' },
  { value: 'solar', label: 'Energia Solar' },
  { value: 'ar_condicionado', label: 'Ar-condicionado' },
  { value: 'seguranca', label: 'Segurança Eletrônica' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'outro', label: 'Outro' },
]

const STATUS_LABEL: Record<ServiceOrderStatus, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export function ServiceOrdersPage() {
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientId, setClientId] = useState('')
  const [segment, setSegment] = useState('outro')
  const [submitting, setSubmitting] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const [ordersRes, clientsRes] = await Promise.all([api.get<ServiceOrder[]>('/service-orders'), api.get<Client[]>('/clients')])
      setOrders(ordersRes.data)
      setClients(clientsRes.data)
      if (!clientId && clientsRes.data[0]) setClientId(clientsRes.data[0]._id)
    } catch {
      setError('Não foi possível carregar as ordens de serviço.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/service-orders', { clientId, segment })
      await loadData()
    } catch {
      setError('Não foi possível criar a ordem de serviço.')
    } finally {
      setSubmitting(false)
    }
  }

  async function updateStatus(id: string, status: ServiceOrderStatus) {
    await api.patch(`/service-orders/${id}`, { status })
    await loadData()
  }

  async function toggleChecklistItem(order: ServiceOrder, index: number) {
    const checklist = order.checklist.map((it, i) => (i === index ? { ...it, done: !it.done } : it))
    await api.patch(`/service-orders/${order._id}`, { checklist })
    await loadData()
  }

  function clientName(id: string) {
    return clients.find((c) => c._id === id)?.name || '—'
  }

  return (
    <AppLayout>
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Ordens de Serviço</h2>

      <form onSubmit={handleSubmit} className="mb-8 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <select
          required
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
        <select
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {SEGMENTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={submitting || !clientId}
          className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {submitting ? 'Abrindo...' : 'Abrir OS'}
        </button>
        {error && <p className="sm:col-span-3 text-sm text-red-600">{error}</p>}
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma ordem de serviço ainda.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order._id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{clientName(order.clientId)}</p>
                  <p className="text-xs text-slate-500">
                    {SEGMENTS.find((s) => s.value === order.segment)?.label} · {order.laborHours}h registradas
                  </p>
                </div>
                <select
                  value={order.status}
                  onChange={(e) => updateStatus(order._id, e.target.value as ServiceOrderStatus)}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                >
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <ul className="space-y-1">
                {order.checklist.map((item, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => toggleChecklistItem(order, index)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className={item.done ? 'text-slate-400 line-through' : 'text-slate-700'}>{item.item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  )
}
