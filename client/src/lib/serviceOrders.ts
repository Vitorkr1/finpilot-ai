import type { Client, PendingReason, ServiceOrder, ServiceOrderStatus, User } from './types'

export const ORDER_STATUS: Record<ServiceOrderStatus, string> = {
  aberta: 'Aberta', em_andamento: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada',
}
export const PENDING_REASONS: Record<PendingReason, string> = {
  material: 'Falta de material', imprevisto: 'Imprevisto no local', retorno: 'Necessita retorno', outro: 'Outro motivo',
}
export function deviceTimeZone() { return Intl.DateTimeFormat().resolvedOptions().timeZone }
export function formatDateTime(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Não informado'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}
export function toLocalDateTime(value?: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return ''
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
export function toIsoDateTime(value: string, original?: string | null): string | null {
  if (!value) return null
  if (original && value === toLocalDateTime(original)) return original
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || toLocalDateTime(date.toISOString()).slice(0, value.length) !== value) throw new Error('Confira as datas e os horários informados.')
  return date.toISOString()
}
export function serviceOrderCsvRows(orders: ServiceOrder[], clients: Client[], technicians: User[]) {
  const zone = deviceTimeZone()
  return [
    ['OS (ID)', 'Cliente', 'Técnico', 'Status', `Chamado (${zone})`, 'Descrição do chamado', `Início do atendimento (${zone})`, `Fim do atendimento (${zone})`, 'Serviço realizado', 'Situação da pendência', 'Motivo da pendência', 'Detalhes da pendência', 'Horas registradas'],
    ...orders.map(order => [
      order._id, clients.find(client => client._id === order.clientId)?.name || order.clientId,
      order.deletedTechnicianName ? `${order.deletedTechnicianName} (membro excluído)` : order.technicianId ? technicians.find(tech => tech._id === order.technicianId)?.name || order.technicianId : 'Sem técnico',
      ORDER_STATUS[order.status], formatDateTime(order.calledAt || order.createdAt), order.requestDescription || '',
      formatDateTime(order.startedAt), formatDateTime(order.finishedAt), order.serviceDescription || '',
      order.hasPending ? 'Em aberto' : order.pendingNotes ? 'Resolvida' : 'Sem pendência',
      order.pendingReason ? PENDING_REASONS[order.pendingReason] : '', order.pendingNotes || '', order.laborHours,
    ]),
  ]
}
