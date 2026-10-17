import { useEffect, useRef, useState } from 'react'
import { Search, Send } from 'lucide-react'
import ViewHeader from '../components/ViewHeader.jsx'
import Avatar from '../components/Avatar.jsx'
import { supabase, signInWithGoogle } from '../services/auth.js'
import { mergeMessages, messagesClient } from '../services/messaging.js'
import { privacyClient } from '../services/chatPrivacy.js'
import { recoveryCode } from '../services/chatCrypto.js'

const api = supabase ? messagesClient(supabase) : null
const privacy = supabase ? privacyClient(supabase) : null
const notice = 'As mensagens novas são criptografadas para os participantes e para o criador do Itext. O criador pode ler todas as conversas. Outras contas não têm esse acesso.'

export default function MessagesView({ user, onNotify }) {
  const [people, setPeople] = useState([])
  const [person, setPerson] = useState(null)
  const [review, setReview] = useState(false)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('CONNECTING')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [hasOlder, setHasOlder] = useState(false)
  const [privacyState, setPrivacyState] = useState(null)
  const [session, setSession] = useState(null)
  const [code, setCode] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  const active = useRef(null)
  const pendingSend = useRef(null)
  const end = useRef(null)
  active.current = review ? '__creator__' : person?.id

  useEffect(() => {
    if (!user.authenticated || !privacy) return
    let current = true
    setSession(null); setPrivacyState(null); setError('')
    void Promise.all([privacy.state(), api.people()]).then(([state, rows]) => {
      if (current) { setPrivacyState(state); setPeople(rows) }
    }).catch((issue) => { if (current) setError(issue.message) })
    return () => { current = false }
  }, [user.id, user.authenticated, retry])

  useEffect(() => {
    if (!session) return
    let current = true
    const stop = api.listen(session.id, (row) => {
      const other = row.sender_id === session.id ? row.recipient_id : row.sender_id
      const target = active.current
      if (target !== '__creator__' && (other !== target || (row.sender_id !== session.id && row.recipient_id !== session.id))) return
      void session.decrypt([row]).then((rows) => {
        if (current && target === active.current) setMessages((previous) => mergeMessages(previous, rows))
      }).catch((issue) => { if (current) setError(issue.message) })
    }, (value) => { if (current) setStatus(value) }, session.isOwner)
    return () => { current = false; stop() }
  }, [session])

  useEffect(() => {
    if (!session || (!person && !review)) return
    let current = true
    setLoading(true)
    // Includes reconnect reconciliation, deduplicated against real-time deliveries.
    void (async () => {
      const encrypted = review ? await api.creatorHistory() : await api.history(person.id)
      const rows = await session.decrypt(encrypted)
      if (current) { setMessages((previous) => mergeMessages(previous, rows)); setHasOlder(rows.length === 100) }
    })().catch((issue) => { if (current) setError(issue.message) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [session, person, review, status])
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [messages.length])

  function open(next, asCreator = false) {
    active.current = asCreator ? '__creator__' : next?.id
    setPerson(next); setReview(asCreator); setMessages([]); setDraft(''); setError(''); pendingSend.current = null
  }
  function lock() {
    active.current = null
    setSession(null); setMessages([]); setPerson(null); setReview(false); setDraft(''); setCode(''); pendingSend.current = null
  }
  async function unlock(event) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const unlocked = privacyState.vault ? await privacy.unlock(privacyState, code) : await privacy.activate(privacyState, code)
      setCode(''); setSaved(false)
      setPrivacyState(await privacy.state())
      setSession(unlocked)
    } catch (issue) {
      setError(issue.message)
      // A successful registration followed by a lost reply must be unlocked, never overwritten.
      try { setPrivacyState(await privacy.state()) } catch { /* Original error remains visible. */ }
    } finally { setBusy(false) }
  }
  async function older() {
    if ((!person && !review) || !messages.length || loading) return
    const target = active.current
    setLoading(true)
    try {
      const encrypted = review ? await api.creatorHistory(messages[0]) : await api.history(person.id, messages[0])
      const rows = await session.decrypt(encrypted)
      if (active.current === target) { setMessages((previous) => mergeMessages(previous, rows)); setHasOlder(rows.length === 100) }
    } catch (issue) { setError(issue.message) }
    finally { setLoading(false) }
  }
  async function send(event) {
    event.preventDefault()
    if (!draft.trim() || !person || !session || sending || review) return
    const partner = person.id
    const body = draft.trim()
    if (!pendingSend.current || pendingSend.current.body !== body || pendingSend.current.partner !== partner) pendingSend.current = { id: crypto.randomUUID(), body, partner }
    const pending = pendingSend.current
    setSending(true); setError('')
    try {
      // Reuse the SAME ciphertext and UUID after uncertain network responses.
      pending.payload ||= await session.encrypt(partner, body, pending.id)
      const row = await api.send(pending.payload)
      const rows = await session.decrypt([row])
      if (active.current === partner) { setMessages((previous) => mergeMessages(previous, rows)); setDraft(''); pendingSend.current = null }
    } catch (issue) { setError(`Não foi possível confirmar o envio: ${issue.message}. Você pode tentar novamente.`) }
    finally { setSending(false) }
  }

  if (!user.authenticated) return <main className="feature-view"><ViewHeader title="Mensagens" /><div className="profile-empty"><h2>Entre para conversar.</h2><button className="primary-button" onClick={() => signInWithGoogle().catch((issue) => onNotify(issue.message))}>Entrar com Google</button></div></main>
  const errors = error ? <p className="chat-error" role="alert">{error}</p> : null
  if (!session || session.id !== user.id) return <main className="feature-view"><ViewHeader title="Mensagens protegidas" />{errors}<section className="chat-security">
    <h2>Privacidade das conversas</h2><p>{notice}</p><p>Não é criptografia exclusiva entre os participantes. Publicações, perfis e arquivos seguem suas permissões de acesso; esta criptografia adicional protege o texto das mensagens novas.</p>
    {!privacyState ? <><p>Aguardando configuração das mensagens…</p><button className="secondary-button" onClick={() => setRetry((value) => value + 1)}>Verificar novamente</button></> : !privacyState.ownerReady && !privacyState.isOwner ? <p>O criador precisa ativar sua chave antes de liberar as conversas.</p> : <form onSubmit={unlock}>
      {privacyState.vault ? <><h3>Desbloquear mensagens</h3><label htmlFor="chat-code">Seu código de recuperação</label><input id="chat-code" type="password" autoComplete="off" spellCheck={false} value={code} onChange={(event) => setCode(event.target.value)} required /><p>Seu login Google não substitui esse código. Ele não será enviado ao servidor.</p></> : <><h3>Ativar mensagens criptografadas{privacyState.isOwner ? ' e acesso do criador' : ''}</h3><button type="button" className="secondary-button" disabled={busy} onClick={() => { setCode(recoveryCode()); setSaved(false) }}>Gerar meu código de recuperação</button>{code ? <><label htmlFor="chat-code">Guarde em um gerenciador de senhas ou local seguro</label><input id="chat-code" className="recovery-code" readOnly value={code} onFocus={(event) => event.target.select()} /><p>O código abre suas mensagens em outros aparelhos. Não envie a ninguém. Perder o código impede recuperar sua chave. Não há redefinição automática.</p><label className="chat-consent"><input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />Guardei meu código e entendi que o criador pode ler todas as conversas.</label></> : null}</>}
      <button className="primary-button" disabled={busy || !code || (!privacyState.vault && !saved)}>{busy ? 'Processando…' : privacyState.vault ? 'Desbloquear' : 'Ativar mensagens'}</button>
    </form>}
  </section></main>
  const name = (id) => id === session.id ? 'Você' : people.find((entry) => entry.id === id)?.name || id
  return <main className="feature-view messages-view">
    <ViewHeader title={review ? 'Revisão do criador' : 'Mensagens'} subtitle={status === 'SUBSCRIBED' ? 'Conectado ao chat em tempo real.' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' ? 'Conexão interrompida. Reconectando…' : 'Conectando ao chat…'} />
    <div className="chat-privacy-notice"><p>{notice}</p><button className="secondary-button" onClick={lock}>Bloquear mensagens</button></div>{errors}
    <div className="messages-layout"><aside className="chat-list">
      <label><Search size={18} /><input placeholder="Buscar pessoas" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div>{session.isOwner ? <button className={review ? 'is-active' : ''} onClick={() => open(null, true)}>Revisar todas as mensagens</button> : null}
      {people.filter((entry) => entry.name.toLowerCase().includes(query.toLowerCase())).map((entry) => <button className={person?.id === entry.id ? 'is-active' : ''} key={entry.id} onClick={() => open(entry)}><Avatar src={entry.avatar_url} alt={entry.name} /><span><strong>{entry.name}</strong></span></button>)}</div>
      {!people.length ? <p className="empty-inline">Outras pessoas cadastradas aparecerão aqui.</p> : null}
    </aside><section className="conversation">{person || review ? <>
      <header>{person ? <Avatar src={person.avatar_url} alt={person.name} /> : null}<strong>{review ? 'Todas as conversas — acesso declarado do criador' : person.name}</strong></header>
      <div className="conversation__messages">{hasOlder ? <button className="secondary-button" disabled={loading} onClick={older}>Carregar anteriores</button> : null}{loading ? <p>Carregando mensagens…</p> : !messages.length ? <p className="empty-inline">Nenhuma mensagem nesta conversa.</p> : null}
      {messages.map((row) => <div key={row.id} className={`bubble-row bubble-row--${row.sender_id === session.id ? 'me' : 'them'}`}><div className="message-bubble">{review ? <small>{name(row.sender_id)} → {name(row.recipient_id)}</small> : null}<p>{row.plaintext}</p><small>{row.invalid ? 'Falha na verificação · ' : row.legacy ? 'Anterior à criptografia · ' : 'Criptografada · '}{new Date(row.created_at).toLocaleString('pt-BR')}</small></div></div>)}<div ref={end} /></div>
      {!review ? <form className="message-composer" onSubmit={send}><input aria-label="Mensagem" placeholder={`Mensagem para ${person.name}`} value={draft} maxLength={4000} onChange={(event) => setDraft(event.target.value)} disabled={sending} /><button className="send-button" disabled={sending || !draft.trim()} aria-label="Enviar mensagem"><Send size={17} /></button></form> : <p className="empty-inline">As conversas são apresentadas para revisão. Para responder, abra a pessoa na lista.</p>}
    </> : <div className="profile-empty"><h2>Escolha uma pessoa para conversar.</h2><p>Mensagens novas são criptografadas antes de serem salvas. Guarde seu código para abrir em outro aparelho.</p></div>}</section></div>
  </main>
}
