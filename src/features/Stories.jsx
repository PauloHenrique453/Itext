import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Heart, Plus, Send, Trash2 } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import Modal from '../components/Modal.jsx'
import { itextApi } from '../services/itextApi.js'
import { supabase } from '../services/auth.js'
import { messagesClient } from '../services/messaging.js'
import { privacyClient } from '../services/chatPrivacy.js'
import { unlockedChatSession } from '../services/chatSession.js'
import { chatMode, standardMessage } from '../services/chatMode.js'

const messages=supabase?messagesClient(supabase):null
const privacy=supabase?privacyClient(supabase):null

function StoryReply({story,user,onNotify,onMessage}) {
  const [draft,setDraft]=useState('')
  const [ready,setReady]=useState(null)
  const [standard,setStandard]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const pending=useRef(null)
  useEffect(()=>{
    let active=true
    void Promise.all([privacy.state(),messages.person(story.author_id),messages.canMessage(story.author_id)]).then(async([state,person,allowed])=>{
      let session=unlockedChatSession(user.id)
      if(!session){try{session=await privacy.restore(state)}catch{/* The user may explicitly choose standard messaging. */}}
      if(active)setReady({state,person,allowed,session})
    }).catch(issue=>{if(active)setError(issue.message)})
    return()=>{active=false}
  },[story.author_id,user.id])
  const mode=chatMode({loaded:!!ready,enabled:ready?.state.enabled,keyReady:!!ready?.session,partnerReady:ready?.person.ready,creatorReady:ready?.state.ownerReady,standardAccepted:standard})
  async function send(event){
    event.preventDefault();if(busy||!draft.trim()||!ready?.allowed||!['standard','protected'].includes(mode))return
    const text=draft.trim()
    if(pending.current?.text===text&&pending.current.mode!==mode){setError('Confirme o envio anterior antes de trocar a proteção.');return}
    if(!pending.current||pending.current.text!==text)pending.current={id:crypto.randomUUID(),text,mode}
    const attempt=pending.current
    setBusy(true);setError('')
    try{
      attempt.payload ||= mode==='protected'?await ready.session.encrypt(story.author_id,text,attempt.id,{story_id:story.id}):standardMessage(user.id,story.author_id,text,attempt.id,{story_id:story.id})
      await messages.send(attempt.payload);setDraft('');pending.current=null;onNotify('Resposta enviada como mensagem ao dono do story.')
    }catch(issue){setError(issue.message)}finally{setBusy(false)}
  }
  return <div className="story-reply" data-has-drafts={draft.trim()?'true':undefined}>{error?<p className="chat-error" role="alert">{error}</p>:null}{ready&&!ready.allowed?<p>As mensagens com esta pessoa estão bloqueadas.</p>:<><p className="form-note">Seu comentário será uma mensagem para {story.name}.</p>{mode==='needs-setup'?<div className="chat-mode-notice"><p>A proteção adicional escolhida não está disponível aqui.</p><button className="secondary-button" onClick={()=>setStandard(true)}>Enviar como conversa padrão</button><button className="text-button" onClick={()=>onMessage({id:story.author_id,name:story.name})}>Abrir conversa</button></div>:null}<form onSubmit={send}><input aria-label="Responder ao story" placeholder="Enviar comentário privado…" value={draft} maxLength={4000} disabled={busy} onChange={event=>setDraft(event.target.value)}/><button className="send-button" aria-label="Enviar resposta ao story" disabled={busy||!draft.trim()||!ready?.allowed||!['standard','protected'].includes(mode)}><Send size={18}/></button></form></>}</div>
}

function StoryComposer({onClose,onPublished}) {
  const [file,setFile]=useState(null)
  const [preview,setPreview]=useState('')
  const [caption,setCaption]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  useEffect(()=>{if(!file)return;const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file])
  async function submit(event){event.preventDefault();if(busy||!file)return;setBusy(true);setError('');try{await itextApi.createStory(file,caption);await onPublished();onClose()}catch(issue){setError(issue.message)}finally{setBusy(false)}}
  return <Modal title="Criar story" onClose={()=>{if(!busy)onClose()}}><form className="stack-form" onSubmit={submit} data-has-drafts={file||caption?'true':undefined}><p>Publique uma foto ou um vídeo por 24 horas.</p><label>Foto ou vídeo<input required type="file" accept="image/*,video/*" disabled={busy} onChange={event=>{setError('');setFile(event.target.files?.[0]||null)}}/></label>{preview?(file?.type.startsWith('video/')?<video className="story-preview" src={preview} controls preload="metadata"/>:<img className="story-preview" src={preview} alt="Prévia do story"/>):null}<label>Legenda opcional<textarea value={caption} maxLength={280} onChange={event=>setCaption(event.target.value)}/></label>{error?<p className="chat-error" role="alert">{error}</p>:null}<div className="form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!file||busy}>{busy?'Publicando…':'Publicar story'}</button></div></form></Modal>
}

export default function Stories({user,authorId=null,onNotify,onMessage}) {
  const [rows,setRows]=useState([])
  const [selected,setSelected]=useState(null)
  const [creating,setCreating]=useState(false)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [confirmDelete,setConfirmDelete]=useState(false)
  const version=useRef(0)
  async function refresh(){const ticket=++version.current;const stories=await itextApi.stories(authorId);if(ticket===version.current){setRows(stories);setError('')}}
  useEffect(()=>{
    let active=true
    const load=()=>{void refresh().catch(issue=>{if(active)setError(issue.message)})}
    load();const timer=setInterval(load,45000)
    return()=>{active=false;version.current++;clearInterval(timer)}
  },[authorId,user.id])
  // Expiration is enforced by Postgres; this timer also closes a story left open past its expiry.
  useEffect(()=>{const timer=setInterval(()=>setRows(current=>current.some(row=>new Date(row.expires_at).getTime()<=Date.now())?current.filter(row=>new Date(row.expires_at).getTime()>Date.now()):current),1000);return()=>clearInterval(timer)},[])
  const story=rows.find(row=>row.id===selected)
  const ordered=[...new Set(rows.map(row=>row.author_id))].flatMap(author=>rows.filter(row=>row.author_id===author).sort((a,b)=>a.created_at.localeCompare(b.created_at)))
  const index=ordered.findIndex(row=>row.id===selected)
  const people=[...new Set(ordered.map(row=>row.author_id))].map(author=>ordered.find(row=>row.author_id===author))
  async function like(){if(busy||!story)return;setBusy(true);try{await itextApi.toggleStoryLike(story.id);await refresh()}catch(issue){setError(issue.message)}finally{setBusy(false)}}
  async function remove(){if(busy||!story)return;setBusy(true);try{await itextApi.deleteStory(story.id);setSelected(null);setConfirmDelete(false);await refresh();onNotify('Story apagado.')}catch(issue){setError(issue.message)}finally{setBusy(false)}}
  return <section className="stories-section" aria-label="Stories"><div className="stories-strip">{!authorId||authorId===user.id?<button className="story-circle story-create" onClick={()=>setCreating(true)}><span><Plus size={24}/></span><strong>Seu story</strong></button>:null}{people.map(person=><button className="story-circle" key={person.author_id} onClick={()=>{setSelected(person.id);setConfirmDelete(false)}}><span><Avatar src={person.avatar} alt=""/></span><strong>{person.author_id===user.id?'Ver seus stories':person.name}</strong></button>)}{authorId&&!rows.length?<p className="empty-inline">Sem stories ativos.</p>:null}</div>{error?<p className="chat-error" role="alert">{error}<button className="text-button" onClick={()=>void refresh().catch(issue=>setError(issue.message))}>Tentar novamente</button></p>:null}{creating?<StoryComposer onClose={()=>setCreating(false)} onPublished={async()=>{await refresh();onNotify('Story publicado por 24 horas.')}}/>:null}{selected?<Modal title={story?`Story de ${story.name}`:'Story indisponível'} onClose={()=>{setSelected(null);setConfirmDelete(false)}} size="lg">{story?<div className="story-viewer">{error?<p className="chat-error" role="alert">{error}</p>:null}<div className="story-topline"><span>{new Date(story.created_at).toLocaleString('pt-BR')}</span><span>{index+1} de {rows.length}</span></div><div className="story-media">{story.url?(story.media_type==='video'?<video key={story.id} src={story.url} controls playsInline preload="metadata"/>:<img src={story.url} alt={story.caption||'Foto do story'}/>):<p>Não foi possível carregar a mídia. Tente atualizar.</p>}</div>{story.caption?<p className="story-caption">{story.caption}</p>:null}<div className="story-controls"><button className="icon-button" aria-label="Story anterior" disabled={index<1} onClick={()=>{setSelected(ordered[index-1].id);setConfirmDelete(false)}}><ChevronLeft/></button><button className={story.liked?'story-like is-liked':'story-like'} aria-pressed={story.liked} aria-label="Curtir story" disabled={busy} onClick={like}><Heart size={22} fill={story.liked?'currentColor':'none'}/>{story.likes}</button>{story.author_id===user.id?<button className="icon-button" aria-label="Apagar story" onClick={()=>setConfirmDelete(true)}><Trash2 size={19}/></button>:null}<button className="icon-button" aria-label="Próximo story" disabled={index===rows.length-1} onClick={()=>{setSelected(ordered[index+1].id);setConfirmDelete(false)}}><ChevronRight/></button></div>{confirmDelete?<div className="story-delete-confirm"><p>Apagar este story para todos?</p><button className="secondary-button" onClick={()=>setConfirmDelete(false)}>Cancelar</button><button className="primary-button" disabled={busy} onClick={remove}>Apagar</button></div>:null}{story.author_id!==user.id?<StoryReply key={story.id} story={story} user={user} onNotify={onNotify} onMessage={onMessage}/>:null}</div>:<p>Este story expirou, foi apagado ou não está disponível para sua conta.</p>}</Modal>:null}</section>
}
