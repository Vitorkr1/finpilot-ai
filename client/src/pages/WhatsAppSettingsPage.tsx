import { useEffect, useRef, useState } from 'react'
import { AppLayout } from '../components/AppLayout'
import { Icon } from '../components/Icon'
import { api } from '../lib/api'

type Status =
  'disconnected' | 'connecting' | 'qr' | 'connected' | 'reconnecting'

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
  const [status, setStatus] = useState<StatusResponse>({
    status: 'disconnected',
    qr: null,
  })
  const [busy, setBusy] = useState(false)
  const [statusError, setStatusError] = useState(false)
  const [statusLoading, setStatusLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function refreshStatus() {
    try {
      const { data } = await api.get<StatusResponse>('/whatsapp/status')
      setStatus(data)
      setStatusError(false)
    } catch {
      setStatusError(true)
    } finally {
      setStatusLoading(false)
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
    setBusy(true)
    try {
      await api.post('/whatsapp/connect')
      await refreshStatus()
    } catch {
      setError('Não foi possível iniciar a conexão com o WhatsApp.')
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setError(null)
    setBusy(true)
    try {
      await api.post('/whatsapp/disconnect')
      await refreshStatus()
    } catch {
      setError('Não foi possível desconectar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppLayout>
      <h2 className="mb-1 text-xl font-semibold text-slate-900">WhatsApp</h2>
      <p className="mb-4 text-sm text-slate-500">
        Conecte o número de WhatsApp Business da empresa para atender clientes
        com triagem por IA. Use um número dedicado para testes, nunca o número
        pessoal do dono da empresa.
      </p>

      <div className="integration-grid">
        <section className="panel">
          <span className="empty-icon inline-flex">
            <Icon name="chat" size={28} />
          </span>
          <h3 className="text-lg font-semibold mb-4">
            Seu atendimento, conectado.
          </h3>
          <ol className="space-y-5 text-sm text-slate-500">
            <li>
              <strong className="text-slate-800">01. Inicie a conexão</strong>
              <p className="mt-1">Clique em conectar para gerar o QR code.</p>
            </li>
            <li>
              <strong className="text-slate-800">
                02. Abra o WhatsApp da empresa
              </strong>
              <p className="mt-1">
                Em Dispositivos conectados, escolha conectar um dispositivo.
              </p>
            </li>
            <li>
              <strong className="text-slate-800">03. Escaneie o código</strong>
              <p className="mt-1">
                Acompanhe o status da conexão neste painel.
              </p>
            </li>
          </ol>
        </section>
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="mb-4 text-sm font-medium text-slate-700">
            {statusLoading
              ? 'Verificando conexão...'
              : statusError
                ? 'Conexão não verificada'
                : STATUS_LABEL[status.status]}
          </p>

          {status.status === 'qr' && status.qr && (
            <img
              src={status.qr}
              alt="QR code do WhatsApp"
              className="mx-auto mb-4 h-56 w-56"
            />
          )}

          {statusError && (
            <p role="alert" className="mb-4 text-sm text-amber-700">
              Não foi possível consultar a conexão. Tentaremos novamente
              automaticamente.
            </p>
          )}
          {error && (
            <p role="alert" className="mb-4 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex justify-center gap-2">
            {status.status === 'disconnected' ? (
              <button
                disabled={busy || statusLoading || statusError}
                onClick={connect}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                Conectar WhatsApp
              </button>
            ) : (
              <button
                disabled={busy || statusLoading || statusError}
                onClick={disconnect}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Desconectar
              </button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
