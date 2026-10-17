import { useEffect, useRef, useState } from 'react'
import { Search, Send } from 'lucide-react'
import ViewHeader from '../components/ViewHeader.jsx'
import Avatar from '../components/Avatar.jsx'
import { supabase, signInWithGoogle } from '../services/auth.js'
import { mergeMessages, messagesClient } from '../services/messaging.js'

const api = supabase ? messagesClient(supabase) : null
export default function MessagesView({ user, onNotify }) {
  const [people, setPeople] = useState([])
  const [person, setPerson] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('CONNECTING')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [hasOlder, setHasOlder] = useState(false)
  const activePerson = useRef(null)
  const pendingSend = useRef(null)
  const requestId = useRef(0)
  const end = useRef(null)
  activePerson.current = person?.id

  useEffect(() => {
    if (!user.authenticated || !api) return
    let active = true
    let stop
    void (async () => {
      try {
        const uid = await api.identity()
        if (!active) return
        stop = api.listen(uid, (row) => {
          if (!active) return
          const other = row.sender_id === uid ? row.recipient_id : row.sender_id
          if (other === activePerson.current) setMessages((current) => mergeMessages(current, [row]))
          void api.people().then((rows) => { if (active) setPeople(rows) }).catch(() => {})
        }, (value) => { if (active) setStatus(value) })
        const rows = await api.people()
        if (active) setPeople(rows)
      } catch (issue) { if (active) setError(issue.message) }
    })()
    return () => { active = false; stop?.() }
  }, [user.id, user.authenticated])

  useEffect(() => {
    if (status !== 'SUBSCRIBED' || !person) return
    // Reconcile history after reconnects so offline messages are not missed.
    void api.history(person.id).then((rows) => {
      if (activePerson.current === person.id) setMessages((current) => mergeMessages(current, rows))
    }).catch((issue) => setError(issue.message))
  }, [status, person])
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [messages.length])

  async function open(next) {
    const currentRequest = ++requestId.current
    activePerson.current = next.id
    setPerson(next); setMessages([]); setDraft(''); setError(''); setLoading(true); pendingSend.current = null
    try {
      const rows = await api.history(next.id)
      if (requestId.current !== currentRequest) return
      setMessages((current) => mergeMessages(current, rows)); setHasOlder(rows.length === 100)
    } catch (issue) { if (requestId.current === currentRequest) setError(issue.message) }
    finally { if (requestId.current === currentRequest) setLoading(false) }
  }
  async function older() {
    if (!person || !messages.length) return
    const partner = person.id
    try {
      const rows = await api.history(partner, messages[0])
      if (activePerson.current === partner) { setMessages((current) => mergeMessages(current, rows)); setHasOlder(rows.length === 100) }
    } catch (issue) { setError(issue.message) }
  }
  async function send(event) {
    event.preventDefault()
    if (!draft.trim() || !person || sending) return
    const partner = person.id
    const body = draft.trim()
    if (!pendingSend.current || pendingSend.current.body !== body || pendingSend.current.partner !== partner) pendingSend.current = { id: crypto.randomUUID(), body, partner }
    const id = pendingSend.current.id
    setSending(true); setError('')
    try {
      const row = await api.send(partner, body, id)
      if (activePerson.current === partner) { setMessages((current) => mergeMessages(current, [row])); setDraft(''); pendingSend.current = null }
    } catch (issue) { setError(`Não foi possível confirmar o envio: ${issue.message}. Você pode tentar novamente.`) }
    finally { setSending(false) }
  }
  if (!user.authenticated) return <main className="feature-view"><ViewHeader title="Mensagens" /><div className="profile-empty"><h2>Entre para conversar.</h2><button className="primary-button" onClick={() => signInWithGoogle().catch((issue) => onNotify(issue.message))}>Entrar com Google</button></div></main>
  return <main className="feature-view messages-view"><ViewHeader title="Mensagens" subtitle={status === 'SUBSCRIBED' ? 'Conectado ao chat em tempo real.' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' ? 'Conexão interrompida. Reconectando…' : 'Conectando ao chat…'} />{error ? <p className="chat-error" role="alert">{error}</p> : null}<div className="messages-layout"><aside className="chat-list"><label><Search size={18} /><input placeholder="Buscar pessoas" value={query} onChange={(event) => setQuery(event.target.value)} /></label>{people.filter((entry) => entry.name.toLowerCase().includes(query.toLowerCase())).map((entry) => <button className={person?.id === entry.id ? 'is-active' : ''} key={entry.id} onClick={() => open(entry)}><Avatar src={entry.avatar_url} alt={entry.name} /><span><strong>{entry.name}</strong></span></button>)}{!people.length ? <p className="empty-inline">Outras pessoas cadastradas aparecerão aqui.</p> : null}</aside><section className="conversation">{person ? <><header><Avatar src={person.avatar_url} alt={person.name} /><strong>{person.name}</strong></header><div className="conversation__messages">{hasOlder ? <button className="secondary-button" onClick={older}>Carregar anteriores</button> : null}{loading ? <p>Carregando mensagens…</p> : !messages.length ? <p className="empty-inline">Vocês ainda não trocaram mensagens.</p> : null}{messages.map((row) => <div key={row.id} className={`bubble-row bubble-row--${row.sender_id === person.id ? 'them' : 'me'}`}><div className="message-bubble"><p>{row.body}</p><small>{new Date(row.created_at).toLocaleString('pt-BR')}</small></div></div>)}<div ref={end} /></div><form className="message-composer" onSubmit={send}><input aria-label="Mensagem" placeholder={`Mensagem para ${person.name}`} value={draft} maxLength={4000} onChange={(event) => setDraft(event.target.value)} disabled={sending} /><button className="send-button" disabled={sending || !draft.trim()} aria-label="Enviar mensagem"><Send size={17} /></button></form></> : <div className="profile-empty"><h2>Escolha uma pessoa para conversar.</h2><p>As mensagens ficam salvas e aparecem nos seus dispositivos.</p></div>}</section></div></main>
}
