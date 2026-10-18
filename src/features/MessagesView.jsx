import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CheckCheck, Copy, MoreHorizontal, Reply, Search, Send, ShieldBan, Smile, UsersRound, X } from 'lucide-react'
import ViewHeader from '../components/ViewHeader.jsx'
import Avatar from '../components/Avatar.jsx'
import Modal from '../components/Modal.jsx'
import { supabase, signInWithGoogle } from '../services/auth.js'
import { mergeMessages, messagesClient, messageWasRead } from '../services/messaging.js'
import { privacyClient } from '../services/chatPrivacy.js'
import { unlockedChatSession } from '../services/chatSession.js'
import { chatMode, messageSession, standardMessage } from '../services/chatMode.js'

const api=supabase?messagesClient(supabase):null
const privacy=supabase?privacyClient(supabase):null
const notice='As mensagens ficam armazenadas no Itext e podem ser acessadas pelo criador. A proteção adicional com código é opcional e também inclui o criador como destinatário.'
const reactionOptions=['❤️','👍','😂','🎉','🙏','😮']

export default function MessagesView({user,onNotify,initialPerson,onFindPeople,onConfigureSecurity,onSocialChange=()=>{}}) {
  const [people,setPeople]=useState([])
  const [person,setPerson]=useState(null)
  const [review,setReview]=useState(false)
  const [messages,setMessages]=useState([])
  const [references,setReferences]=useState([])
  const [reactions,setReactions]=useState([])
  const [draft,setDraft]=useState('')
  const [replyTo,setReplyTo]=useState(null)
  const [editing,setEditing]=useState(null)
  const [query,setQuery]=useState('')
  const [tab,setTab]=useState('main')
  const [status,setStatus]=useState('CONNECTING')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  const [sending,setSending]=useState(false)
  const [hasOlder,setHasOlder]=useState(false)
  const [privacyState,setPrivacyState]=useState(null)
  const [cryptoSession,setCryptoSession]=useState(()=>unlockedChatSession(user.id))
  const [standardAccepted,setStandardAccepted]=useState(false)
  const session=useMemo(()=>user.authenticated?messageSession(user.id,privacyState?.isOwner||false,cryptoSession):null,[user.id,user.authenticated,privacyState?.isOwner,cryptoSession])
  const [retry,setRetry]=useState(0)
  const [sync,setSync]=useState(0)
  const [inbox,setInbox]=useState([])
  const [receipts,setReceipts]=useState([])
  const [blocks,setBlocks]=useState([])
  const [allowed,setAllowed]=useState(false)
  const [messageSearch,setMessageSearch]=useState('')
  const [showEmoji,setShowEmoji]=useState(false)
  const [atBottom,setAtBottom]=useState(true)
  const [readTick,setReadTick]=useState(0)
  const [choice,setChoice]=useState(null)
  const [dialog,setDialog]=useState('')
  const [blockScope,setBlockScope]=useState('chat')
  const [clearOnBlock,setClearOnBlock]=useState(false)
  const [actionBusy,setActionBusy]=useState(false)
  const lastMarked=useRef('')
  const requestedPerson=useRef('')
  const drafts=useRef(new Map())
  const scrollArea=useRef(null)
  const active=useRef(null)
  const pendingSends=useRef(new Map())
  const messageRows=useRef([])
  const end=useRef(null)
  const editPrevious=useRef('')
  active.current=review?'__creator__':person?.id
  messageRows.current=messages

  useEffect(()=>{
    if(!user.authenticated||!privacy)return
    let current=true
    setCryptoSession(unlockedChatSession(user.id));setPrivacyState(null);setError('')
    void privacy.state().then(async state=>{
      let unlocked=unlockedChatSession(user.id)
      if(!unlocked){try{unlocked=await privacy.restore(state)}catch(issue){if(current&&state.enabled)setError(issue.message)}}
      if(current){setPrivacyState(state);setCryptoSession(unlocked)}
    }).catch(issue=>{if(current)setError(issue.message)})
    return()=>{current=false}
  },[user.id,user.authenticated,retry])

  useEffect(()=>{
    if(!session)return
    let current=true
    void Promise.all([api.people(),api.inbox(),api.receipts(),api.blocks()]).then(([rows,summary,reads,ownBlocks])=>{
      if(current){setPeople(rows);setInbox(summary);setReceipts(reads);setBlocks(ownBlocks)}
    }).catch(issue=>{if(current)setError(issue.message)})
    return()=>{current=false}
  },[session,sync])

  useEffect(()=>{
    if(!session)return
    let current=true
    let debounce
    const changed=()=>{clearTimeout(debounce);debounce=setTimeout(()=>{if(current)setSync(value=>value+1)},100)}
    const stop=api.listen(session.id,changed,value=>{if(current){setStatus(value);if(value==='SUBSCRIBED')changed()}},session.isOwner,changed)
    const timer=setInterval(changed,30000)
    const focus=()=>{if(document.visibilityState==='visible')changed()}
    window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus)
    return()=>{current=false;clearTimeout(debounce);clearInterval(timer);stop();window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus)}
  },[session])

  useEffect(()=>{
    if(!session||(!person&&!review))return
    let current=true
    const target=active.current
    setLoading(true)
    void (async()=>{
      // Recheck cached rows through RLS so deletions/clears on another device are removed here too.
      const [latest,visible,canSend]=await Promise.all([
        review?api.creatorHistory():api.history(person.id),
        api.visible(messageRows.current.map(row=>row.id)),
        review?false:api.canMessage(person.id),
      ])
      const rows=await session.decrypt(mergeMessages(visible,latest))
      const parentIds=[...new Set(rows.map(row=>row.reply_to).filter(Boolean))]
      const [parents,reactions]=await Promise.all([api.visible(parentIds),review?[]:api.reactions(rows.map(row=>row.id))])
      const decoded=await session.decrypt(parents)
      if(current&&target===active.current){setMessages(rows);setReferences(decoded);setReactions(reactions);setAllowed(canSend);setHasOlder(latest.length===100)}
    })().catch(issue=>{if(current)setError(issue.message)}).finally(()=>{if(current)setLoading(false)})
    return()=>{current=false}
  },[session,person,review,status,sync])

  useEffect(()=>{if(atBottom)end.current?.scrollIntoView({block:'nearest'})},[messages.length,atBottom])
  useEffect(()=>{
    const visible=()=>setReadTick(value=>value+1)
    window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible)
    return()=>{window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible)}
  },[])
  const isUnknown=!!inbox.find(row=>row.partner_id===person?.id)?.unknown
  useEffect(()=>{
    if(!session||!person||review||isUnknown||messages.some(row=>row.locked)||messageSearch||!atBottom||document.visibilityState!=='visible'||!document.hasFocus())return
    const received=messages.filter(row=>row.sender_id===person.id&&!row.invalid&&!row.locked&&!row.deleted_at).at(-1)
    if(!received||received.id===lastMarked.current)return
    lastMarked.current=received.id
    void api.markRead(received.id).then(()=>setSync(value=>value+1)).catch(()=>{if(lastMarked.current===received.id)lastMarked.current=''})
  },[messages,person,review,session,isUnknown,messageSearch,atBottom,readTick])

  useEffect(()=>{
    if(!initialPerson||requestedPerson.current===initialPerson.id||!api)return
    let current=true
    void api.person(initialPerson.id).then(found=>{
      if(!current)return
      requestedPerson.current=found.id;setPeople(rows=>rows.some(row=>row.id===found.id)?rows:[...rows,found]);open(found)
    }).catch(issue=>{if(current)setError(issue.message)})
    return()=>{current=false}
  },[initialPerson?.id])

  function open(next,asCreator=false) {
    if(active.current&&active.current!=='__creator__')drafts.current.set(active.current,{text:editing?editPrevious.current:draft,reply:replyTo})
    const saved=drafts.current.get(next?.id)
    active.current=asCreator?'__creator__':next?.id
    messageRows.current=[]
    setPerson(next);setSync(value=>value+1);setReview(asCreator);setMessages([]);setReferences([]);setReactions([]);setAllowed(false)
    setDraft(saved?.text||'');setReplyTo(saved?.reply||null);setEditing(null);setChoice(null);setDialog('')
    setMessageSearch('');setStandardAccepted(false);setAtBottom(true);setShowEmoji(false);lastMarked.current='';setError('');setHasOlder(false)
  }
  async function older() {
    if((!person&&!review)||!messages.length||loading)return
    const target=active.current;setLoading(true)
    try{
      const raw=review?await api.creatorHistory(messages[0]):await api.history(person.id,messages[0])
      const rows=await session.decrypt(raw)
      const parents=await session.decrypt(await api.visible(rows.map(row=>row.reply_to).filter(Boolean)))
      const extra=review?[]:await api.reactions(rows.map(row=>row.id))
      if(active.current===target){setAtBottom(false);setMessages(previous=>mergeMessages(previous,rows));setReferences(previous=>mergeMessages(previous,parents));setReactions(previous=>[...previous.filter(item=>!extra.some(next=>next.message_id===item.message_id&&next.user_id===item.user_id)),...extra]);setHasOlder(rows.length===100)}
    }catch(issue){setError(issue.message)}finally{setLoading(false)}
  }
  function cancelEdit(){setEditing(null);setDraft(editPrevious.current);setChoice(null)}
  function startEdit(row){editPrevious.current=draft;setEditing(row);setReplyTo(null);setDraft(row.plaintext);setChoice(null)}
  function startReply(row){if(editing)cancelEdit();setReplyTo(row);setChoice(null);document.getElementById('chat-draft')?.focus()}
  async function send(event) {
    event.preventDefault()
    if(!draft.trim()||!person||!session||sending||review||!allowed||isUnknown)return
    const sendMode=editing?(editing.encryption_version===1?(cryptoSession?'protected':'needs-setup'):'standard'):mode
    if(!['standard','protected'].includes(sendMode))return
    const partner=person.id,body=draft.trim(),context={reply_to:editing?editing.reply_to||null:replyTo?.id||null,story_id:editing?.story_id||null}
    const key=JSON.stringify([partner,editing?.id||null,context])
    let pending=pendingSends.current.get(key)
    if(pending?.body===body&&pending.mode!==sendMode){setError('Confirme o envio anterior antes de trocar o tipo de proteção.');return}
    if(!pending||pending.body!==body){pending={id:editing?.id||crypto.randomUUID(),body,partner,mode:sendMode};pendingSends.current.set(key,pending)}
    setSending(true);setError('')
    try{
      pending.payload ||= sendMode==='protected'?await cryptoSession.encrypt(partner,body,pending.id,context):standardMessage(user.id,partner,body,pending.id,context)
      if(editing){if(pending.payload.owner_id!==editing.owner_id)throw new Error('A chave do criador mudou. Esta mensagem não pode ser alterada com outra proteção.');await api.messageAction(editing.id,'edit',pending.payload)}
      else await api.send(pending.payload)
      pendingSends.current.delete(key);drafts.current.delete(partner)
      if(active.current===partner){setDraft(editing?editPrevious.current:'');setEditing(null);setReplyTo(null);setAtBottom(true);setSync(value=>value+1)}
    }catch(issue){
      if(['42501','23514','23503','P0001'].includes(issue.code))pendingSends.current.delete(key)
      setError(`Não foi possível confirmar: ${issue.message}. Você pode tentar novamente.`)
    }finally{setSending(false)}
  }
  async function react(row,emoji) {
    if(actionBusy)return
    setActionBusy(true);setError('')
    try{const mine=reactions.find(item=>item.message_id===row.id&&item.user_id===user.id);await api.react(row.id,emoji,mine?.emoji===emoji);setSync(value=>value+1);setChoice(null);setDialog('')}catch(issue){setError(issue.message)}finally{setActionBusy(false)}
  }
  async function messageAction(action) {
    if(!choice||actionBusy)return
    setActionBusy(true);setError('')
    try{await api.messageAction(choice.id,action);if(action==='hide'){setMessages(rows=>rows.filter(row=>row.id!==choice.id));messageRows.current=messageRows.current.filter(row=>row.id!==choice.id)}setChoice(null);setDialog('');setSync(value=>value+1)}catch(issue){setError(issue.message)}finally{setActionBusy(false)}
  }
  async function conversationAction(action) {
    if(!person||actionBusy)return
    setActionBusy(true);setError('')
    try{await api.conversationAction(person.id,action);if(action==='clear'){open(null);onNotify('Conversa apagada só para você.')}else setDialog('');setSync(value=>value+1)}catch(issue){setError(issue.message)}finally{setActionBusy(false)}
  }
  async function block(remove=false) {
    if(!person||actionBusy)return
    setActionBusy(true);setError('')
    try{
      await api.setBlock(person.id,remove?null:blockScope)
      // Keep the block even if the separate per-user clearing request has a network failure.
      if(!remove&&clearOnBlock)await api.conversationAction(person.id,'clear')
      setAllowed(false);setDialog('');setSync(value=>value+1);void onSocialChange();onNotify(remove?'Contato desbloqueado.':'Contato bloqueado.')
      if(!remove&&clearOnBlock)open(null)
    }catch(issue){setError(issue.message);setSync(value=>value+1)}finally{setActionBusy(false)}
  }
  function showBlock(clear=false){setClearOnBlock(clear);setBlockScope(blocks.find(row=>row.blocked_id===person?.id)?.scope||'chat');setDialog('block')}

  if(!user.authenticated)return <main className="feature-view"><ViewHeader title="Mensagens"/><div className="profile-empty"><h2>Entre para conversar.</h2><button className="primary-button" onClick={()=>signInWithGoogle().catch(issue=>onNotify(issue.message))}>Entrar com Google</button></div></main>
  const receipt=receipts.find(row=>row.user_id===person?.id&&row.partner_id===user.id)
  const currentPerson=people.find(entry=>entry.id===person?.id)||person
  const ownBlock=blocks.find(row=>row.blocked_id===person?.id)
  const mode=chatMode({loaded:!!privacyState,enabled:privacyState?.enabled,keyReady:!!cryptoSession,partnerReady:currentPerson?.ready,creatorReady:privacyState?.ownerReady,standardAccepted})
  const visibleMessages=messages.filter(row=>!messageSearch||row.plaintext?.toLocaleLowerCase().includes(messageSearch.toLocaleLowerCase()))
  const unknownCount=inbox.filter(row=>row.unknown&&!blocks.some(block=>block.blocked_id===row.partner_id)).reduce((total,row)=>total+row.unread,0)
  const orderedPeople=[...people].filter(entry=>{
    const summary=inbox.find(row=>row.partner_id===entry.id),blocked=blocks.some(row=>row.blocked_id===entry.id)
    return entry.name.toLowerCase().includes(query.toLowerCase())&&(tab==='blocked'?blocked:!blocked&&(tab==='unknown'?summary?.unknown:!summary?.unknown&&(!!summary||person?.id===entry.id)))
  }).sort((a,b)=>(inbox.find(row=>row.partner_id===b.id)?.last_message_at||'').localeCompare(inbox.find(row=>row.partner_id===a.id)?.last_message_at||'')||a.name.localeCompare(b.name))
  const name=id=>id===user.id?'Você':people.find(entry=>entry.id===id)?.name||'Membro do Itext'
  const selectedMessage=messages.find(row=>row.id===choice?.id)||choice
  const currentReply=messages.find(row=>row.id===replyTo?.id)||references.find(row=>row.id===replyTo?.id)||replyTo
  const quote=row=>row.deleted_at?'Mensagem apagada':row.locked||row.invalid?'Mensagem indisponível':row.plaintext
  const composeMode=editing?(editing.encryption_version===1?(cryptoSession?'protected':'needs-setup'):'standard'):mode
  return <main className="feature-view messages-view" data-has-drafts={draft.trim()||[...drafts.current.values()].some(value=>value.text?.trim())?'true':undefined}>
    <ViewHeader title={review?'Revisão do criador':'Mensagens'} subtitle={status==='SUBSCRIBED'?'Conectado ao chat em tempo real.':['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)?'Conexão interrompida. Reconectando…':'Conectando ao chat…'}/>
    <div className="chat-privacy-notice"><details><summary>Privacidade das mensagens</summary><p>{notice}</p></details><button className="secondary-button" onClick={onConfigureSecurity}>Configurações das mensagens</button></div>
    {error?<p className="chat-error" role="alert">{error}</p>:null}{!privacyState?<button className="secondary-button" onClick={()=>setRetry(value=>value+1)}>Verificar preferências</button>:null}
    <div className={`messages-layout ${person||review?'has-conversation':''}`}><aside className="chat-list">
      <div className="chat-inbox-tabs" role="group" aria-label="Caixas de mensagens">{[['main','Conversas'],['unknown','Desconhecidos'],['blocked','Bloqueados']].map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>{setTab(id);open(null)}}>{label}{id==='unknown'&&unknownCount?<b aria-label={`${unknownCount} mensagens de desconhecidos`}>{unknownCount>99?'99+':unknownCount}</b>:null}</button>)}</div>
      <label><Search size={18}/><input placeholder="Buscar nesta lista" value={query} onChange={event=>setQuery(event.target.value)}/></label>
      <button className="chat-find-people secondary-button" onClick={onFindPeople}><UsersRound size={17}/>Encontrar pessoas</button>
      <div>{session?.isOwner?<button className={review?'is-active':''} onClick={()=>open(null,true)}>Revisar todas as mensagens</button>:null}{orderedPeople.map(entry=>{
        const summary=inbox.find(row=>row.partner_id===entry.id),ownBlock=blocks.find(row=>row.blocked_id===entry.id)
        return <button className={person?.id===entry.id?'is-active':''} key={entry.id} onClick={()=>open(entry)}><Avatar src={entry.avatar_url} alt=""/><span><strong>{entry.name}</strong><small>{ownBlock?ownBlock.scope==='all'?'Bloqueado de tudo':'Bloqueado no chat':summary?.unknown?'Solicitação de mensagem':entry.ready?'Proteção adicional disponível':'Conversa padrão'}</small></span>{summary?.unread?<b aria-label="Mensagens não lidas">{summary.unread}</b>:null}</button>
      })}</div>
      {!orderedPeople.length?<p className="empty-inline">{tab==='unknown'?'Nenhuma mensagem de desconhecidos.':tab==='blocked'?'Você não bloqueou contatos.':'Suas conversas aparecerão aqui. Use Encontrar pessoas para começar.'}</p>:null}
    </aside><section className="conversation">{person||review?<>
      <header><button className="icon-button chat-back" onClick={()=>open(null)} aria-label="Voltar para conversas"><ArrowLeft size={20}/></button>{person?<Avatar src={person.avatar_url} alt=""/>:null}<strong>{review?'Todas as conversas — acesso declarado do criador':person.name}</strong>{person?<button className="icon-button conversation-options" aria-label="Opções da conversa" onClick={()=>setDialog('conversation')}><MoreHorizontal size={22}/></button>:null}</header>
      <div className="conversation-tools"><label className="chat-message-search"><Search size={17}/><input aria-label="Buscar nesta conversa" placeholder="Buscar nesta conversa" value={messageSearch} onChange={event=>setMessageSearch(event.target.value)}/></label>{!review&&isUnknown?<div className="message-request"><strong>Mensagem de desconhecido</strong><p>Vocês não se seguem. Aceite para mover esta conversa para Conversas.</p><div><button className="primary-button" disabled={actionBusy} onClick={()=>conversationAction('accept')}>Aceitar e conversar</button><button className="secondary-button" onClick={()=>setDialog('clear')}>Apagar</button><button className="secondary-button" onClick={()=>showBlock(true)}>Bloquear e apagar</button></div></div>:null}</div>
      <div className="conversation__messages" ref={scrollArea} onScroll={()=>{const area=scrollArea.current;setAtBottom(area.scrollHeight-area.scrollTop-area.clientHeight<80)}}>{hasOlder?<button className="secondary-button" disabled={loading} onClick={older}>Carregar anteriores</button>:null}{loading&&!messages.length?<p>Carregando mensagens…</p>:!messages.length?<p className="empty-inline">Nenhuma mensagem nesta conversa.</p>:null}
        {messageSearch&&!visibleMessages.length?<p className="empty-inline">Nenhuma mensagem encontrada no histórico carregado.</p>:null}
        {visibleMessages.map(row=>{
          const parent=messages.find(item=>item.id===row.reply_to)||references.find(item=>item.id===row.reply_to)
          const rowReactions=reactions.filter(item=>item.message_id===row.id)
          return <div key={row.id} id={`message-${row.id}`} className={`bubble-row bubble-row--${row.sender_id===user.id?'me':'them'}`}><div className={`message-bubble ${row.deleted_at?'is-deleted':''}`}>
            {review?<small>{name(row.sender_id)} → {name(row.recipient_id)}</small>:null}
            {row.reply_to?<button className="message-quote" onClick={()=>document.getElementById(`message-${row.reply_to}`)?.scrollIntoView({block:'center',behavior:'smooth'})}><strong>{parent?name(parent.sender_id):'Resposta a uma mensagem'}</strong><span>{parent?quote(parent):'Mensagem anterior indisponível neste histórico.'}</span></button>:null}
            {row.story_id?<span className="message-story-context">Resposta a um story{row.sender_id===user.id?' que você viu':' do seu perfil'}</span>:null}
            <p>{row.plaintext}</p>
            {!review?<button className="message-more" aria-label="Ações da mensagem" onClick={()=>{setChoice(row);setDialog('message')}}><MoreHorizontal size={18}/></button>:null}
            {rowReactions.length?<div className="message-reactions">{[...new Set(rowReactions.map(item=>item.emoji))].map(emoji=><button key={emoji} disabled={review||!allowed||actionBusy} aria-label={`Reação ${emoji}`} aria-pressed={rowReactions.some(item=>item.user_id===user.id&&item.emoji===emoji)} onClick={()=>react(row,emoji)}>{emoji} {rowReactions.filter(item=>item.emoji===emoji).length}</button>)}</div>:null}
            <small>{row.deleted_at?'':row.invalid?'Falha na verificação · ':row.locked?'Acesso não recuperado · ':row.encryption_version===1?'Proteção adicional · ':'Mensagem padrão · '}{new Date(row.created_at).toLocaleString('pt-BR')}{row.edited_at?' · editada':''}{!review&&!row.deleted_at&&row.sender_id===user.id?<span className="message-receipt">{messageWasRead(row,receipt)?<><CheckCheck size={13}/>Vista</>:'Enviada'}</span>:null}</small>
          </div></div>
        })}<div ref={end}/>
      </div>
      {!review?<div className="composer-chat-wrap">{ownBlock?<div className="chat-mode-notice"><p>Você bloqueou este contato {ownBlock.scope==='all'?'de tudo':'na conversa'}.</p><button className="secondary-button" disabled={actionBusy} onClick={()=>block(true)}>Desbloquear</button><button className="text-button" onClick={()=>showBlock()}>Alterar tipo de bloqueio</button></div>:!allowed&&!loading?<p className="empty-inline">Não é possível enviar mensagens para este contato.</p>:null}
        {allowed&&!isUnknown?<>{editing?<div className="chat-composer-context"><span>Editando sua mensagem</span><button className="icon-button" aria-label="Cancelar edição" onClick={cancelEdit}><X size={17}/></button></div>:currentReply?<div className="chat-composer-context"><span>Respondendo a {name(currentReply.sender_id)}<small>{quote(currentReply)}</small></span><button className="icon-button" aria-label="Cancelar resposta" onClick={()=>setReplyTo(null)}><X size={17}/></button></div>:null}
        {composeMode==='needs-setup'?<div className="chat-mode-notice"><p>A proteção adicional escolhida não está disponível nesta conversa ou neste aparelho.</p><button className="secondary-button" onClick={onConfigureSecurity}>Configurar proteção</button>{!editing?<button className="secondary-button" onClick={()=>setStandardAccepted(true)}>Usar conversa padrão</button>:null}</div>:<p className="chat-mode-label">{composeMode==='protected'?'Proteção adicional ativa':composeMode==='loading'?'Conferindo preferências…':'Conversa padrão'}</p>}
        {showEmoji?<div className="emoji-picker">{['😀','❤️','👍','🎉','😂','🙏','😊','🔥','👋','👏','💬','✨'].map(emoji=><button key={emoji} type="button" onClick={()=>{setDraft(text=>(text+emoji).slice(0,4000));setShowEmoji(false)}}>{emoji}</button>)}</div>:null}
        <form className="message-composer" onSubmit={send}><button className="icon-button" type="button" aria-label="Adicionar emoji" aria-expanded={showEmoji} onClick={()=>setShowEmoji(value=>!value)}><Smile size={20}/></button><textarea id="chat-draft" aria-label={editing?'Editar mensagem':'Mensagem'} placeholder={`Mensagem para ${person.name}`} value={draft} maxLength={4000} rows={2} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing&&(!window.matchMedia('(pointer: coarse)').matches||event.ctrlKey||event.metaKey)){event.preventDefault();void send(event)}}} disabled={sending}/><button className="send-button" disabled={sending||!draft.trim()||!['standard','protected'].includes(composeMode)} aria-label={editing?'Salvar mensagem editada':'Enviar mensagem'}><Send size={18}/></button></form></>:null}
      </div>:<p className="empty-inline">As conversas são apresentadas para revisão. Para responder, abra a pessoa na lista.</p>}
    </>:<div className="profile-empty"><h2>Escolha uma conversa.</h2><p>Abra Pessoas para começar uma nova conversa. Mensagens de quem não tem conexão com você ficam em Desconhecidos.</p></div>}</section></div>
    {dialog==='conversation'?<Modal title="Opções da conversa" onClose={()=>setDialog('')}><div className="chat-action-sheet">{error?<p className="chat-error" role="alert">{error}</p>:null}{isUnknown?<button onClick={()=>conversationAction('accept')}>Mover para Conversas</button>:null}<button onClick={()=>setDialog('clear')}>Apagar conversa só para mim</button><button onClick={()=>showBlock()}><ShieldBan size={18}/>Bloquear contato</button>{ownBlock?<button disabled={actionBusy} onClick={()=>block(true)}>Desbloquear contato</button>:null}</div></Modal>:null}
    {dialog==='clear'?<Modal title="Apagar esta conversa?" onClose={()=>setDialog('')}><div className="stack-form">{error?<p className="chat-error" role="alert">{error}</p>:null}<p>O histórico será ocultado só para você. A outra pessoa mantém suas mensagens. Mensagens novas poderão aparecer novamente.</p><div className="form-actions"><button className="secondary-button" disabled={actionBusy} onClick={()=>setDialog('')}>Cancelar</button><button className="primary-button" disabled={actionBusy} onClick={()=>conversationAction('clear')}>Apagar só para mim</button></div></div></Modal>:null}
    {dialog==='block'?<Modal title="Bloquear contato" onClose={()=>setDialog('')}><div className="stack-form">{error?<p className="chat-error" role="alert">{error}</p>:null}<label className="block-option"><input type="radio" name="block-scope" value="chat" checked={blockScope==='chat'} onChange={()=>setBlockScope('chat')}/><span><strong>Apenas conversas</strong><small>Impede mensagens e reações nas conversas. Publicações e stories continuam disponíveis.</small></span></label><label className="block-option"><input type="radio" name="block-scope" value="all" checked={blockScope==='all'} onChange={()=>setBlockScope('all')}/><span><strong>De tudo</strong><small>Oculta posts, vídeos e stories entre as contas e impede mensagens, curtidas e comentários. O perfil continua pesquisável, com foto, capa e galeria de fotos publicadas.</small></span></label><label className="settings-check"><input type="checkbox" checked={clearOnBlock} onChange={event=>setClearOnBlock(event.target.checked)}/>Também apagar a conversa só para mim</label><div className="form-actions"><button className="secondary-button" disabled={actionBusy} onClick={()=>setDialog('')}>Cancelar</button><button className="primary-button" disabled={actionBusy} onClick={()=>block()}>Confirmar bloqueio</button></div></div></Modal>:null}
    {dialog==='message'&&selectedMessage?<Modal title="Ações da mensagem" onClose={()=>{setDialog('');setChoice(null)}}><div className="chat-action-sheet">{error?<p className="chat-error" role="alert">{error}</p>:null}<blockquote>{quote(selectedMessage)}</blockquote>{!selectedMessage.deleted_at&&!selectedMessage.invalid&&!selectedMessage.locked?<><button disabled={!allowed||isUnknown} onClick={()=>{startReply(selectedMessage);setDialog('')}}><Reply size={18}/>Responder a esta mensagem</button><div className="reaction-picker" aria-label="Reagir à mensagem">{reactionOptions.map(emoji=><button key={emoji} disabled={!allowed||actionBusy||isUnknown} aria-label={`Reagir com ${emoji}`} onClick={()=>react(selectedMessage,emoji)}>{emoji}</button>)}</div><button onClick={()=>navigator.clipboard.writeText(selectedMessage.plaintext).then(()=>onNotify('Mensagem copiada.')).catch(()=>onNotify('Selecione o texto para copiar.'))}><Copy size={18}/>Copiar</button>{selectedMessage.sender_id===user.id?<button disabled={!allowed} onClick={()=>{startEdit(selectedMessage);setDialog('')}}>Editar mensagem</button>:null}</>:null}<button disabled={actionBusy} onClick={()=>messageAction('hide')}>Apagar só para mim</button>{selectedMessage.sender_id===user.id&&!selectedMessage.deleted_at?<button onClick={()=>setDialog('delete-message')}>Apagar para todos</button>:null}</div></Modal>:null}
    {dialog==='delete-message'&&choice?<Modal title="Apagar mensagem para todos?" onClose={()=>setDialog('message')}><div className="stack-form">{error?<p className="chat-error" role="alert">{error}</p>:null}<p>O conteúdo será substituído por “Mensagem apagada” para os participantes. As reações serão removidas.</p><div className="form-actions"><button className="secondary-button" disabled={actionBusy} onClick={()=>setDialog('message')}>Cancelar</button><button className="primary-button" disabled={actionBusy} onClick={()=>messageAction('delete')}>Apagar para todos</button></div></div></Modal>:null}
  </main>
}
