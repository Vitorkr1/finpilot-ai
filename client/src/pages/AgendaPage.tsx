import { useEffect, useState, type FormEvent } from 'react'
import { AppLayout } from '../components/AppLayout'
import { localDateISO } from '../lib/format'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import type { Appointment, User } from '../lib/types'

function todayISO() {
  return localDateISO()
}

export function AgendaPage() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [technicians, setTechnicians] = useState<User[]>([])
  const [date, setDate] = useState(todayISO())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    technicianId: '',
    startTime: '08:00',
    endTime: '09:00',
  })
  const [submitting, setSubmitting] = useState(false)

  async function loadAppointments(forDate: string) {
    setLoading(true)
    try {
      const { data } = await api.get<Appointment[]>('/appointments', {
        params: { date: forDate },
      })
      setAppointments(data)
    } catch {
      setError('Não foi possível carregar a agenda.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAppointments(date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  useEffect(() => {
    if (user?.role !== 'admin') return
    api
      .get<User[]>('/company-users')
      .then(({ data }) => {
        const techs = data.filter((u) => u.role === 'tecnico')
        setTechnicians(techs)
        if (techs[0]) setForm((f) => ({ ...f, technicianId: techs[0]._id }))
      })
      .catch(() => {})
  }, [user])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (form.endTime <= form.startTime) {
      setError('O horário final precisa ser posterior ao inicial.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/appointments', { ...form, date })
      await loadAppointments(date)
    } catch {
      setError('Não foi possível criar o agendamento.')
    } finally {
      setSubmitting(false)
    }
  }

  function technicianName(id: string) {
    return technicians.find((t) => t._id === id)?.name || 'Técnico'
  }

  return (
    <AppLayout>
      <h2 className="mb-4 text-xl font-semibold text-slate-900">Agenda</h2>
      <p className="page-description">
        Sua equipe no lugar certo, na hora certa. Planeje as próximas visitas.
      </p>

      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm text-slate-600">Dia:</label>
        <input
          aria-label="Dia da agenda"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {user?.role === 'admin' && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4"
        >
          <select
            required
            value={form.technicianId}
            onChange={(e) => setForm({ ...form, technicianId: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Técnico
            </option>
            {technicians.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            aria-label="Horário inicial"
            type="time"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            aria-label="Horário final"
            type="time"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={submitting || !form.technicianId}
            className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {submitting ? 'Agendando...' : 'Agendar'}
          </button>
          {technicians.length === 0 && (
            <p className="sm:col-span-4 text-sm text-slate-500">
              Cadastre um técnico em "Usuários da empresa" para agendar visitas.
            </p>
          )}
        </form>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : appointments.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhum agendamento para este dia.
        </p>
      ) : (
        <div className="space-y-2">
          {appointments.map((a) => (
            <div
              key={a._id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm"
            >
              <span className="font-medium text-slate-900">
                {a.startTime}–{a.endTime}
              </span>
              <span className="text-slate-600">
                {technicianName(a.technicianId)}
              </span>
              <span className="text-xs text-slate-500">{a.status}</span>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  )
}
