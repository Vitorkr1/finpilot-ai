import type { ServiceOrder } from '../lib/types'
import { formatDateTime, PENDING_REASONS } from '../lib/serviceOrders'
import './service-orders.css'

export function ServiceOrderRecord({ order }: { order: ServiceOrder }) {
  return <div className="os-record">
    {order.deletedTechnicianName && <p className="mb-3 text-xs text-slate-500">Responsável registrado: {order.deletedTechnicianName} · membro excluído da equipe</p>}
    <dl className="os-dates">
      <div><dt>Data e hora do chamado</dt><dd>{formatDateTime(order.calledAt || order.createdAt)}</dd>{!order.calledAt && <small>Data de cadastro da OS</small>}</div>
      <div><dt>Início do atendimento</dt><dd>{formatDateTime(order.startedAt)}</dd></div>
      <div><dt>Fim do atendimento</dt><dd>{formatDateTime(order.finishedAt)}</dd></div>
    </dl>
    {order.requestDescription && <div className="os-text"><h4>Descrição do chamado</h4><p>{order.requestDescription}</p></div>}
    {order.serviceDescription && <div className="os-text"><h4>Serviço realizado</h4><p>{order.serviceDescription}</p></div>}
    {(order.hasPending || order.pendingNotes) && <div className={`os-pending ${order.hasPending ? 'is-open' : 'is-resolved'}`}>
      <h4>{order.hasPending ? 'Pendência em aberto' : 'Pendência resolvida'}{order.pendingReason && <> · {PENDING_REASONS[order.pendingReason]}</>}</h4>
      <p>{order.pendingNotes}</p>
    </div>}
  </div>
}
