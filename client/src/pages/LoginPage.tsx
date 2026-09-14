import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icon'
export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch {
      setError(
        'Não foi possível entrar. Confira suas credenciais e sua conexão.',
      )
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <a href="https://www.criatech.online" className="brand-lockup">
          <span className="brand-mark">
            <Icon name="spark" size={25} />
          </span>
          <span>
            cria<span className="brand-os">OS</span>
            <small>BY CRIA TECH</small>
          </span>
        </a>
        <div className="login-story-content">
          <span className="story-tag">
            <span />
            TECNOLOGIA QUE FAZ ACONTECER
          </span>
          <h1>
            Sua operação.
            <br />
            Seu próximo
            <br />
            <em>grande passo.</em>
          </h1>
          <p>
            O sistema que conecta sua equipe, organiza seus serviços e acompanha
            o crescimento da sua empresa.
          </p>
          <div className="story-features">
            <span>
              <Icon name="check" size={16} />
              Gestão em um só lugar
            </span>
            <span>
              <Icon name="check" size={16} />
              Mais tempo para crescer
            </span>
          </div>
          <div className="story-card">
            <span className="story-card-icon">
              <Icon name="tool" size={23} />
            </span>
            <div>
              <strong>Do orçamento à entrega.</strong>
              <p>Cada etapa conectada. Cada detalhe sob controle.</p>
            </div>
            <Icon name="arrow" />
          </div>
        </div>
        <p className="story-footer">
          Feito por Cria Tech. Pensado para quem faz.
        </p>
      </section>
      <section className="login-form-side">
        <div className="login-form-wrap">
          <span className="login-welcome">
            <Icon name="shield" size={20} />
          </span>
          <p className="eyebrow">BEM-VINDO AO SEU WORKSPACE</p>
          <h2>Bom ter você de volta.</h2>
          <p className="login-description">
            Entre na sua conta e continue de onde parou.
          </p>
          <form onSubmit={handleSubmit} className="login-form">
            <div>
              <label htmlFor="email">E-mail profissional</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@suaempresa.com.br"
              />
            </div>
            <div>
              <label htmlFor="password">Senha</label>
              <div className="password-field">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
            {error && (
              <p role="alert" className="login-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="primary-button full-width"
            >
              {submitting ? 'Entrando...' : 'Entrar no workspace'}
              <Icon name="arrow" size={18} />
            </button>
          </form>
          <p className="login-help">
            Precisa de acesso ou esqueceu a senha?
            <br />
            <a
              href="https://wa.me/5581996744143"
              target="_blank"
              rel="noreferrer"
            >
              Fale com nosso suporte <Icon name="arrow" size={14} />
            </a>
          </p>
          <div className="login-security">
            <Icon name="shield" size={15} />
            Acesso exclusivo para sua empresa
          </div>
        </div>
        <footer className="login-footer">
          <span>© {new Date().getFullYear()} Cria Tech</span>
          <a
            href="https://www.criatech.online"
            target="_blank"
            rel="noreferrer"
          >
            Conheça a Cria Tech ↗
          </a>
        </footer>
      </section>
    </div>
  )
}
