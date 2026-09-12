import { useEffect, useRef, useState } from 'react'
import { AppLayout } from '../components/AppLayout'
import { api } from '../lib/api'

type Status = 'disconnected' | 'connecting' | 'qr' | 'connected' | 'reconnecting'

interface StatusResponse {
  status: Status
  qr: string | null
}

const STATUS_LABEL: Record<Status, string> = {
  disconnected: 'Desconectado',
  connecting: 'Conectando...',
  qr: 'Aguardando leitura do QR code',
  connected: 'Conectado',
  reconnecting: 'Reconectando...',
}

export function WhatsAppSettingsPage() {
  const [status, setStatus] = useState<StatusResponse>({ status: 'disconnected', qr: null })
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function refreshStatus() {
    try {
      const { data } = await api.get<StatusResponse>('/whatsapp/status')
      setStatus(data)
    } catch {
      // silencioso — a próxima checagem periódica tenta de novo
    }
  }

  useEffect(() => {
    refreshStatus()
    pollRef.current = setInterval(refreshStatus, 4000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  async function connect() {
    setError(null)
    try {
      await api.post('/whatsapp/connect')
      await refreshStatus()
    } catch {
      setError('Não foi possível iniciar a conexão com o WhatsApp.')
    }
  }

  async function disconnect() {
    setError(null)
    try {
      await api.post('/whatsapp/disconnect')
      await refreshStatus()
    } catch {
      setError('Não foi possível desconectar.')
    }
  }

  return (
    <AppLayout>
      <h2 className="mb-1 text-xl font-semibold text-slate-900">WhatsApp</h2>
      <p className="mb-4 text-sm text-slate-500">
        Conecte o número de WhatsApp Business da empresa para atender clientes com triagem por
        IA. Use um número dedicado para testes, nunca o número pessoal do dono da empresa.
      </p>

      <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
        <p className="mb-4 text-sm font-medium text-slate-700">{STATUS_LABEL[status.status]}</p>

        {status.status === 'qr' && status.qr && (
          <img src={status.qr} alt="QR code do WhatsApp" className="mx-auto mb-4 h-56 w-56" />
        )}

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="flex justify-center gap-2">
          {status.status === 'disconnected' ? (
            <button
              onClick={connect}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              Conectar WhatsApp
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Desconectar
            </button>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
