import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CheckCheck, Copy, Search, Send, Smile, UsersRound } from 'lucide-react'
import ViewHeader from '../components/ViewHeader.jsx'
import Avatar from '../components/Avatar.jsx'
import { supabase, signInWithGoogle } from '../services/auth.js'
import { mergeMessages, messagesClient, messageWasRead } from '../services/messaging.js'
import { privacyClient } from '../services/chatPrivacy.js'
import { unlockedChatSession } from '../services/chatSession.js'
import { chatMode,messageSession,standardMessage } from '../services/chatMode.js'

const api = supabase ? messagesClient(supabase) : null
const privacy = supabase ? privacyClient(supabase) : null
const notice = 'As mensagens ficam armazenadas no Itext e podem ser acessadas pelo criador. A proteção adicional com código é opcional e também inclui o criador como destinatário.'

export default function MessagesView({ user, onNotify, initialPerson, onFindPeople, onConfigureSecurity }) {
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
  const [cryptoSession, setCryptoSession] = useState(() => unlockedChatSession(user.id))
  const [standardAccepted,setStandardAccepted]=useState(false)
  const session=useMemo(()=>user.authenticated?messageSession(user.id,privacyState?.isOwner||false,cryptoSession):null,[user.id,user.authenticated,privacyState?.isOwner,cryptoSession])
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
    setCryptoSession(unlockedChatSession(user.id)); setPrivacyState(null); setError('')
    void Promise.all([privacy.state(), api.people(), api.inbox(), api.receipts()]).then(async ([state, rows, summary, reads]) => {
      let unlocked=unlockedChatSession(user.id)
      if(!unlocked){try{unlocked=await privacy.restore(state)}catch(issue){if(current&&state.enabled)setError(issue.message)}}
      if (current) { setPrivacyState(state); setPeople(rows); setInbox(summary); setReceipts(reads);setCryptoSession(unlocked) }
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
    if (!session || !person || review || messages.some(row=>row.locked) || messageSearch || !atBottom || document.visibilityState !== 'visible' || !document.hasFocus()) return
    const received = messages.filter((row) => row.sender_id === person.id && !row.invalid && !row.locked).at(-1)
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
    setMessageSearch(''); setStandardAccepted(false); setAtBottom(true); lastMarked.current = ''
    setPerson(next); setReview(asCreator); setMessages([]); setDraft(drafts.current.get(next?.id) || ''); setError(''); pendingSend.current = pendingSends.current.get(next?.id) || null
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
    if (!draft.trim() || !person || !session || sending || review || !['standard','protected'].includes(mode)) return
    const partner = person.id
    const body = draft.trim()
    if(pendingSend.current?.body===body&&pendingSend.current.partner===partner&&pendingSend.current.mode!==mode){setError('Confirme o envio anterior antes de trocar o tipo de proteção para esta mensagem.');return}
    if (!pendingSend.current || pendingSend.current.body !== body || pendingSend.current.partner !== partner) pendingSend.current = { id: crypto.randomUUID(), body, partner, mode }
    const pending = pendingSend.current
    pendingSends.current.set(partner, pending)
    setSending(true); setError('')
    try {
      // Reuse the SAME ciphertext and UUID after uncertain network responses.
      pending.payload ||= mode==='protected'?await cryptoSession.encrypt(partner,body,pending.id):standardMessage(user.id,partner,body,pending.id)
      const row = await api.send(pending.payload)
      const rows = await session.decrypt([row])
      pendingSends.current.delete(partner)
      if (drafts.current.get(partner)?.trim() === body) drafts.current.delete(partner)
      if (active.current === partner) { setMessages((previous) => mergeMessages(previous, rows)); setDraft(''); drafts.current.delete(partner); setAtBottom(true); pendingSend.current = null }
    } catch (issue) {
      if(['42501','23514','23503'].includes(issue.code)){pendingSends.current.delete(partner);if(pendingSend.current===pending)pendingSend.current=null}
      setError(`Não foi possível confirmar o envio: ${issue.message}. Você pode tentar novamente.`)
    }
    finally { setSending(false) }
  }

  if (!user.authenticated) return <main className="feature-view"><ViewHeader title="Mensagens" /><div className="profile-empty"><h2>Entre para conversar.</h2><button className="primary-button" onClick={() => signInWithGoogle().catch((issue) => onNotify(issue.message))}>Entrar com Google</button></div></main>
  const errors = error ? <p className="chat-error" role="alert">{error}</p> : null
  const receipt = receipts.find((row) => row.user_id === person?.id && row.partner_id === session.id)
  const currentPerson = people.find((entry) => entry.id === person?.id) || person
  const mode=chatMode({loaded:!!privacyState,enabled:privacyState?.enabled,keyReady:!!cryptoSession,partnerReady:currentPerson?.ready,creatorReady:privacyState?.ownerReady,standardAccepted})
  const visibleMessages = messages.filter((row) => !messageSearch || row.plaintext?.toLocaleLowerCase().includes(messageSearch.toLocaleLowerCase()))
  const orderedPeople = [...people].sort((a,b) => (inbox.find((row) => row.partner_id === b.id)?.last_message_at || '').localeCompare(inbox.find((row) => row.partner_id === a.id)?.last_message_at || '') || a.name.localeCompare(b.name))
  const name = (id) => id === session.id ? 'Você' : people.find((entry) => entry.id === id)?.name || id
  return <main className="feature-view messages-view" data-has-drafts={draft.trim() || [...drafts.current.values()].some((value) => value.trim()) ? "true" : undefined}>
    <ViewHeader title={review ? 'Revisão do criador' : 'Mensagens'} subtitle={status === 'SUBSCRIBED' ? 'Conectado ao chat em tempo real.' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' ? 'Conexão interrompida. Reconectando…' : 'Conectando ao chat…'} />
    <div className="chat-privacy-notice"><details><summary>Privacidade das mensagens</summary><p>{notice}</p></details><button className="secondary-button" onClick={onConfigureSecurity}>Configurações das mensagens</button></div>{errors}{!privacyState?<button className="secondary-button" onClick={()=>setRetry(value=>value+1)}>Verificar preferências</button>:null}
    <div className={`messages-layout ${person || review ? 'has-conversation' : ''}`}><aside className="chat-list">
      <label><Search size={18} /><input placeholder="Buscar pessoas" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <button className="chat-find-people secondary-button" onClick={onFindPeople}><UsersRound size={17}/>Encontrar pessoas</button><div>{session.isOwner ? <button className={review ? 'is-active' : ''} onClick={() => open(null, true)}>Revisar todas as mensagens</button> : null}
      {orderedPeople.filter((entry) => entry.name.toLowerCase().includes(query.toLowerCase())).map((entry) => <button className={person?.id === entry.id ? 'is-active' : ''} key={entry.id} onClick={() => open(entry)}><Avatar src={entry.avatar_url} alt={entry.name} /><span><strong>{entry.name}</strong><small>{entry.ready ? 'Proteção adicional disponível' : 'Conversa padrão'}</small></span>{inbox.find((row) => row.partner_id === entry.id)?.unread ? <b aria-label="Mensagens não lidas">{inbox.find((row) => row.partner_id === entry.id).unread}</b> : null}</button>)}</div>
      {!people.length ? <p className="empty-inline">Outras pessoas cadastradas aparecerão aqui.</p> : null}
    </aside><section className="conversation">{person || review ? <>
      <header><button className="icon-button chat-back" onClick={() => open(null)} aria-label="Voltar para pessoas"><ArrowLeft size={20}/></button>{person ? <Avatar src={person.avatar_url} alt={person.name} /> : null}<strong>{review ? 'Todas as conversas — acesso declarado do criador' : person.name}</strong></header>
      <label className="chat-message-search"><Search size={17}/><input aria-label="Buscar nesta conversa" placeholder="Buscar nesta conversa" value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)}/></label><div className="conversation__messages" ref={scrollArea} onScroll={() => { const area = scrollArea.current; setAtBottom(area.scrollHeight - area.scrollTop - area.clientHeight < 80) }}>{hasOlder ? <button className="secondary-button" disabled={loading} onClick={older}>Carregar anteriores</button> : null}{loading ? <p>Carregando mensagens…</p> : !messages.length ? <p className="empty-inline">Nenhuma mensagem nesta conversa.</p> : null}
      {messageSearch && !visibleMessages.length ? <p className="empty-inline">Nenhuma mensagem encontrada no histórico carregado.</p> : null}{visibleMessages.map((row) => <div key={row.id} className={`bubble-row bubble-row--${row.sender_id === session.id ? 'me' : 'them'}`}><div className="message-bubble">{review ? <small>{name(row.sender_id)} → {name(row.recipient_id)}</small> : null}<p>{row.plaintext}</p>{!row.invalid && !row.locked ? <button className="message-copy" aria-label="Copiar mensagem" onClick={() => navigator.clipboard.writeText(row.plaintext).then(() => onNotify('Mensagem copiada.')).catch(() => onNotify('Selecione o texto para copiar.'))}><Copy size={13}/></button> : null}<small>{row.invalid ? 'Falha na verificação · ' : row.locked ? 'Acesso não recuperado · ' : row.encryption_version===1 ? 'Proteção adicional · ' : 'Mensagem padrão · '}{new Date(row.created_at).toLocaleString('pt-BR')}{!review && row.sender_id === session.id ? <span className="message-receipt">{messageWasRead(row, receipt) ? <><CheckCheck size={13}/>Vista</> : 'Enviada'}</span> : null}</small></div></div>)}<div ref={end} /></div>
      {!review ? <div className="composer-chat-wrap">{mode==='needs-setup'?<div className="chat-mode-notice"><p>A proteção adicional escolhida não está disponível nesta conversa ou neste aparelho.</p><button className="secondary-button" onClick={onConfigureSecurity}>Configurar proteção</button><button className="secondary-button" onClick={()=>setStandardAccepted(true)}>Usar conversa padrão</button></div>:<p className="chat-mode-label">{mode==='protected'?'Proteção adicional ativa':mode==='loading'?'Conferindo preferências…':'Conversa padrão'}</p>}{showEmoji ? <div className="emoji-picker">{['😀','❤️','👍','🎉','😂','🙏','😊','🔥','👋','👏','💬','✨'].map((emoji) => <button key={emoji} type="button" onClick={() => { setDraft((text) => (text + emoji).slice(0,4000)); setShowEmoji(false) }}>{emoji}</button>)}</div> : null}<form className="message-composer" onSubmit={send}><button className="icon-button" type="button" aria-label="Adicionar emoji" aria-expanded={showEmoji} onClick={() => setShowEmoji((value) => !value)}><Smile size={20}/></button><textarea aria-label="Mensagem" placeholder={`Mensagem para ${person.name}`} value={draft} maxLength={4000} rows={2} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && (!window.matchMedia('(pointer: coarse)').matches || event.ctrlKey || event.metaKey)) { event.preventDefault(); void send(event) } }} disabled={sending} /><button className="send-button" disabled={sending || !draft.trim() || !['standard','protected'].includes(mode)} aria-label="Enviar mensagem"><Send size={18}/></button></form></div> : <p className="empty-inline">As conversas são apresentadas para revisão. Para responder, abra a pessoa na lista.</p>}
    </> : <div className="profile-empty"><h2>Escolha uma pessoa para conversar.</h2><p>Envie mensagens sem configurar um código. A proteção adicional é uma opção nas Configurações.</p></div>}</section></div>
  </main>
}
