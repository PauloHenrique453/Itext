import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCheck, Copy, Search, Send, Smile, UsersRound } from 'lucide-react'
import ViewHeader from '../components/ViewHeader.jsx'
import Avatar from '../components/Avatar.jsx'
import { supabase, signInWithGoogle } from '../services/auth.js'
import { mergeMessages, messagesClient, messageWasRead } from '../services/messaging.js'
import { privacyClient } from '../services/chatPrivacy.js'
import { unlockedChatSession, lockChatSession } from '../services/chatSession.js'
import { recoveryCode } from '../services/chatCrypto.js'
import { deviceSecurity } from '../services/deviceSecurity.js'

const api = supabase ? messagesClient(supabase) : null
const privacy = supabase ? privacyClient(supabase) : null
const notice = 'As mensagens são criptografadas para os participantes e para o criador do Itext, que também pode ler as conversas.'

export default function MessagesView({ user, onNotify, initialPerson, onFindPeople }) {
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
  const [session, setSession] = useState(() => unlockedChatSession(user.id))
  const [code, setCode] = useState('')
  const [saved, setSaved] = useState(false)
  const [rememberDevice,setRememberDevice]=useState(false)
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  const [inbox, setInbox] = useState([])
  const [receipts, setReceipts] = useState([])
  const [messageSearch, setMessageSearch] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const [readTick, setReadTick] = useState(0)
  const lastMarked = useRef('')
  const requestedPerson = useRef('')
  const drafts = useRef(new Map())
  const scrollArea = useRef(null)
  const active = useRef(null)
  const pendingSend = useRef(null)
  const pendingSends = useRef(new Map())
  const end = useRef(null)
  active.current = review ? '__creator__' : person?.id

  useEffect(() => {
    if (!user.authenticated || !privacy) return
    let current = true
    setSession(unlockedChatSession(user.id)); setPrivacyState(null); setError('')
    void Promise.all([privacy.state(), api.people(), api.inbox(), api.receipts()]).then(async ([state, rows, summary, reads]) => {
      let unlocked=unlockedChatSession(user.id)
      if(!unlocked){try{unlocked=await privacy.restore(state)}catch(issue){if(current)setError(issue.message)}}
      if (current) { setPrivacyState(state); setPeople(rows); setInbox(summary); setReceipts(reads);setSession(unlocked) }
    }).catch((issue) => { if (current) setError(issue.message) })
    return () => { current = false }
  }, [user.id, user.authenticated, retry])

  useEffect(() => {
    if (!session) return
    let current = true
    const refreshInbox = () => { void api.inbox().then((rows) => { if (current) setInbox(rows) }).catch(() => {}) }
    const stop = api.listen(session.id, (row) => {
      refreshInbox()
      const other = row.sender_id === session.id ? row.recipient_id : row.sender_id
      const target = active.current
      if (target !== '__creator__' && (other !== target || (row.sender_id !== session.id && row.recipient_id !== session.id))) return
      void session.decrypt([row]).then((rows) => {
        if (current && target === active.current) setMessages((previous) => mergeMessages(previous, rows))
      }).catch((issue) => { if (current) setError(issue.message) })
    }, (value) => { if (current) { setStatus(value); if (value === 'SUBSCRIBED') { refreshInbox(); void api.receipts().then((rows) => { if (current) setReceipts(rows) }).catch(() => {}) } } }, session.isOwner, (receipt) => {
      if (!current) return
      setReceipts((rows) => [...rows.filter((row) => row.user_id !== receipt.user_id || row.partner_id !== receipt.partner_id), receipt]); refreshInbox()
    })
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
  useEffect(() => { if (atBottom) end.current?.scrollIntoView({ block: 'nearest' }) }, [messages.length, atBottom])
  useEffect(() => {
    const visible = () => setReadTick((value) => value + 1)
    window.addEventListener('focus', visible); document.addEventListener('visibilitychange', visible)
    return () => { window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible) }
  }, [])
  useEffect(() => {
    if (!session || !person || review || messageSearch || !atBottom || document.visibilityState !== 'visible' || !document.hasFocus()) return
    const received = messages.filter((row) => row.sender_id === person.id && !row.invalid).at(-1)
    if (!received || received.id === lastMarked.current) return
    lastMarked.current = received.id
    void api.markRead(received.id).catch(() => { if (lastMarked.current === received.id) lastMarked.current = '' })
  }, [messages, person, review, session, messageSearch, atBottom, readTick])
  useEffect(() => {
    if (!initialPerson || requestedPerson.current === initialPerson.id) return
    let current = true
    void api.person(initialPerson.id).then((found) => {
      if (!current) return
      requestedPerson.current = found.id
      setPeople((rows) => rows.some((row) => row.id === found.id) ? rows : [...rows,found])
      open(found)
    }).catch((issue) => { if (current) setError(issue.message) })
    return () => { current = false }
  }, [initialPerson?.id])
  useEffect(() => {
    if (!session) return
    let current = true
    const timer = setInterval(() => { void Promise.all([api.people(), api.inbox()]).then(([rows, summary]) => { if (current) { setPeople(rows); setInbox(summary) } }).catch(() => {}) }, 30000)
    return () => { current = false; clearInterval(timer) }
  }, [session])

  function open(next, asCreator = false) {
    if (active.current && active.current !== '__creator__') drafts.current.set(active.current, draft)
    active.current = asCreator ? '__creator__' : next?.id
    setMessageSearch(''); setAtBottom(true); lastMarked.current = ''
    setPerson(next); setReview(asCreator); setMessages([]); setDraft(drafts.current.get(next?.id) || ''); setError(''); pendingSend.current = pendingSends.current.get(next?.id) || null
  }
  async function lock() {
    try{await deviceSecurity.forget(user.id)}catch(issue){setError(issue.message);return}
    active.current = null
    lockChatSession(); drafts.current.clear(); pendingSends.current.clear()
    setSession(null); setMessages([]); setPerson(null); setReview(false); setDraft(''); setCode(''); pendingSend.current = null
  }
  async function unlock(event) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const unlocked = privacyState.vault ? await privacy.unlock(privacyState, code,{remember:rememberDevice}) : await privacy.activate(privacyState, code,{remember:rememberDevice})
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
    pendingSends.current.set(partner, pending)
    setSending(true); setError('')
    try {
      // Reuse the SAME ciphertext and UUID after uncertain network responses.
      pending.payload ||= await session.encrypt(partner, body, pending.id)
      const row = await api.send(pending.payload)
      const rows = await session.decrypt([row])
      pendingSends.current.delete(partner)
      if (drafts.current.get(partner)?.trim() === body) drafts.current.delete(partner)
      if (active.current === partner) { setMessages((previous) => mergeMessages(previous, rows)); setDraft(''); drafts.current.delete(partner); setAtBottom(true); pendingSend.current = null }
    } catch (issue) { setError(`Não foi possível confirmar o envio: ${issue.message}. Você pode tentar novamente.`) }
    finally { setSending(false) }
  }

  if (!user.authenticated) return <main className="feature-view"><ViewHeader title="Mensagens" /><div className="profile-empty"><h2>Entre para conversar.</h2><button className="primary-button" onClick={() => signInWithGoogle().catch((issue) => onNotify(issue.message))}>Entrar com Google</button></div></main>
  const errors = error ? <p className="chat-error" role="alert">{error}</p> : null
  if (!session || session.id !== user.id) return <main className="feature-view"><ViewHeader title="Mensagens protegidas" />{errors}<section className="chat-security">
    <h2>Privacidade das conversas</h2><p>{notice}</p><p>Não é criptografia exclusiva entre os participantes. Publicações, perfis e arquivos seguem suas permissões de acesso; esta criptografia adicional protege o texto das mensagens novas.</p>
    {!privacyState ? <><p>Aguardando configuração das mensagens…</p><button className="secondary-button" onClick={() => setRetry((value) => value + 1)}>Verificar novamente</button></> : !privacyState.ownerReady && !privacyState.isOwner ? <p>O criador precisa ativar sua chave antes de liberar as conversas.</p> : <form onSubmit={unlock}>
      {privacyState.vault ? <><h3>Desbloquear mensagens</h3><label htmlFor="chat-code">Seu código de recuperação</label><input id="chat-code" type="password" autoComplete="off" spellCheck={false} value={code} onChange={(event) => setCode(event.target.value)} required /><p>Seu login Google não substitui esse código. Ele não será enviado ao servidor.</p></> : <><h3>Ativar mensagens criptografadas{privacyState.isOwner ? ' e acesso do criador' : ''}</h3><button type="button" className="secondary-button" disabled={busy} onClick={() => { setCode(recoveryCode()); setSaved(false) }}>Gerar meu código de recuperação</button>{code ? <><label htmlFor="chat-code">Guarde em um gerenciador de senhas ou local seguro</label><input id="chat-code" className="recovery-code" readOnly value={code} onFocus={(event) => event.target.select()} /><p>O código abre suas mensagens em outros aparelhos. Não envie a ninguém. Perder o código impede recuperar sua chave. Não há redefinição automática.</p><label className="chat-consent"><input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />Guardei meu código e entendi que o criador pode ler todas as conversas.</label></> : null}</>}
<label className="chat-consent"><input type="checkbox" checked={rememberDevice} onChange={event=>setRememberDevice(event.target.checked)}/>Lembrar neste aparelho</label><p className="form-note">Use apenas em um aparelho seu. O acesso fica protegido no navegador; quem usar sua sessão desbloqueada poderá abrir as conversas. Você pode exigir um PIN ou senha em Configurações. Guarde o código para aparelhos novos.</p>
      <button className="primary-button" disabled={busy || !code || (!privacyState.vault && !saved)}>{busy ? 'Processando…' : privacyState.vault ? 'Desbloquear' : 'Ativar mensagens'}</button>
    </form>}
  </section></main>
  const receipt = receipts.find((row) => row.user_id === person?.id && row.partner_id === session.id)
  const currentPerson = people.find((entry) => entry.id === person?.id) || person
  const visibleMessages = messages.filter((row) => !messageSearch || row.plaintext?.toLocaleLowerCase().includes(messageSearch.toLocaleLowerCase()))
  const orderedPeople = [...people].sort((a,b) => (inbox.find((row) => row.partner_id === b.id)?.last_message_at || '').localeCompare(inbox.find((row) => row.partner_id === a.id)?.last_message_at || '') || a.name.localeCompare(b.name))
  const name = (id) => id === session.id ? 'Você' : people.find((entry) => entry.id === id)?.name || id
  return <main className="feature-view messages-view" data-has-drafts={draft.trim() || [...drafts.current.values()].some((value) => value.trim()) ? "true" : undefined}>
    <ViewHeader title={review ? 'Revisão do criador' : 'Mensagens'} subtitle={status === 'SUBSCRIBED' ? 'Conectado ao chat em tempo real.' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' ? 'Conexão interrompida. Reconectando…' : 'Conectando ao chat…'} />
    <div className="chat-privacy-notice"><details><summary>Privacidade das mensagens</summary><p>{notice}</p></details><button className="secondary-button" onClick={lock}>Bloquear mensagens</button></div>{errors}
    <div className={`messages-layout ${person || review ? 'has-conversation' : ''}`}><aside className="chat-list">
      <label><Search size={18} /><input placeholder="Buscar pessoas" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <button className="chat-find-people secondary-button" onClick={onFindPeople}><UsersRound size={17}/>Encontrar pessoas</button><div>{session.isOwner ? <button className={review ? 'is-active' : ''} onClick={() => open(null, true)}>Revisar todas as mensagens</button> : null}
      {orderedPeople.filter((entry) => entry.name.toLowerCase().includes(query.toLowerCase())).map((entry) => <button className={person?.id === entry.id ? 'is-active' : ''} key={entry.id} onClick={() => open(entry)}><Avatar src={entry.avatar_url} alt={entry.name} /><span><strong>{entry.name}</strong><small>{entry.ready ? 'Mensagens ativadas' : 'Ainda não ativou as mensagens'}</small></span>{inbox.find((row) => row.partner_id === entry.id)?.unread ? <b aria-label="Mensagens não lidas">{inbox.find((row) => row.partner_id === entry.id).unread}</b> : null}</button>)}</div>
      {!people.length ? <p className="empty-inline">Outras pessoas cadastradas aparecerão aqui.</p> : null}
    </aside><section className="conversation">{person || review ? <>
      <header><button className="icon-button chat-back" onClick={() => open(null)} aria-label="Voltar para pessoas"><ArrowLeft size={20}/></button>{person ? <Avatar src={person.avatar_url} alt={person.name} /> : null}<strong>{review ? 'Todas as conversas — acesso declarado do criador' : person.name}</strong></header>
      <label className="chat-message-search"><Search size={17}/><input aria-label="Buscar nesta conversa" placeholder="Buscar nesta conversa" value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)}/></label><div className="conversation__messages" ref={scrollArea} onScroll={() => { const area = scrollArea.current; setAtBottom(area.scrollHeight - area.scrollTop - area.clientHeight < 80) }}>{hasOlder ? <button className="secondary-button" disabled={loading} onClick={older}>Carregar anteriores</button> : null}{loading ? <p>Carregando mensagens…</p> : !messages.length ? <p className="empty-inline">Nenhuma mensagem nesta conversa.</p> : null}
      {messageSearch && !visibleMessages.length ? <p className="empty-inline">Nenhuma mensagem encontrada no histórico carregado.</p> : null}{visibleMessages.map((row) => <div key={row.id} className={`bubble-row bubble-row--${row.sender_id === session.id ? 'me' : 'them'}`}><div className="message-bubble">{review ? <small>{name(row.sender_id)} → {name(row.recipient_id)}</small> : null}<p>{row.plaintext}</p>{!row.invalid ? <button className="message-copy" aria-label="Copiar mensagem" onClick={() => navigator.clipboard.writeText(row.plaintext).then(() => onNotify('Mensagem copiada.')).catch(() => onNotify('Selecione o texto para copiar.'))}><Copy size={13}/></button> : null}<small>{row.invalid ? 'Falha na verificação · ' : row.legacy ? 'Anterior à criptografia · ' : 'Criptografada · '}{new Date(row.created_at).toLocaleString('pt-BR')}{!review && row.sender_id === session.id ? <span className="message-receipt">{messageWasRead(row, receipt) ? <><CheckCheck size={13}/>Vista</> : 'Enviada'}</span> : null}</small></div></div>)}<div ref={end} /></div>
      {!review ? <div className="composer-chat-wrap">{currentPerson && !currentPerson.ready ? <p className="empty-inline">Esta pessoa precisa ativar sua chave para receber mensagens.</p> : null}{showEmoji ? <div className="emoji-picker">{['😀','❤️','👍','🎉','😂','🙏','😊','🔥','👋','👏','💬','✨'].map((emoji) => <button key={emoji} type="button" onClick={() => { setDraft((text) => (text + emoji).slice(0,4000)); setShowEmoji(false) }}>{emoji}</button>)}</div> : null}<form className="message-composer" onSubmit={send}><button className="icon-button" type="button" aria-label="Adicionar emoji" aria-expanded={showEmoji} onClick={() => setShowEmoji((value) => !value)}><Smile size={20}/></button><textarea aria-label="Mensagem" placeholder={`Mensagem para ${person.name}`} value={draft} maxLength={4000} rows={2} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && (!window.matchMedia('(pointer: coarse)').matches || event.ctrlKey || event.metaKey)) { event.preventDefault(); void send(event) } }} disabled={sending} /><button className="send-button" disabled={sending || !draft.trim() || !currentPerson?.ready} aria-label="Enviar mensagem"><Send size={18}/></button></form></div> : <p className="empty-inline">As conversas são apresentadas para revisão. Para responder, abra a pessoa na lista.</p>}
    </> : <div className="profile-empty"><h2>Escolha uma pessoa para conversar.</h2><p>Mensagens novas são criptografadas antes de serem salvas. Guarde seu código para abrir em outro aparelho.</p></div>}</section></div>
  </main>
}
