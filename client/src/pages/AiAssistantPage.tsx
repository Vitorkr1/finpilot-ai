import { useState, type FormEvent } from 'react'
import { AppLayout } from '../components/AppLayout'
import { api } from '../lib/api'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function AiAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAsk(e: FormEvent) {
    e.preventDefault()
    if (!question.trim()) return
    const userMessage: ChatMessage = { role: 'user', content: question }
    setMessages((prev) => [...prev, userMessage])
    setQuestion('')
    setSending(true)
    setError(null)
    try {
      const { data } = await api.post<{ answer: string }>('/ai/ask', { question: userMessage.content })
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }])
    } catch {
      setError('Não foi possível falar com o assistente agora.')
    } finally {
      setSending(false)
    }
  }

  return (
    <AppLayout>
      <h2 className="mb-1 text-xl font-semibold text-slate-900">Assistente de IA</h2>
      <p className="mb-4 text-sm text-slate-500">
        Tire dúvidas sobre o uso do CriaOS. Para rascunhar um orçamento com IA, use o botão
        correspondente na página de Orçamentos.
      </p>

      <div className="mb-4 min-h-[16rem] space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        {messages.length === 0 && <p className="text-sm text-slate-400">Faça uma pergunta para começar.</p>}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <span
              className={`inline-block max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                m.role === 'user' ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-800'
              }`}
            >
              {m.content}
            </span>
          </div>
        ))}
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleAsk} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Como faço para converter um orçamento em OS?"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {sending ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </AppLayout>
  )
}
