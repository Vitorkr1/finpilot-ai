import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { AppLayout } from '../components/AppLayout'
import { ServiceOrderEditor } from '../components/ServiceOrderEditor'
import { ServiceOrderRecord } from '../components/ServiceOrderRecord'
import { DeleteServiceOrderDialog } from '../components/DeleteServiceOrderDialog'
import { api } from '../lib/api'
import { downloadCsv, localDateISO } from '../lib/format'
import { deviceTimeZone, ORDER_STATUS as STATUS_LABEL, serviceOrderCsvRows, toIsoDateTime, toLocalDateTime } from '../lib/serviceOrders'
import type { Client, ServiceOrder, ServiceOrderStatus, User } from '../lib/types'

const SEGMENTS = [
  { value: 'eletrica', label: 'Elétrica' },
  { value: 'solar', label: 'Energia Solar' },
  { value: 'ar_condicionado', label: 'Ar-condicionado' },
  { value: 'seguranca', label: 'Segurança Eletrônica' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'outro', label: 'Outro' },
]

const errorText = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback

export function ServiceOrdersPage() {
  const { user } = useAuth()
  const management = user?.role === 'admin' || user?.role === 'financeiro'
  const [technicians, setTechnicians] = useState<User[]>([])
  const [technicianId, setTechnicianId] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('todos')
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientId, setClientId] = useState('')
  const [segment, setSegment] = useState('outro')
  const [submitting, setSubmitting] = useState(false)
  const [calledAt, setCalledAt] = useState(() => toLocalDateTime(new Date().toISOString()))
  const [requestDescription, setRequestDescription] = useState('')
  const [editing, setEditing] = useState<{ order: ServiceOrder; initialStatus?: ServiceOrderStatus } | null>(null)
  const [success, setSuccess] = useState('')
  const [deleting, setDeleting] = useState<ServiceOrder | null>(null)
  const visibleOrders = orders.filter(order => statusFilter === 'todos' || (statusFilter === 'pendencias' ? order.hasPending : order.status === statusFilter))

  async function loadData() {
    setLoading(true)
    try {
      const [ordersRes, clientsRes] = await Promise.all([
        api.get<ServiceOrder[]>('/service-orders'),
        api.get<Client[]>('/clients'),
      ])
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
    if (management) api.get<User[]>('/company-users/technicians').then(({ data }) => setTechnicians(data)).catch(() => setError('Não foi possível carregar os técnicos.'))
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/service-orders', { clientId, segment, calledAt: toIsoDateTime(calledAt), requestDescription, ...(technicianId ? { technicianId } : {}) })
      setRequestDescription(''); setCalledAt(toLocalDateTime(new Date().toISOString()))
      setSuccess('OS aberta. Os detalhes do chamado já estão disponíveis para o técnico atribuído.')
      await loadData()
    } catch (err) {
      setError(errorText(err, 'Não foi possível criar a ordem de serviço.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function updateStatus(id: string, status: ServiceOrderStatus) {
    if (status === 'concluida') { await openEditor(id, status); return }
    setPending(id); setError(null)
    try { await api.patch(`/service-orders/${id}`, { status }); await loadData() }
    catch (err) { setError(errorText(err, 'Não foi possível atualizar a ordem. Tente novamente.')) }
    finally { setPending(null) }
  }

  async function openEditor(id: string, initialStatus?: ServiceOrderStatus) {
    setPending(id); setError(null); setSuccess('')
    try {
      const { data } = await api.get<ServiceOrder>(`/service-orders/${id}`)
      setEditing({ order: data, initialStatus })
    } catch (err) { setError(errorText(err, 'Não foi possível carregar o atendimento.')) }
    finally { setPending(null) }
  }

  async function toggleChecklistItem(order: ServiceOrder, index: number) {
    const checklist = order.checklist.map((it, i) =>
      i === index ? { ...it, done: !it.done } : it,
    )
    setPending(order._id); setError(null)
    try { await api.patch(`/service-orders/${order._id}`, { checklist }); await loadData() }
    catch { setError('Não foi possível salvar o checklist. Tente novamente.') }
    finally { setPending(null) }
  }

  async function uploadPhoto(orderId: string, file: File) {
    const formData = new FormData()
    formData.append('photo', file)
    setError(null)
    try {
      await api.post(`/service-orders/${orderId}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await loadData()
    } catch {
      setError(
        'Não foi possível enviar a foto. Verifique se o Cloudinary está configurado.',
      )
    }
  }

  function clientName(id: string) {
    return clients.find((c) => c._id === id)?.name || '—'
  }

  return (
    <AppLayout>
      <h2 className="mb-4 text-xl font-semibold text-slate-900">
        Ordens de Serviço
      </h2>
      <p className="page-description">
        Registre o chamado, o serviço realizado e o que precisa de retorno. Horários em {deviceTimeZone()}.
      </p>

      {management && <form
        onSubmit={handleSubmit}
        className="os-create"
      >
        <h3>Abrir ordem de serviço</h3>
        <div className="os-form-grid">
        <label className="form-field"><span>Cliente *</span>
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
        </label>
        <label className="form-field"><span>Tipo de serviço</span>
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
        </label>
        <label className="form-field"><span>Técnico responsável</span>
        <select aria-label="Técnico responsável" value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Sem técnico atribuído</option>
          {technicians.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
        </label>
        <label className="form-field"><span>Data e hora do chamado *</span><input type="datetime-local" step="1" required value={calledAt} onChange={event => setCalledAt(event.target.value)} /><small>Informe quando o cliente fez a solicitação.</small></label>
        <label className="form-field os-full"><span>Descrição do chamado</span><textarea rows={3} maxLength={4000} value={requestDescription} onChange={event => setRequestDescription(event.target.value)} placeholder="Ex.: ar-condicionado não está resfriando. Verificar a unidade da recepção." /></label>
        </div>
        <div className="os-create-actions">
        <button
          type="submit"
          disabled={submitting || !clientId}
          className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {submitting ? 'Abrindo...' : 'Abrir OS'}
        </button>
        </div>
      </form>}
      {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
      {success && <p role="status" className="os-success">{success}</p>}

      <div className="list-toolbar">
        <div className="filter-tabs" aria-label="Filtrar por status">
          <button
            aria-pressed={statusFilter === 'todos'}
            onClick={() => setStatusFilter('todos')}
          >
            Todos ({orders.length})
          </button>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={statusFilter === value}
              onClick={() => setStatusFilter(value)}
            >
              {label} ({orders.filter((item) => item.status === value).length})
            </button>
          ))}
          <button aria-pressed={statusFilter === 'pendencias'} onClick={() => setStatusFilter('pendencias')}>Com pendências ({orders.filter(order => order.hasPending).length})</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="secondary-button" disabled={loading || pending !== null} onClick={() => { setError(null); void loadData() }}>Atualizar lista</button>
          {management && <button type="button" className="secondary-button" disabled={loading || !visibleOrders.length} onClick={() => downloadCsv(`ordens-de-servico-${localDateISO()}.csv`, serviceOrderCsvRows(visibleOrders, clients, technicians))}>Exportar para Excel (CSV)</button>}
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : visibleOrders.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhuma ordem de serviço neste status.
        </p>
      ) : (
        <div className="space-y-3">
          {visibleOrders
            .map((order) => (
              <div
                key={order._id}
                className="os-card"
              >
                <div className="os-card-head">
                  <div>
                    <h3>
                      {clientName(order.clientId)}
                    </h3>
                    <p className="os-card-id">OS {order._id.slice(-6).toUpperCase()} ·{' '}
                      {SEGMENTS.find((s) => s.value === order.segment)?.label} ·{' '}
                      {order.laborHours}h registradas
                    </p>
                  </div>
                  <div className="os-card-controls">
                  {management && <label>Técnico<select aria-label="Atribuir técnico à ordem" value={order.technicianId || ''} disabled={pending !== null} onChange={async (e) => {
                    setPending(order._id); setError(null)
                    try { await api.patch(`/service-orders/${order._id}`, { technicianId: e.target.value || null }); await loadData() }
                    catch { setError('Não foi possível atribuir o técnico.') }
                    finally { setPending(null) }
                  }} className="rounded-lg border border-slate-300 px-2 py-1 text-sm">
                    <option value="">Sem técnico atribuído</option>
                    {technicians.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                  </select></label>}
                  <label>Status
                  <select
                    aria-label="Status da ordem"
                    disabled={pending !== null}
                    value={order.status}
                    onChange={(e) =>
                      updateStatus(
                        order._id,
                        e.target.value as ServiceOrderStatus,
                      )
                    }
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  >
                    {Object.entries(STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  </label>
                  </div>
                </div>
                <ServiceOrderRecord order={order} />
                <div className="os-order-actions">
                  <button type="button" className="secondary-button" disabled={pending !== null} onClick={() => void openEditor(order._id)}>Registrar atendimento</button>
                  {management && <button type="button" className="os-danger-outline" aria-label={`Excluir OS ${order._id.slice(-6).toUpperCase()}`} disabled={pending !== null} onClick={() => { setError(null); setSuccess(''); setDeleting(order) }}>Excluir OS</button>}
                </div>
                <h4 className="os-checklist-title">CHECKLIST</h4>
                <ul className="mb-3 space-y-1">
                  {order.checklist.map((item, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={item.done}
                        disabled={pending !== null}
                        onChange={() => toggleChecklistItem(order, index)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span
                        className={
                          item.done
                            ? 'text-slate-400 line-through'
                            : 'text-slate-700'
                        }
                      >
                        {item.item}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center gap-2">
                  {order.photos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer">
                      <img
                        src={url}
                        alt="Foto da OS"
                        className="h-14 w-14 rounded-lg object-cover"
                      />
                    </a>
                  ))}
                  <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50">
                    + Foto
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) uploadPhoto(order._id, file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
        </div>
      )}
      {editing && <ServiceOrderEditor order={editing.order} initialStatus={editing.initialStatus} clientName={clientName(editing.order.clientId)} management={management} onClose={() => setEditing(null)} onSaved={updated => {
        setOrders(current => current.map(order => order._id === updated._id ? updated : order))
        setEditing(null); setSuccess('Atendimento salvo. As informações estão disponíveis na OS e no histórico do cliente.')
      }} />}
      {management && deleting && <DeleteServiceOrderDialog order={deleting} clientName={clientName(deleting.clientId)} onClose={() => setDeleting(null)} onDeleted={id => {
        setOrders(current => current.filter(order => order._id !== id)); setDeleting(null); setSuccess('Ordem de serviço excluída.')
      }} onCancelled={updated => {
        setOrders(current => current.map(order => order._id === updated._id ? updated : order)); setDeleting(null); setSuccess('OS cancelada. O histórico e todos os vínculos foram preservados.')
      }} />}
    </AppLayout>
  )
}
