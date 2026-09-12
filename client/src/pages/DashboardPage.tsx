import { useAuth } from '../context/AuthContext'
import { AppLayout } from '../components/AppLayout'

export function DashboardPage() {
  const { user } = useAuth()

  return (
    <AppLayout>
      <h2 className="text-xl font-semibold text-slate-900">Bem-vindo(a), {user?.name}</h2>
      <p className="mt-1 text-sm text-slate-500">
        Use o menu acima para gerenciar clientes, orçamentos, ordens de serviço e a
        agenda dos técnicos. Estoque, financeiro e relatórios chegam nas próximas fases.
      </p>
    </AppLayout>
  )
}
