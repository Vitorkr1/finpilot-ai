import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Footer } from './Footer'
import { Icon, type IconName } from './Icon'
const items: {
  to: string
  label: string
  icon: IconName
  group: string
  pro?: boolean
  admin?: boolean
}[] = [
  { to: '/', label: 'Visão geral', icon: 'grid', group: 'Workspace' },
  { to: '/clientes', label: 'Clientes', icon: 'users', group: 'Operação' },
  { to: '/orcamentos', label: 'Orçamentos', icon: 'file', group: 'Operação' },
  {
    to: '/ordens-de-servico',
    label: 'Ordens de serviço',
    icon: 'tool',
    group: 'Operação',
  },
  { to: '/agenda', label: 'Agenda', icon: 'calendar', group: 'Operação' },
  { to: '/financeiro', label: 'Financeiro', icon: 'wallet', group: 'Gestão' },
  { to: '/estoque', label: 'Estoque', icon: 'box', group: 'Gestão', pro: true },
  {
    to: '/usuarios',
    label: 'Equipe',
    icon: 'users',
    group: 'Gestão',
    admin: true,
  },
  {
    to: '/assistente-ia',
    label: 'Assistente IA',
    icon: 'spark',
    group: 'Inteligência',
    pro: true,
  },
  {
    to: '/configuracoes/whatsapp',
    label: 'WhatsApp',
    icon: 'chat',
    group: 'Inteligência',
    pro: true,
    admin: true,
  },
]
export function AppLayout({ children }: { children: ReactNode }) {
  const { user, company, logout } = useAuth()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [logoutError, setLogoutError] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  const visible = items.filter(
    (i) =>
      (!i.pro || company?.plan === 'pro') &&
      (!i.admin || user?.role === 'admin'),
  )
  const matches = visible.filter((i) =>
    i.label
      .toLocaleLowerCase('pt-BR')
      .includes(query.toLocaleLowerCase('pt-BR')),
  )
  const current = items.find(
    (i) => i.to === pathname || (i.to !== '/' && pathname.startsWith(i.to)),
  )
  useEffect(() => {
    if (!menuOpen) return
    sidebarRef.current?.querySelector<HTMLElement>('a')?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [menuOpen])
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setQuery('')
        menuRef.current?.focus()
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo
      </a>
      {menuOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        onKeyDown={(e) => {
          if (!menuOpen || e.key !== 'Tab') return
          const elements = sidebarRef.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not(:disabled)',
          )
          if (!elements?.length) return
          const first = elements[0],
            last = elements[elements.length - 1]
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last.focus()
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }}
        id="app-navigation"
        className={`sidebar ${menuOpen ? 'is-open' : ''}`}
      >
        <Link to="/" className="brand-lockup">
          <span className="brand-mark">
            <Icon name="spark" size={24} />
          </span>
          <span>
            cria<span className="brand-os">OS</span>
            <small>BY CRIA TECH</small>
          </span>
        </Link>
        <div className="workspace-card">
          <span className="workspace-avatar">
            {company?.name?.slice(0, 1) || 'C'}
          </span>
          <div>
            <strong>{company?.name || 'Minha empresa'}</strong>
            <span>Workspace da empresa</span>
          </div>
          <span className="plan-pill">{company?.plan || 'basic'}</span>
        </div>
        <nav aria-label="Navegação principal" className="sidebar-nav">
          {['Workspace', 'Operação', 'Gestão', 'Inteligência'].map((group) => {
            const links = visible.filter((i) => i.group === group)
            return (
              links.length > 0 && (
                <div key={group} className="nav-group">
                  <p>{group}</p>
                  {links.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        `nav-item ${isActive ? 'active' : ''}`
                      }
                    >
                      <Icon name={item.icon} />
                      <span>{item.label}</span>
                      {item.pro && <small>PRO</small>}
                    </NavLink>
                  ))}
                </div>
              )
            )
          })}
        </nav>
        <a
          className="sidebar-help"
          href="https://wa.me/5581996744143"
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="chat" />
          <div>
            <strong>Conte com a Cria Tech</strong>
            <span>Fale com nosso suporte</span>
          </div>
          <Icon name="arrow" size={16} />
        </a>
        <div className="sidebar-user">
          <span className="user-avatar">
            {user?.name?.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>{user?.name}</strong>
            <span>
              {user?.role === 'admin'
                ? 'Administrador'
                : user?.role === 'tecnico'
                  ? 'Técnico'
                  : 'Financeiro'}
            </span>
          </div>
          <button
            aria-label="Sair da conta"
            title="Sair da conta"
            onClick={() => {
              setLogoutError(false)
              logout().catch(() => setLogoutError(true))
            }}
          >
            <Icon name="logout" size={18} />
          </button>
        </div>
        {logoutError && (
          <p role="alert" className="text-xs text-red-300">
            Não foi possível sair. Tente novamente.
          </p>
        )}
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <button
            ref={menuRef}
            className="mobile-menu icon-button"
            aria-label={menuOpen ? 'Fechar navegação' : 'Abrir navegação'}
            aria-expanded={menuOpen}
            aria-controls="app-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span>{' '}
            <strong>{current?.label || 'Detalhes'}</strong>
          </div>
          <div className="module-search">
            <Icon name="search" size={17} />
            <input
              ref={searchRef}
              aria-label="Buscar módulos"
              placeholder="Ir para um módulo..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>Ctrl K</kbd>
            {query && (
              <div className="search-results">
                <p>NAVEGAÇÃO RÁPIDA</p>
                {matches.length ? (
                  matches.map((i) => (
                    <Link key={i.to} to={i.to} onClick={() => setQuery('')}>
                      <Icon name={i.icon} size={17} />
                      {i.label}
                      <Icon name="arrow" size={16} />
                    </Link>
                  ))
                ) : (
                  <p>Nenhum módulo encontrado.</p>
                )}
              </div>
            )}
          </div>
          <span className="topbar-avatar" title={user?.name}>
            {user?.name?.slice(0, 1)}
          </span>
        </header>
        <main id="main-content" tabIndex={-1} className="page-content">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  )
}
