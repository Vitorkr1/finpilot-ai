import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuth } from '../context/AuthContext'
import { AppLayout } from '../components/AppLayout'
import { api } from '../lib/api'

interface Summary {
  openServiceOrders: number
  closedServiceOrders: number
  revenueThisMonth: number
  expensesThisMonth: number
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function DashboardPage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    api
      .get<Summary>('/dashboard/summary')
      .then(({ data }) => setSummary(data))
      .catch(() => setSummary(null))
  }, [])

  const chartData = summary
    ? [
        { name: 'OS abertas', valor: summary.openServiceOrders },
        { name: 'OS concluídas', valor: summary.closedServiceOrders },
      ]
    : []

  return (
    <AppLayout>
      <h2 className="text-xl font-semibold text-slate-900">Bem-vindo(a), {user?.name}</h2>
      <p className="mt-1 text-sm text-slate-500">
        Use o menu acima para gerenciar clientes, orçamentos, ordens de serviço, agenda,
        estoque e financeiro.
      </p>

      {summary && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">OS abertas</p>
              <p className="text-2xl font-semibold text-slate-900">{summary.openServiceOrders}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">OS concluídas</p>
              <p className="text-2xl font-semibold text-slate-900">{summary.closedServiceOrders}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Faturamento do mês</p>
              <p className="text-2xl font-semibold text-green-700">{currency.format(summary.revenueThisMonth)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Despesas do mês</p>
              <p className="text-2xl font-semibold text-red-700">{currency.format(summary.expensesThisMonth)}</p>
            </div>
          </div>

          <div className="mt-6 h-64 rounded-xl border border-slate-200 bg-white p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="valor" fill="#2952f5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </AppLayout>
  )
}
