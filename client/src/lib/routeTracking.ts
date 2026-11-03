export interface RoutePosition {
  latitude: number
  longitude: number
  accuracy: number
  provider?: 'gps' | 'network'
  capturedAt: string
  receivedAt: string
}

export interface RouteSession {
  _id: string
  startedAt: string
  expiresAt: string
  position: RoutePosition | null
  technician?: { _id: string; name: string }
}

export const MAX_ACCURACY_METERS = 50
export const FRESH_POSITION_MS = 30000
export function canPlotPosition(position: RoutePosition | null, now = Date.now()): position is RoutePosition {
  return !!position && Number.isFinite(position.latitude) && Math.abs(position.latitude) <= 90
    && Number.isFinite(position.longitude) && Math.abs(position.longitude) <= 180
    && Number.isFinite(position.accuracy) && position.accuracy > 0 && position.accuracy <= MAX_ACCURACY_METERS
    && Number.isFinite(Date.parse(position.capturedAt)) && Date.parse(position.capturedAt) <= now + 5000
}

export function positionStatus(position: RoutePosition | null, now = Date.now()) {
  if (!canPlotPosition(position, now)) return { label: 'Aguardando GPS preciso', tone: 'waiting' }
  const age = Math.max(0, now - new Date(position.capturedAt).getTime())
  if (age > FRESH_POSITION_MS) return { label: 'Posição desatualizada', tone: 'stale' }
  if (position.accuracy > 25) return { label: 'Precisão limitada', tone: 'limited' }
  return { label: 'Posição recente', tone: 'recent' }
}
