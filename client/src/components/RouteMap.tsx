import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { RouteSession } from '../lib/routeTracking'
import { positionStatus } from '../lib/routeTracking'

export default function RouteMap({ sessions, selectedId, now }: { sessions: RouteSession[]; selectedId: string | null; now: number }) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef<L.LayerGroup | null>(null)
  const previousSelection = useRef<string | null>(null)
  const hadPositions = useRef(false)
  useEffect(() => {
    if (!host.current) return
    map.current = L.map(host.current, { scrollWheelZoom: false }).setView([-14.2, -51.9], 4)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map.current)
    markers.current = L.layerGroup().addTo(map.current)
    const observer = new ResizeObserver(() => map.current?.invalidateSize())
    observer.observe(host.current)
    return () => { observer.disconnect(); map.current?.remove(); map.current = null }
  }, [])
  useEffect(() => {
    const layer = markers.current, instance = map.current
    if (!layer || !instance) return
    layer.clearLayers()
    const points: L.LatLngExpression[] = []
    for (const session of sessions) {
      const p = session.position
      if (!p) continue
      const latlng: L.LatLngExpression = [p.latitude, p.longitude]
      points.push(latlng)
      const status = positionStatus(p, now)
      const color = status.tone === 'recent' ? '#28765a' : '#b37925'
      const label = document.createElement('span')
      label.textContent = `${session.technician?.name || 'Técnico'} · ${status.label}`
      L.circleMarker(latlng, { radius: session._id === selectedId ? 10 : 7, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 })
        .bindTooltip(label, { direction: 'top' }).addTo(layer)
      if (session._id === selectedId) {
        L.circle(latlng, { radius: Math.max(p.accuracy, 5), color, weight: 1, fillOpacity: 0.08 }).addTo(layer)
        if (previousSelection.current !== selectedId) instance.setView(latlng, 15)
      }
    }
    if (!hadPositions.current && points.length && !selectedId) instance.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 15 })
    hadPositions.current = points.length > 0
    previousSelection.current = selectedId
  }, [sessions, selectedId, now])
  return <div ref={host} className="route-map" role="region" aria-label="Mapa com as últimas posições dos técnicos" />
}
