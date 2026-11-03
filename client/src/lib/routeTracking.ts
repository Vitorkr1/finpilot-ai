export interface RoutePosition {
  latitude: number
  longitude: number
  accuracy: number
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

export function positionStatus(position: RoutePosition | null, now = Date.now()) {
  if (!position) return { label: 'Aguardando GPS', tone: 'waiting' }
  const age = Math.max(0, now - new Date(position.capturedAt).getTime())
  if (age > 120000) return { label: 'Posição desatualizada', tone: 'stale' }
  if (position.accuracy > 100) return { label: 'Precisão reduzida', tone: 'waiting' }
  return { label: 'Posição recente', tone: 'recent' }
}
