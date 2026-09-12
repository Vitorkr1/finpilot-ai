import { type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Footer } from './Footer'

const NAV_ITEMS = [
  { to: '/', label: 'Início', end: true },
  { to: '/clientes', label: 'Clientes' },
  { to: '/orcamentos', label: 'Orçamentos' },
  { to: '/ordens-de-servico', label: 'Ordens de Serviço' },
  { to: '/agenda', label: 'Agenda' },
  { to: '/financeiro', label: 'Financeiro' },
]

const PRO_NAV_ITEMS = [
  { to: '/estoque', label: 'Estoque' },
  { to: '/assistente-ia', label: 'Assistente IA' },
  { to: '/configuracoes/whatsapp', label: 'WhatsApp' },
]

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded-lg px-3 py-1.5 text-sm font-medium ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
  }`
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, company, logout } = useAuth()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">CriaOS</h1>
            {company && <p className="text-xs text-slate-500">{company.name} · plano {company.plan}</p>}
          </div>
          <nav className="flex flex-wrap gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
                {item.label}
              </NavLink>
            ))}
            {company?.plan === 'pro' &&
              PRO_NAV_ITEMS.map((item) => (
                <NavLink key={item.to} to={item.to} className={navClass}>
                  {item.label}
                </NavLink>
              ))}
            {user?.role === 'admin' && (
              <NavLink to="/usuarios" className={navClass}>
                Usuários
              </NavLink>
            )}
          </nav>
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

      <Footer />
    </div>
  )
}
