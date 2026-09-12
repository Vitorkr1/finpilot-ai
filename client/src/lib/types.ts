export type Role = 'super_admin' | 'admin' | 'financeiro' | 'tecnico'
export type Plan = 'basic' | 'pro'
export type SubscriptionStatus = 'active' | 'overdue' | 'suspended'

export interface Company {
  _id: string
  name: string
  cnpj?: string
  segment: string
  plan: Plan
  price: number | null
  subscriptionStatus: SubscriptionStatus
  nextDueDate?: string
}

export interface User {
  _id: string
  companyId: string | null
  name: string
  email: string
  role: Role
  active: boolean
}

export interface Client {
  _id: string
  name: string
  phone?: string
  document?: string
  address?: string
  notes?: string
}

export interface BudgetItem {
  description: string
  qty: number
  unitPrice: number
}

export type BudgetStatus = 'rascunho' | 'enviado' | 'aprovado' | 'recusado'

export interface Budget {
  _id: string
  clientId: string
  items: BudgetItem[]
  total: number
  status: BudgetStatus
  convertedToServiceOrder: boolean
  createdAt: string
}

export type ServiceOrderStatus = 'aberta' | 'em_andamento' | 'concluida' | 'cancelada'

export interface ChecklistItem {
  item: string
  done: boolean
}

export interface ServiceOrder {
  _id: string
  clientId: string
  budgetId: string | null
  technicianId: string | null
  segment: string
  checklist: ChecklistItem[]
  photos: string[]
  signatureUrl: string | null
  laborHours: number
  status: ServiceOrderStatus
  createdAt: string
}

export type AppointmentStatus = 'agendado' | 'confirmado' | 'concluido' | 'cancelado'

export interface Appointment {
  _id: string
  technicianId: string
  serviceOrderId: string | null
  date: string
  startTime: string
  endTime: string
  status: AppointmentStatus
}
