import { lazy, Suspense, useEffect, useState } from 'react'
import { AppLayout } from '../components/AppLayout'
import { Icon } from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { canPlotPosition, positionStatus, type RouteSession } from '../lib/routeTracking'
import './routes.css'

const RouteMap = lazy(() => import('../components/RouteMap'))
const dateTime = (value: string) => new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })

export function RoutesPage() {
  const { user } = useAuth()
  const technician = user?.role === 'tecnico'
  const canView = technician || user?.role === 'admin' || user?.role === 'financeiro'
  const [sessions, setSessions] = useState<RouteSession[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [stopping, setStopping] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmStop, setConfirmStop] = useState(false)
  const apkUrl = import.meta.env.VITE_ANDROID_APK_URL as string | undefined
  useEffect(() => {
    if (!canView) { setLoading(false); return }
    let cancelled = false
    let busy = false
    const controller = new AbortController()
    async function load() {
      if (busy) return
      busy = true
      try {
        const { data } = await api.get(technician ? '/route-tracking/mine' : '/route-tracking', { signal: controller.signal })
        if (!cancelled) { setSessions(technician ? (data ? [data] : []) : data); setError(''); setNow(Date.now()) }
      } catch {
        if (!cancelled) setError('Não foi possível atualizar as posições. Verifique a conexão e tente novamente.')
      } finally { busy = false; if (!cancelled) setLoading(false) }
    }
    void load()
    const interval = window.setInterval(() => { if (!document.hidden) void load(); setNow(Date.now()) }, 5000)
    const onVisible = () => { if (!document.hidden) void load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { cancelled = true; controller.abort(); window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
  }, [technician, canView, refresh])

  async function stop() {
    setStopping(true)
    try { await api.delete('/route-tracking/mine'); setSessions([]); setConfirmStop(false); setRefresh((n) => n + 1) }
    catch { setError('Não foi possível encerrar a rota. Tente novamente ou encerre pelo aplicativo.') }
    finally { setStopping(false) }
  }

  const active = sessions.filter((s) => new Date(s.expiresAt).getTime() > now)
  const recent = active.filter((s) => positionStatus(s.position, now).tone === 'recent').length
  const stale = active.filter((s) => positionStatus(s.position, now).tone === 'stale').length
  return <AppLayout>
    <div className="page-heading routes-heading">
      <div><p className="eyebrow">OPERAÇÃO / ROTAS</p><h2>{technician ? 'Minha rota' : 'Equipe em rota'}</h2><p>{technician ? 'Você decide quando compartilhar sua localização.' : 'Acompanhe os deslocamentos durante o atendimento.'}</p></div>
      {canView && <button className="secondary-button" disabled={loading} onClick={() => setRefresh((n) => n + 1)}><Icon name="refresh" size={16} /> Atualizar</button>}
    </div>
    {!canView ? <p role="alert">Seu perfil não tem acesso às rotas.</p> : <>
      {error && <p className="routes-error" role="alert">{error}</p>}
      {technician ? <div className="routes-technician">
        <section className="routes-panel routes-android">
          <span className="routes-platform">ANDROID · APP DO TÉCNICO</span>
          <h3>Saia para a rota. Continue conectado.</h3>
          <p>Inicie a rota no aplicativo Android para compartilhar sua posição com admin e financeiro da sua empresa, inclusive com a tela bloqueada ou o navegador fechado.</p>
          <p className="routes-caption">Endereço para entrar no app: <strong>{window.location.origin}</strong></p>
          <button className="secondary-button" onClick={async () => { try { await navigator.clipboard.writeText(window.location.origin); setCopied(true) } catch { setError('Copie o endereço exibido acima e informe no aplicativo.') } }}>{copied ? 'Endereço copiado' : 'Copiar endereço do sistema'}</button>
          <ol><li>Instale o app e entre com sua conta de técnico.</li><li>Permita <strong>localização precisa</strong> e notificações; mantenha o GPS ligado.</li><li>Toque em <strong>Iniciar rota</strong> e aguarde uma leitura confiável. Ao terminar, toque em <strong>Encerrar rota</strong>.</li></ol>
          {apkUrl && /^https:\/\//.test(apkUrl) ? <a className="primary-button" href={apkUrl} target="_blank" rel="noreferrer"><Icon name="download" size={16} /> Baixar app Android</a> : <p className="routes-install-note">Solicite o aplicativo Android ao administrador da sua empresa.</p>}
          <p className="routes-caption">Não é preciso manter este site aberto. O aplicativo deve continuar ativo no celular, com o aviso de rota visível.</p>
        </section>
        <section className="routes-panel">
          <div className="routes-section-title"><Icon name="pin" /><h3>Compartilhamento</h3></div>
          {loading ? <p role="status">Carregando sua rota…</p> : active[0] ? <>
            <span className={`route-status ${positionStatus(active[0].position, now).tone}`}>{positionStatus(active[0].position, now).label}</span>
            <p className="routes-copy">Rota iniciada em {dateTime(active[0].startedAt)}.</p>
            {canPlotPosition(active[0].position, now) && <p className="routes-copy">Última posição: {dateTime(active[0].position.capturedAt)} · margem estimada de ±{Math.ceil(active[0].position.accuracy)} m.</p>}
            <p className="routes-caption">Encerra automaticamente em {dateTime(active[0].expiresAt)}. Você pode encerrar antes pelo app ou por aqui.</p>
            {confirmStop ? <div className="routes-stop-confirm"><p>Encerrar o compartilhamento desta rota?</p><button className="routes-stop" disabled={stopping} onClick={stop}>{stopping ? 'Encerrando…' : 'Sim, encerrar'}</button><button className="secondary-button" disabled={stopping} onClick={() => setConfirmStop(false)}>Voltar</button></div> : <button className="routes-stop" onClick={() => setConfirmStop(true)}>Encerrar rota</button>}
          </> : <div className="routes-small-empty"><Icon name="shield" size={30} /><h4>Nenhuma rota ativa</h4><p>Sua localização não está sendo compartilhada. Inicie uma rota pelo app Android quando sair para atendimento.</p></div>}
        </section>
      </div> : <>
        <div className="routes-summary"><div><span>Em rota</span><strong>{active.length.toString().padStart(2, '0')}</strong></div><div><span>Posição recente</span><strong>{recent.toString().padStart(2, '0')}</strong></div><div><span>Sem posição recente</span><strong>{(active.length - recent).toString().padStart(2, '0')}</strong></div><p><Icon name="shield" size={18} /> Visível apenas para admin e financeiro da sua empresa.</p></div>
        {loading ? <div className="routes-panel routes-empty" role="status">Carregando rotas…</div> : active.length === 0 ? <section className="routes-panel routes-empty"><span className="routes-empty-icon"><Icon name="pin" size={30} /></span><h3>A equipe ainda não saiu para rota.</h3><p>Quando um técnico iniciar o compartilhamento no app Android, a última posição dele aparecerá aqui.</p><span>O compartilhamento termina ao encerrar a rota.</span></section> : <div className="routes-workspace">
          <section className="routes-panel routes-list"><div className="routes-list-heading"><h3>Técnicos em atendimento</h3><span>{active.length}</span></div>{active.map((session) => {
            const status = positionStatus(session.position, now)
            return <article className={`route-person ${selectedId === session._id ? 'is-selected' : ''}`} key={session._id}>
              <div className="route-person-name"><span>{session.technician?.name.slice(0, 2).toUpperCase() || 'TE'}</span><div><h4>{session.technician?.name || 'Técnico'}</h4><p>Saída às {new Date(session.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p></div></div>
              <span className={`route-status ${status.tone}`}>{status.label}</span>
              {canPlotPosition(session.position, now) ? <><p className="route-person-detail">{dateTime(session.position.capturedAt)} · margem estimada ±{Math.ceil(session.position.accuracy)} m</p><button className="route-map-button" onClick={() => setSelectedId(selectedId === session._id ? null : session._id)}>Localizar no mapa <Icon name="arrow" size={15} /></button></> : <p className="route-person-detail">Aguardando uma posição com margem estimada de até 50 m. Leituras imprecisas não aparecem no mapa.</p>}
            </article>
          })}</section>
          <section className="routes-panel routes-map-panel"><div className="routes-map-heading"><h3>Últimas posições</h3><span>Consulta a cada 5 s</span></div><Suspense fallback={<div className="route-map" role="status">Carregando mapa…</div>}><RouteMap sessions={active} selectedId={selectedId} now={now} /></Suspense><p className="routes-map-note">{stale > 0 ? 'Há posições anteriores, sem atualização recente. Confira o horário antes de considerar o ponto como atual. ' : ''}O círculo mostra a margem de erro estimada pelo celular. O ponto não comprova endereço ou presença exatos.</p></section>
        </div>}
        <p className="routes-caption routes-footnote">Somente a última posição é mantida durante a rota, por até 12 horas. Ao encerrar, ela é removida. Sem internet, o painel mantém a última posição com o horário da coleta.</p>
      </>}
    </>}
  </AppLayout>
}
