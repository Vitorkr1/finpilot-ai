import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import type { User } from '../lib/types'
import './reset-password.css'

export function DeleteTeamMemberDialog({ target, onClose, onDeleted }: { target: User; onClose: () => void; onDeleted: (id: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const inFlight = useRef(false)
  const [password, setPassword] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  async function remove(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current || !confirmed) return
    inFlight.current = true; setPending(true); setError('')
    try {
      await api.delete(`/company-users/${target._id}`, { data: { confirm: true, expectedEmail: target.email, currentPassword: password } })
      onDeleted(target._id)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Não foi possível confirmar a exclusão. Feche e atualize a equipe para conferir antes de tentar novamente.')
      setConfirmed(false)
    } finally { setPassword(''); setPending(false); inFlight.current = false }
  }

  return <dialog ref={dialog} className="password-reset-dialog" aria-labelledby="delete-member-title" aria-describedby="delete-member-person" onCancel={event => { if (inFlight.current) event.preventDefault(); else onClose() }}>
    <p className="password-reset-eyebrow">ACESSOS DA EQUIPE</p>
    <h2 id="delete-member-title">Excluir membro definitivamente</h2>
    <p id="delete-member-person" className="password-reset-person"><strong>{target.name}</strong><span>{target.email}</span></p>
    <form onSubmit={remove}>
      <div className="password-reset-warning"><strong>Esta exclusão não pode ser desfeita.</strong><p>A conta será apagada da equipe. O login, as sessões e a rota ativa deste membro serão encerrados.</p><p>As OS, os agendamentos e a auditoria serão preservados, com o nome do membro nos registros anteriores.</p><p>Um cadastro futuro com o mesmo e-mail será uma conta nova e não receberá as OS antigas automaticamente.</p></div>
      <label className="form-field"><span>Sua senha atual de administrador</span><input type="password" required maxLength={256} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={pending} /></label>
      <label className="member-delete-confirm"><input type="checkbox" checked={confirmed} disabled={pending} onChange={event => setConfirmed(event.target.checked)} /><span>Confirmo a exclusão definitiva de {target.name}.</span></label>
      {error && <p className="password-reset-error" role="alert">{error}</p>}
      <div className="password-reset-actions"><button type="button" className="secondary-button" disabled={pending} onClick={onClose}>Voltar</button><button type="submit" className="member-delete-button" disabled={pending || !confirmed || !password}>{pending ? 'Excluindo…' : 'Excluir membro definitivamente'}</button></div>
    </form>
  </dialog>
}
