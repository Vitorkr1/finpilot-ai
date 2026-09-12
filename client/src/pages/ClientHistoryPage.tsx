import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { api } from '../lib/api'
import type { Budget, Client, ServiceOrder } from '../lib/types'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

interface HistoryResponse {
  client: Client
  budgets: Budget[]
  serviceOrders: ServiceOrder[]
}

export function ClientHistoryPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<HistoryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api
      .get<HistoryResponse>(`/clients/${id}/history`)
      .then(({ data }) => setData(data))
      .catch(() => setError('Não foi possível carregar o histórico deste cliente.'))
  }, [id])

  return (
    <AppLayout>
      <Link to="/clientes" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← Voltar para clientes
      </Link>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <>
          <h2 className="mb-1 text-xl font-semibold text-slate-900">{data.client.name}</h2>
          <p className="mb-6 text-sm text-slate-500">
            {data.client.phone || 'Sem telefone'} · {data.client.document || 'Sem documento'}
          </p>

          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Orçamentos</h3>
          {data.budgets.length === 0 ? (
            <p className="mb-6 text-sm text-slate-500">Nenhum orçamento para este cliente.</p>
          ) : (
            <div className="mb-6 space-y-2">
              {data.budgets.map((b) => (
                <div key={b._id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <span>{new Date(b.createdAt).toLocaleDateString('pt-BR')}</span>
                  <span className="font-medium">{currency.format(b.total)}</span>
                  <span className="capitalize text-slate-500">{b.status}</span>
                </div>
              ))}
            </div>
          )}

          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Ordens de Serviço</h3>
          {data.serviceOrders.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma ordem de serviço para este cliente.</p>
          ) : (
            <div className="space-y-2">
              {data.serviceOrders.map((so) => (
                <div key={so._id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <span>{new Date(so.createdAt).toLocaleDateString('pt-BR')}</span>
                  <span className="capitalize text-slate-500">{so.segment}</span>
                  <span className="capitalize text-slate-500">{so.status}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </AppLayout>
  )
}
