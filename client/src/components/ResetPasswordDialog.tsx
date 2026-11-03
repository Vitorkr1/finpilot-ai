import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, endTenantSession } from '../lib/api'
import type { User } from '../lib/types'
import './reset-password.css'

interface ResetResult { tempPassword: string; selfReset: boolean }

export function ResetPasswordDialog({ target, ownId, onClose }: { target: User; ownId?: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const inFlight = useRef(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ResetResult | null>(null)
  const [copied, setCopied] = useState(false)
  const isSelf = target._id === ownId

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => { element?.close() }
  }, [])

  async function reset(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setPending(true); setError('')
    try {
      const { data } = await api.post<ResetResult>(`/company-users/${target._id}/reset-password`, { confirm: true, currentPassword })
      setResult(data)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Não foi possível confirmar a troca. Confira sua conexão antes de tentar novamente.')
    } finally {
      setCurrentPassword(''); setPending(false); inFlight.current = false
    }
  }

  async function copy() {
    if (!result) return
    try { await navigator.clipboard.writeText(result.tempPassword); setCopied(true); setError('') }
    catch { setError('Selecione a senha abaixo e copie manualmente.') }
  }

  function finish() {
    const selfReset = result?.selfReset
    setResult(null)
    onClose()
    if (selfReset) endTenantSession()
  }

  return <dialog ref={dialog} className="password-reset-dialog" aria-labelledby="password-reset-title" aria-describedby="password-reset-description"
    onCancel={(event) => { if (pending || result) event.preventDefault(); else onClose() }}>
    <p className="password-reset-eyebrow">ACESSOS DA EQUIPE</p>
    <h2 id="password-reset-title">{result ? 'Nova senha gerada' : 'Redefinir senha'}</h2>
    <p id="password-reset-description" className="password-reset-person"><strong>{target.name}</strong><span>{target.email}{isSelf ? ' · Sua conta' : ''}</span></p>
    {result ? <>
      <p className="password-reset-success" role="status">Senha alterada. A senha anterior e os acessos antigos foram desativados.</p>
      <p className="password-reset-copy">Copie agora. Esta senha será exibida somente nesta tela e desaparecerá ao fechar ou recarregar a página.</p>
      <label className="form-field"><span>Nova senha</span><input className="password-reset-secret" value={result.tempPassword} readOnly autoComplete="off" spellCheck={false} onFocus={(event) => event.target.select()} /></label>
      {result.selfReset && <p className="password-reset-copy">Seu acesso anterior também foi encerrado. Guarde a nova senha antes de voltar ao login.</p>}
      {error && <p className="password-reset-error" role="alert">{error}</p>}
      <div className="password-reset-actions"><button type="button" className="secondary-button" onClick={copy}>{copied ? 'Senha copiada' : 'Copiar nova senha'}</button><button type="button" className="primary-button" onClick={finish}>{result.selfReset ? 'Já guardei, entrar novamente' : 'Já guardei, fechar'}</button></div>
    </> : <form onSubmit={reset}>
      <div className="password-reset-warning" role="note"><strong>Antes de continuar</strong><p>A senha anterior deixará de funcionar. As sessões e rotas ativas deste usuário serão encerradas.</p><p>A nova senha aparecerá somente uma vez. Copie e entregue diretamente ao usuário.</p>{isSelf && <p><strong>Esta é a sua conta.</strong> Você precisará entrar novamente com a nova senha.</p>}{!target.active && <p>O usuário continuará inativo. Redefinir a senha não libera o acesso.</p>}</div>
      <label className="form-field"><span>Sua senha atual de administrador</span><input type="password" autoComplete="current-password" required maxLength={256} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={pending} /></label>
      {error && <p className="password-reset-error" role="alert">{error}</p>}
      <div className="password-reset-actions"><button type="button" className="secondary-button" disabled={pending} onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={pending || !currentPassword}>{pending ? 'Gerando nova senha…' : 'Confirmar e gerar nova senha'}</button></div>
    </form>}
  </dialog>
}
