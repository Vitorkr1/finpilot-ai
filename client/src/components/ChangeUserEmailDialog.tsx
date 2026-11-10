import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, endTenantSession } from '../lib/api'
import type { User } from '../lib/types'
import './reset-password.css'

interface Result { user: User; selfChange: boolean }
export function ChangeUserEmailDialog({ target, ownId, onClose, onChanged }: { target: User; ownId?: string; onClose: () => void; onChanged: (user: User) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const inFlight = useRef(false)
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const isSelf = target._id === ownId

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  async function change(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true; setPending(true); setError('')
    try {
      const { data } = await api.patch<Result>(`/company-users/${target._id}/email`, { email, expectedEmail: target.email, currentPassword, confirm: true })
      setResult(data); onChanged(data.user)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Não foi possível confirmar a alteração. Confira a equipe antes de tentar novamente.')
    } finally { setCurrentPassword(''); setPending(false); inFlight.current = false }
  }

  function finish() {
    onClose()
    if (result?.selfChange) endTenantSession()
  }

  return <dialog ref={dialog} className="password-reset-dialog" aria-labelledby="change-email-title" aria-describedby="change-email-person" onCancel={event => { if (inFlight.current || result?.selfChange) event.preventDefault(); else onClose() }}>
    <p className="password-reset-eyebrow">ACESSOS DA EQUIPE</p>
    <h2 id="change-email-title">{result ? 'E-mail alterado' : 'Alterar e-mail de acesso'}</h2>
    <p id="change-email-person" className="password-reset-person"><strong>{target.name}{isSelf ? ' · Sua conta' : ''}</strong><span>{target.email}</span></p>
    {result ? <>
      <p className="password-reset-success" role="status">O próximo login deve usar o novo e-mail e a mesma senha de antes.</p>
      <label className="form-field"><span>Novo e-mail de acesso</span><input type="email" readOnly value={result.user.email} onFocus={event => event.target.select()} /></label>
      <p className="password-reset-copy">As sessões anteriores e a rota ativa deste usuário foram encerradas. Avise o usuário sobre o novo e-mail.</p>
      {!result.user.active && <p className="password-reset-copy">Este usuário continua inativo. Para permitir o login, ative o acesso na equipe.</p>}
      {result.selfChange && <p className="password-reset-copy"><strong>Esta é a sua conta.</strong> Ao continuar, você voltará ao login para entrar com o novo e-mail.</p>}
      <div className="password-reset-actions"><button type="button" className="primary-button" onClick={finish}>{result.selfChange ? 'Entrar com o novo e-mail' : 'Concluir'}</button></div>
    </> : <form onSubmit={change}>
      <div className="password-reset-warning"><strong>Antes de alterar</strong><p>O e-mail antigo deixará de permitir o login. A senha será mantida.</p><p>As sessões e a rota ativa deste usuário serão encerradas.</p>{isSelf && <p>Você precisará entrar novamente com o novo e-mail.</p>}</div>
      <label className="form-field"><span>Novo e-mail de acesso</span><input type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={pending} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" /></label>
      <label className="form-field mt-4"><span>Sua senha atual de administrador</span><input type="password" required maxLength={256} autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} disabled={pending} /></label>
      {error && <p role="alert" className="password-reset-error">{error}</p>}
      <div className="password-reset-actions"><button type="button" className="secondary-button" disabled={pending} onClick={onClose}>Voltar</button><button type="submit" className="primary-button" disabled={pending || !currentPassword || !email.trim() || email.trim().toLowerCase() === target.email.toLowerCase()}>{pending ? 'Alterando…' : 'Confirmar alteração de e-mail'}</button></div>
    </form>}
  </dialog>
}
