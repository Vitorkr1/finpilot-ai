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
