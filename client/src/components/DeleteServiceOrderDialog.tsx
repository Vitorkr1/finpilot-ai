import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import type { ServiceOrder, ServiceOrderStatus } from '../lib/types'
import './service-orders.css'

interface DeletionCheck { canDelete: boolean; reasons: string[]; status: ServiceOrderStatus }
interface Props {
  order: ServiceOrder
  clientName: string
  onClose: () => void
  onDeleted: (id: string) => void
  onCancelled: (order: ServiceOrder) => void
}

export function DeleteServiceOrderDialog({ order, clientName, onClose, onDeleted, onCancelled }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const inFlight = useRef(false)
  const [check, setCheck] = useState<DeletionCheck | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<'delete' | 'cancel' | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const element = dialog.current
    let active = true
    element?.showModal()
    api.get<DeletionCheck>(`/service-orders/${order._id}/deletion-check`)
      .then(({ data }) => { if (active) setCheck(data) })
      .catch(() => { if (active) setError('Não foi possível verificar os vínculos desta OS. Feche e tente novamente.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false; element?.close() }
  }, [order._id])

  async function remove(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current || !check?.canDelete || !confirmed) return
    inFlight.current = true; setWorking('delete'); setError('')
    try {
      await api.delete(`/service-orders/${order._id}`)
      onDeleted(order._id)
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { code?: string; error?: string } & Partial<DeletionCheck> } })?.response?.data
      if (data?.code === 'OS_HAS_LINKS') {
        setCheck({ canDelete: false, reasons: data.reasons || [], status: data.status || order.status })
      } else {
        setError(data?.error || 'Não foi possível confirmar a exclusão. Feche e atualize a lista para conferir antes de tentar novamente.')
      }
      setConfirmed(false)
    } finally { setWorking(null); inFlight.current = false }
  }

  async function cancelOrder() {
    if (inFlight.current || !check || check.canDelete || check.status === 'cancelada') return
    inFlight.current = true; setWorking('cancel'); setError('')
    try {
      const { data } = await api.patch<ServiceOrder>(`/service-orders/${order._id}`, { status: 'cancelada' })
      onCancelled(data)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Não foi possível cancelar a OS. Tente novamente.')
    } finally { setWorking(null); inFlight.current = false }
  }

  function close() { if (!inFlight.current) onClose() }

  return <dialog ref={dialog} className="os-delete-dialog" aria-labelledby="os-delete-title" aria-describedby="os-delete-description" onCancel={event => { event.preventDefault(); close() }}>
    <h2 id="os-delete-title">{check && !check.canDelete ? 'Histórico protegido' : 'Excluir ordem de serviço'}</h2>
    <p id="os-delete-description" className="os-delete-person">{clientName} · OS {order._id.slice(-6).toUpperCase()}</p>
    {loading ? <p role="status">Verificando materiais, agendamentos e lançamentos financeiros…</p> : check && (check.canDelete ? <form onSubmit={remove}>
      <p className="os-delete-copy">Esta OS não possui vínculos que impeçam a exclusão. A exclusão é permanente e não pode ser desfeita. Para manter o registro, você pode voltar e mudar o status para Cancelada.</p>
      <label className="os-delete-confirm"><input type="checkbox" checked={confirmed} disabled={working !== null} onChange={event => setConfirmed(event.target.checked)} /><span>Entendo que a OS será excluída permanentemente.</span></label>
      {error && <p className="os-error" role="alert">{error}</p>}
      <div className="os-delete-actions"><button type="button" className="secondary-button" disabled={working !== null} onClick={close} autoFocus>Voltar</button><button type="submit" className="os-danger-button" disabled={!confirmed || working !== null}>{working === 'delete' ? 'Excluindo…' : 'Confirmar exclusão'}</button></div>
    </form> : <>
      <div className="os-delete-blocked"><strong>Esta OS não pode ser excluída.</strong><ul>{check.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul><p>Cancelar mantém a OS e todos os vínculos no histórico.</p></div>
      {check.status === 'cancelada' && <p className="os-editor-note">Esta OS já está cancelada. O histórico continua protegido.</p>}
      {error && <p className="os-error" role="alert">{error}</p>}
      <div className="os-delete-actions"><button type="button" className="secondary-button" disabled={working !== null} onClick={close} autoFocus>Voltar</button>{check.status !== 'cancelada' && <button type="button" className="primary-button" disabled={working !== null} onClick={cancelOrder}>{working === 'cancel' ? 'Cancelando…' : 'Cancelar OS e manter histórico'}</button>}</div>
    </>)}
    {!check && <>{error && <p className="os-error" role="alert">{error}</p>}<div className="os-delete-actions"><button type="button" className="secondary-button" onClick={close} autoFocus>Voltar</button></div></>}
  </dialog>
}
