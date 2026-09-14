import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import { AppLayout } from '../components/AppLayout'
import { Icon, type IconName } from '../components/Icon'
import { api } from '../lib/api'
interface Summary {
  openServiceOrders: number
  closedServiceOrders: number
  revenueThisMonth: number
  expensesThisMonth: number
}
const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const shortcuts: { to: string; label: string; text: string; icon: IconName }[] =
  [
    {
      to: '/clientes',
      label: 'Cadastrar cliente',
      text: 'Comece um novo relacionamento',
      icon: 'users',
    },
    {
      to: '/orcamentos',
      label: 'Criar orçamento',
      text: 'Transforme oportunidades em serviços',
      icon: 'file',
    },
    {
      to: '/agenda',
      label: 'Organizar agenda',
      text: 'Planeje as próximas visitas',
      icon: 'calendar',
    },
  ]
export function DashboardPage() {
  const { user, company } = useAuth()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    api
      .get<Summary>('/dashboard/summary')
      .then(({ data }) => {
        if (active) setSummary(data)
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [attempt])
  const cards: {
    label: string
    value: string | number
    detail: string
    icon: IconName
    color: string
    to: string
  }[] = summary
    ? [
        {
          label: 'Recebido no mês',
          value: currency.format(summary.revenueThisMonth),
          detail: 'Receitas com pagamento registrado',
          icon: 'trend',
          color: 'emerald',
          to: '/financeiro',
        },
        {
          label: 'Despesas do mês',
          value: currency.format(summary.expensesThisMonth),
          detail: 'Despesas com pagamento registrado',
          icon: 'wallet',
          color: 'orange',
          to: '/financeiro',
        },
        {
          label: 'Ordens em aberto',
          value: summary.openServiceOrders,
          detail: 'Abertas e em andamento',
          icon: 'tool',
          color: 'blue',
          to: '/ordens-de-servico',
        },
        {
          label: 'Serviços concluídos',
          value: summary.closedServiceOrders,
          detail: 'Total de ordens finalizadas',
          icon: 'check',
          color: 'violet',
          to: '/ordens-de-servico',
        },
      ]
    : []
  const balance = summary
    ? summary.revenueThisMonth - summary.expensesThisMonth
    : 0
  const total = summary
    ? summary.openServiceOrders + summary.closedServiceOrders
    : 0
  const completed =
    summary && total
      ? Math.round((summary.closedServiceOrders / total) * 100)
      : 0
  return (
    <AppLayout>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SEU NEGÓCIO, EM MOVIMENTO</p>
          <h2>
            Olá, {user?.name?.split(' ')[0] || 'bem-vindo'}{' '}
            <span className="greeting-dot">.</span>
          </h2>
          <p>Acompanhe sua operação e dê o próximo passo com clareza.</p>
        </div>
        <Link className="primary-button" to="/orcamentos">
          <Icon name="plus" size={18} />
          Novo orçamento
        </Link>
      </div>
      <section className="overview-banner">
        <div>
          <span className="live-label">
            <span />
            CENTRAL DE OPERAÇÕES
          </span>
          <h3>
            Menos tarefas soltas.
            <br />
            Mais controle do seu negócio.
          </h3>
          <p>Clientes, equipe e resultados. Tudo conectado no CriaOS.</p>
          <Link to="/ordens-de-servico">
            Acompanhar serviços <Icon name="arrow" size={17} />
          </Link>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit-core">
            <Icon name="spark" size={48} />
          </div>
          <span className="orbit-node node-one">
            <Icon name="tool" />
          </span>
          <span className="orbit-node node-two">
            <Icon name="users" />
          </span>
          <span className="orbit-node node-three">
            <Icon name="check" />
          </span>
        </div>
      </section>
      <div className="section-heading">
        <h3>Seu negócio em números</h3>
        <span>
          <Icon name="calendar" size={15} />
          {new Date().toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric',
          })}
        </span>
      </div>
      {error ? (
        <div role="alert" className="error-state">
          <strong>Não foi possível atualizar os indicadores.</strong>
          <p>Verifique sua conexão e tente novamente.</p>
          <button
            className="secondary-button"
            onClick={() => setAttempt((a) => a + 1)}
          >
            <Icon name="refresh" size={16} />
            Tentar novamente
          </button>
        </div>
      ) : loading ? (
        <div
          className="metrics-grid"
          aria-label="Carregando indicadores"
          role="status"
        >
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="metric-card skeleton">
              <span />
              <strong />
              <span />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="metrics-grid">
            {cards.map((card) => (
              <Link to={card.to} className="metric-card" key={card.label}>
                <div className="metric-top">
                  <span>{card.label}</span>
                  <span className={`metric-icon ${card.color}`}>
                    <Icon name={card.icon} size={19} />
                  </span>
                </div>
                <strong>{card.value}</strong>
                <span className="metric-detail">{card.detail}</span>
              </Link>
            ))}
          </div>
          <div className="dashboard-columns">
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h3>Panorama financeiro</h3>
                  <p>Movimentações pagas neste mês</p>
                </div>
                <Link to="/financeiro" className="text-link">
                  Ver financeiro <Icon name="arrow" size={15} />
                </Link>
              </div>
              {summary &&
              (summary.revenueThisMonth || summary.expensesThisMonth) ? (
                <div
                  className="finance-chart"
                  aria-label={`Recebido: ${currency.format(summary.revenueThisMonth)}. Despesas: ${currency.format(summary.expensesThisMonth)}.`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Recebido', valor: summary.revenueThisMonth },
                        { name: 'Despesas', valor: summary.expensesThisMonth },
                      ]}
                      barSize={62}
                      margin={{ left: 12, right: 24, top: 12 }}
                    >
                      <CartesianGrid
                        strokeDasharray="4 4"
                        vertical={false}
                        stroke="#e8edf4"
                      />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        tickFormatter={(v) =>
                          new Intl.NumberFormat('pt-BR', {
                            notation: 'compact',
                          }).format(v)
                        }
                      />
                      <Tooltip
                        formatter={(v) => currency.format(Number(v))}
                        cursor={{ fill: '#f5f7fb' }}
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid #e8edf4',
                        }}
                      />
                      <Bar dataKey="valor" name="Valor" radius={[7, 7, 0, 0]}>
                        <Cell fill="#5064f5" />
                        <Cell fill="#f5ac72" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">
                    <Icon name="wallet" size={28} />
                  </span>
                  <h4>Seu financeiro começa aqui</h4>
                  <p>
                    Registre receitas e despesas para acompanhar os resultados.
                  </p>
                  <Link to="/financeiro" className="text-link">
                    Adicionar lançamento <Icon name="arrow" size={16} />
                  </Link>
                </div>
              )}
              <div className="balance-row">
                <span>Saldo realizado no mês</span>
                <strong
                  className={balance < 0 ? 'text-red-700' : 'text-green-700'}
                >
                  {currency.format(balance)}
                </strong>
              </div>
            </section>
            <section className="panel operation-panel">
              <div className="section-heading">
                <div>
                  <h3>Ritmo da operação</h3>
                  <p>Distribuição das ordens de serviço</p>
                </div>
                <Icon name="tool" />
              </div>
              <div
                className="progress-ring"
                style={{
                  background: `conic-gradient(#5064f5 ${completed}%, #eef1f7 0)`,
                }}
              >
                <div>
                  <strong>{total ? `${completed}%` : '—'}</strong>
                  <span>concluídas</span>
                </div>
              </div>
              <div className="operation-row">
                <span>
                  <i className="legend-dot blue-dot" />
                  Concluídas
                </span>
                <strong>{summary?.closedServiceOrders}</strong>
              </div>
              <div className="operation-row">
                <span>
                  <i className="legend-dot pale-dot" />
                  Em aberto
                </span>
                <strong>{summary?.openServiceOrders}</strong>
              </div>
              <Link
                to="/ordens-de-servico"
                className="secondary-button full-width"
              >
                Gerenciar serviços <Icon name="arrow" size={16} />
              </Link>
            </section>
          </div>
        </>
      )}
      <div className="section-heading">
        <h3>O que vamos fazer agora?</h3>
        <span>Acesso rápido</span>
      </div>
      <div className="quick-grid">
        {shortcuts.map((s) => (
          <Link className="quick-card" key={s.to} to={s.to}>
            <span className="quick-icon">
              <Icon name={s.icon} />
            </span>
            <div>
              <strong>{s.label}</strong>
              <p>{s.text}</p>
            </div>
            <Icon name="arrow" size={17} />
          </Link>
        ))}
      </div>
      {company?.plan === 'pro' && (
        <Link to="/assistente-ia" className="ai-banner">
          <span className="quick-icon">
            <Icon name="spark" />
          </span>
          <div>
            <strong>Uma ajudinha inteligente para sua rotina.</strong>
            <p>Explore o assistente IA e descubra como usar melhor o CriaOS.</p>
          </div>
          <span className="text-link">
            Conversar com IA <Icon name="arrow" size={17} />
          </span>
        </Link>
      )}
    </AppLayout>
  )
}
