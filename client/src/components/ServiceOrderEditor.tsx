import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import type { PendingReason, ServiceOrder, ServiceOrderStatus } from '../lib/types'
import { deviceTimeZone, ORDER_STATUS, PENDING_REASONS, toIsoDateTime, toLocalDateTime } from '../lib/serviceOrders'
import './service-orders.css'

interface Props {
  order: ServiceOrder
  clientName: string
  management: boolean
  initialStatus?: ServiceOrderStatus
  onClose: () => void
  onSaved: (order: ServiceOrder) => void
}

export function ServiceOrderEditor({ order, clientName, management, initialStatus, onClose, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const inFlight = useRef(false)
  const [draft, setDraft] = useState(() => {
    const status = initialStatus || order.status
    return {
      calledAt: toLocalDateTime(order.calledAt || order.createdAt),
      requestDescription: order.requestDescription || '',
      startedAt: toLocalDateTime(order.startedAt || (status === 'em_andamento' && !order.finishedAt ? new Date().toISOString() : null)),
      finishedAt: toLocalDateTime(order.finishedAt || (status === 'concluida' ? new Date().toISOString() : null)),
      serviceDescription: order.serviceDescription || '',
      hasPending: order.hasPending || false,
      pendingReason: order.pendingReason || '' as PendingReason | '',
      pendingNotes: order.pendingNotes || '', status,
    }
  })
  const initialDraft = useRef(JSON.stringify(draft))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  function close() {
    if (inFlight.current) return
    if (JSON.stringify(draft) !== initialDraft.current && !window.confirm('Descartar as alterações que ainda não foram salvas?')) return
    onClose()
  }

  function changeStatus(status: ServiceOrderStatus) {
    setDraft(current => ({ ...current, status,
      startedAt: current.startedAt || (status === 'em_andamento' && !current.finishedAt ? toLocalDateTime(new Date().toISOString()) : ''),
      finishedAt: current.finishedAt || (status === 'concluida' ? toLocalDateTime(new Date().toISOString()) : ''),
    }))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setSaving(true); setError('')
    try {
      const payload = {
        ...(management ? { calledAt: toIsoDateTime(draft.calledAt, order.calledAt || order.createdAt), requestDescription: draft.requestDescription } : {}),
        startedAt: toIsoDateTime(draft.startedAt, order.startedAt),
        finishedAt: toIsoDateTime(draft.finishedAt, order.finishedAt),
        serviceDescription: draft.serviceDescription, hasPending: draft.hasPending,
        pendingReason: draft.pendingReason || null, pendingNotes: draft.pendingNotes, status: draft.status,
        ...(order.updatedAt ? { expectedUpdatedAt: order.updatedAt } : {}),
      }
      const { data } = await api.patch<ServiceOrder>(`/service-orders/${order._id}`, payload)
      onSaved(data)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || (err instanceof Error ? err.message : 'Não foi possível salvar o atendimento. Tente novamente.'))
    } finally { setSaving(false); inFlight.current = false }
  }

  return <dialog ref={dialog} className="os-editor" aria-labelledby="os-editor-title" onCancel={event => { event.preventDefault(); close() }}>
    <div className="os-editor-heading"><div><h2 id="os-editor-title">Registro do atendimento</h2><p>{clientName} · OS {order._id.slice(-6).toUpperCase()}</p></div><button type="button" className="secondary-button" disabled={saving} onClick={close}>Fechar</button></div>
    <form onSubmit={save}>
      <fieldset disabled={saving}><legend>Chamado</legend>
        <div className="os-form-grid">
          <label className="form-field"><span>Data e hora do chamado</span><input type="datetime-local" step="1" required value={draft.calledAt} disabled={!management} onChange={event => setDraft({ ...draft, calledAt: event.target.value })} /></label>
          <label className="form-field"><span>Status da OS</span><select value={draft.status} onChange={event => changeStatus(event.target.value as ServiceOrderStatus)}>{Object.entries(ORDER_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="form-field os-full"><span>Descrição do chamado</span><textarea rows={2} maxLength={4000} disabled={!management} value={draft.requestDescription} onChange={event => setDraft({ ...draft, requestDescription: event.target.value })} /></label>
        </div>
        {!management && <p className="os-editor-note">A data e a descrição do chamado são ajustadas pelo admin ou financeiro.</p>}
      </fieldset>
      <fieldset disabled={saving}><legend>Execução do serviço</legend>
        <div className="os-form-grid">
          <label className="form-field"><span>Início do atendimento</span><input type="datetime-local" step="1" value={draft.startedAt} onChange={event => setDraft({ ...draft, startedAt: event.target.value })} /></label>
          <label className="form-field"><span>Fim do atendimento</span><input type="datetime-local" step="1" required={draft.status === 'concluida'} value={draft.finishedAt} onChange={event => setDraft({ ...draft, finishedAt: event.target.value })} /></label>
          <label className="form-field os-full"><span>Serviço realizado{draft.status === 'concluida' ? ' *' : ''}</span><textarea rows={4} maxLength={8000} required={draft.status === 'concluida'} placeholder="Descreva o que foi feito, os testes e o resultado do atendimento." value={draft.serviceDescription} onChange={event => setDraft({ ...draft, serviceDescription: event.target.value })} /><small>Até 8.000 caracteres. Obrigatório para concluir a OS.</small></label>
        </div>
        <p className="os-editor-note">Horários no fuso do seu dispositivo: {deviceTimeZone()}. O fim do atendimento também pode ser registrado quando a OS precisar de retorno.</p>
      </fieldset>
      <fieldset disabled={saving}><legend>Pendências</legend>
        <label className="os-pending-toggle"><input type="checkbox" checked={draft.hasPending} onChange={event => setDraft({ ...draft, hasPending: event.target.checked })} /><span>Há algo que não foi possível concluir</span></label>
        {(draft.hasPending || draft.pendingNotes || draft.pendingReason) && <div className="os-form-grid">
          <label className="form-field"><span>Motivo{draft.hasPending ? ' *' : ''}</span><select required={draft.hasPending} value={draft.pendingReason} onChange={event => setDraft({ ...draft, pendingReason: event.target.value as PendingReason | '' })}><option value="">Selecione o motivo</option>{Object.entries(PENDING_REASONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="form-field os-full"><span>O que ficou pendente e o que precisa ser feito{draft.hasPending ? ' *' : ''}</span><textarea rows={3} maxLength={4000} required={draft.hasPending} placeholder="Ex.: falta disjuntor de 32 A. Retornar após a compra para concluir a instalação." value={draft.pendingNotes} onChange={event => setDraft({ ...draft, pendingNotes: event.target.value })} /></label>
        </div>}
        <p className="os-editor-note">Quando resolver, desmarque a pendência. O motivo e a descrição podem ser mantidos no registro.</p>
      </fieldset>
      {draft.hasPending && draft.status === 'concluida' && <p className="os-error" role="alert">Há uma pendência em aberto. Resolva a pendência ou mantenha a OS aberta ou em andamento.</p>}
      {error && <p className="os-error" role="alert">{error}</p>}
      <div className="os-editor-actions"><button type="button" className="secondary-button" disabled={saving} onClick={close}>Cancelar</button><button type="submit" className="primary-button" disabled={saving || (draft.hasPending && draft.status === 'concluida')}>{saving ? 'Salvando…' : 'Salvar atendimento'}</button></div>
    </form>
  </dialog>
}
