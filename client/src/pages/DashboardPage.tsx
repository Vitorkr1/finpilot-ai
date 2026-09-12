import { useAuth } from '../context/AuthContext'
import { Footer } from '../components/Footer'

export function DashboardPage() {
  const { user, company, logout } = useAuth()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">CriaOS</h1>
            {company && <p className="text-xs text-slate-500">{company.name} · plano {company.plan}</p>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{user?.name}</span>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <h2 className="text-xl font-semibold text-slate-900">Bem-vindo(a), {user?.name}</h2>
        <p className="mt-1 text-sm text-slate-500">
          Este é o painel inicial do CriaOS. Os módulos de clientes, orçamentos, ordens de
          serviço e agenda chegam nas próximas fases.
        </p>
      </main>

      <Footer />
    </div>
  )
}
