import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, MessageCircle, ShieldCheck, UsersRound } from 'lucide-react'
import Brand from '../components/Brand.jsx'
import { getLoginProviders, signInWithProvider } from '../services/auth.js'
import { loginErrorMessage } from '../services/loginOptions.js'
import './welcome.css'

function GoogleMark() {
  return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.13H3.07v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.91A6 6 0 0 1 6.1 12c0-.66.11-1.3.31-1.91V7.5H3.07A10 10 0 0 0 2 12c0 1.61.38 3.14 1.07 4.5l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.82 1.5l2.86-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.5l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"/></svg>
}
function ProviderMark({ provider }) {
  if (provider === 'google') return <GoogleMark />
  if (provider === 'azure') return <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path fill="#f25022" d="M1 1h9v9H1z"/><path fill="#7fba00" d="M12 1h9v9h-9z"/><path fill="#00a4ef" d="M1 12h9v9H1z"/><path fill="#ffb900" d="M12 12h9v9h-9z"/></svg>
  const labels = { github: 'GH', facebook: 'f', apple: 'A', discord: 'D', linkedin_oidc: 'in' }
  return <span className={`entry-provider-mark entry-provider-mark--${provider}`} aria-hidden="true">{labels[provider]}</span>
}

export function WelcomeContent({ providers, loading, error, busy, onLogin, onRetry }) {
  const google = providers.find((entry) => entry.id === 'google')
  const others = providers.filter((entry) => entry.id !== 'google')
  function providerButton(provider) {
    return <button type="button" key={provider.id} className={`entry-provider ${provider.id === 'google' ? 'entry-provider--google' : ''}`} disabled={!!busy} onClick={() => onLogin(provider.id)}><ProviderMark provider={provider.id} /><span>{busy === provider.id ? 'Abrindo login…' : `Continuar com ${provider.label}`}</span><ArrowUpRight size={17} aria-hidden="true" /></button>
  }
  return <main className="entry-page">
    <header className="entry-header"><Brand /><span>Ideias que aproximam.</span></header>
    <div className="entry-main">
      <section className="entry-story" aria-labelledby="entry-headline">
        <p className="entry-eyebrow"><span /> ENCONTRE SEU ESPAÇO</p>
        <h1 id="entry-headline">Pessoas.{' '}<br />Ideias.<br /><span>Conexões reais.</span></h1>
        <p className="entry-intro">Uma conversa pode ser o começo de algo. Entre no Itext para compartilhar seu mundo e fazer parte da comunidade.</p>
        <div className="entry-features"><div><UsersRound size={21} aria-hidden="true"/><p><strong>Seu lugar na comunidade</strong><span>Compartilhe ideias e participe de grupos.</span></p></div><div><MessageCircle size={21} aria-hidden="true"/><p><strong>Conversas que continuam</strong><span>Mensagens salvas e entrega em tempo real.</span></p></div></div>
        <div className="entry-art" aria-hidden="true"><span /><span /><span /><i>i<span>text</span><ArrowRight size={42} /></i></div>
      </section>
      <section className="entry-card" aria-labelledby="entry-card-title">
        <div className="entry-card-heading"><span className="entry-welcome-mark" aria-hidden="true"><ArrowUpRight size={26}/></span><p>BOAS-VINDAS AO ITEXT</p><h2 id="entry-card-title">Vamos nos conectar?</h2><span>Escolha uma conta para entrar ou criar seu perfil.</span></div>
        {error ? <div className="entry-error" role="alert">{error}</div> : null}
        <div className="entry-providers" aria-busy={loading || !!busy}>
          {loading ? <p className="entry-provider-loading" role="status"><span className="entry-spinner" aria-hidden="true" />Carregando formas de entrar…</p> : <>
            {google ? providerButton(google) : null}
            {google && others.length ? <div className="entry-divider"><span />ou use outra conta<span /></div> : null}
            {others.map(providerButton)}
            {!providers.length ? <><p className="entry-unavailable">Não foi possível disponibilizar uma forma de entrar agora.</p><button type="button" className="entry-retry" onClick={onRetry}>Tentar novamente</button></> : null}
          </>}
        </div>
        {google ? <p className="entry-account-hint">Quer usar outra conta Google? Você poderá escolhê-la na próxima tela.</p> : null}
        <div className="entry-privacy"><ShieldCheck size={20} aria-hidden="true"/><div><strong>Entre sabendo como seus dados são usados.</strong><details><summary>Sobre seu perfil e suas mensagens</summary><p>Seu nome e sua foto ajudam a criar seu perfil público no Itext. As mensagens ficam armazenadas no Itext e podem ser acessadas pelo criador. A proteção adicional com código é opcional.</p><p>Você pode conversar sem configurar um código. Se escolher a proteção adicional, guarde o código para recuperar essas mensagens em aparelhos novos. O PIN de bloqueio do aparelho também é opcional.</p></details></div></div>
      </section>
    </div>
    <footer className="entry-footer"><span>© {new Date().getFullYear()} Itext</span><span>Seu mundo, em movimento.</span></footer>
  </main>
}

export default function WelcomeView({ initialError = '' }) {
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(initialError)
  const [busy, setBusy] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    void getLoginProviders().then((entries) => {
      if (active) { setProviders(entries); if (!entries.length) setError('O login está temporariamente indisponível. Tente novamente em instantes.') }
    }).catch(() => { if (active) { setProviders([]); setError('Não foi possível carregar as formas de entrar. Confira sua conexão e tente novamente.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [retry])
  async function login(provider) {
    if (busy) return
    setBusy(provider); setError('')
    try { await signInWithProvider(provider) }
    catch (issue) {
      if (issue.message === 'Essa forma de entrar não está disponível no momento.') { setError(issue.message); setRetry((value) => value + 1) }
      else setError(loginErrorMessage(issue))
      setBusy('')
    }
  }
  return <WelcomeContent providers={providers} loading={loading} error={error} busy={busy} onLogin={login} onRetry={() => { setError(''); setRetry((value) => value + 1) }} />
}
