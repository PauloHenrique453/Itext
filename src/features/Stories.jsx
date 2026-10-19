import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Heart, Plus, Send, Share2, Trash2, X, Image as ImageIcon } from 'lucide-react'
import AudioPlayer from '../components/AudioPlayer.jsx'
import StoryComposer from './StoryComposer.jsx'
export {default as StoryComposer} from './StoryComposer.jsx'
import {storyPresentation,storyFilters} from '../services/storyEditor.js'
import { storyFonts } from '../services/mediaFormats.js'
import { storyAddress,storyIdFromSearch } from '../services/content.js'
import { ProfileName } from '../components/ProfileNavigation.jsx'
import Avatar from '../components/Avatar.jsx'
import Modal from '../components/Modal.jsx'
import { itextApi } from '../services/itextApi.js'
import { supabase } from '../services/auth.js'
import { messagesClient } from '../services/messaging.js'
import { privacyClient } from '../services/chatPrivacy.js'
import { unlockedChatSession } from '../services/chatSession.js'
import { chatMode, standardMessage } from '../services/chatMode.js'
import StoryActivity,{StoryExposure,StoryAudienceButton} from './StoryActivity.jsx'

const messages=supabase?messagesClient(supabase):null
const privacy=supabase?privacyClient(supabase):null

export function StoryReply({story,user,onNotify,onMessage}) {
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
  return <div className="story-reply" data-has-drafts={draft.trim()?'true':undefined}>{error?<p className="chat-error" role="alert">{error}</p>:null}{ready&&!ready.allowed?<p>As mensagens com esta pessoa estão bloqueadas.</p>:<><p className="form-note">Resposta privada para {story.name}. O dono pode ver sua visualização.</p>{mode==='needs-setup'?<div className="chat-mode-notice"><p>A proteção adicional escolhida não está disponível aqui.</p><button className="secondary-button" onClick={()=>setStandard(true)}>Enviar como conversa padrão</button><button className="text-button" onClick={()=>onMessage({id:story.author_id,name:story.name})}>Abrir conversa</button></div>:null}<form onSubmit={send}><input aria-label="Responder ao story" placeholder="Comentar…" value={draft} maxLength={4000} disabled={busy} onChange={event=>setDraft(event.target.value)}/><button className="send-button" aria-label="Enviar resposta ao story" disabled={busy||!draft.trim()||!ready?.allowed||!['standard','protected'].includes(mode)}><Send size={18}/></button></form></>}</div>
}

export function StoryCanvas({type,url,text='',background='#102a43',font='classic',caption='',preview=false,presentation={},videoRef=null,onVideoTime=null,onVideoMetadata=null}){
 const light=background.toLowerCase()==='#e5e7eb',style=storyPresentation({position:type==='text'||type==='audio'?'middle':'bottom',...presentation})
 const color=style.color==='auto'?(light&&type!=='image'&&type!=='video'?'#111827':'#ffffff'):{white:'#ffffff',black:'#111111',yellow:'#fde047'}[style.color]
 return <div className={`story-canvas story-canvas--${type} story-size-${style.size} story-align-${style.align} story-position-${style.position}`} style={{backgroundColor:background,color:light?'#111827':'#ffffff',fontFamily:storyFonts[font]||storyFonts.classic,'--story-text-color':color,'--story-text-panel':color==='#111111'?'#ffffffcc':'#0009','--story-fit':style.fit,'--story-filter':storyFilters[style.filter]}}>{type==='image'&&url?<img src={url} alt={caption||'Foto do story'}/>:type==='video'&&url?<video ref={videoRef} key={url} src={url} controls playsInline preload="metadata" muted={style.muted} onTimeUpdate={onVideoTime} onLoadedMetadata={onVideoMetadata}/>:type==='audio'&&url?<AudioPlayer key={url} src={url} title="Áudio do story"/>:type!=='text'?<p className="story-media-empty">{preview?'Escolha uma mídia para visualizar.':'Mídia indisponível. Tente atualizar o story.'}</p>:null}{text?<p className="story-text-overlay">{text}</p>:type==='text'?<p className="story-text-placeholder">Seu texto aparece aqui</p>:null}</div>
}

export default function Stories({user,authorId=null,onNotify,onMessage}) {
  const [rows,setRows]=useState([])
  const [selected,setSelected]=useState(()=>!authorId&&typeof window!=='undefined'?storyIdFromSearch(window.location.search):null)
  const selectedRef=useRef(selected);selectedRef.current=selected
  const [loading,setLoading]=useState(true)
  const [creating,setCreating]=useState(false)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [confirmDelete,setConfirmDelete]=useState(false)
  const [activity,setActivity]=useState(false)
  const version=useRef(0)
  async function refresh(){
    const ticket=++version.current,target=selectedRef.current
    const stories=await itextApi.stories(authorId)
    if(target&&!stories.some(row=>row.id===target)){const linked=await itextApi.stories(null,target);if(linked[0])stories.push(linked[0])}
    if(ticket===version.current){setRows(stories);setLoading(false);setError('')}
  }
  function closeStory(){setActivity(false);setSelected(null);setConfirmDelete(false);const url=new URL(window.location.href);if(url.searchParams.has('story')){url.searchParams.delete('story');window.history.replaceState(null,'',url)}}
  async function share(){if(!story)return;try{const url=storyAddress(story.id,window.location.href);if(navigator.share)await navigator.share({title:`Story de ${story.name} no Itext`,url});else{await navigator.clipboard.writeText(url);onNotify('Link do story copiado.')}}catch(issue){if(issue.name!=='AbortError')onNotify('Não foi possível compartilhar o story. Tente novamente.')}}
  useEffect(()=>{
    let active=true
    const load=()=>{void refresh().catch(issue=>{if(active){setError(issue.message);setLoading(false)}})}
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
  async function remove(){if(busy||!story)return;setBusy(true);try{await itextApi.deleteStory(story.id);closeStory();await refresh();onNotify('Story apagado.')}catch(issue){setError(issue.message)}finally{setBusy(false)}}
  function selectStory(id){setActivity(false);setSelected(id);setConfirmDelete(false)}
  function step(direction){const next=ordered[index+direction];if(next)selectStory(next.id)}
  return <section className="stories-section" aria-label="Stories">
    <div className="stories-strip">{!authorId||authorId===user.id?<button className="story-circle story-create" onClick={()=>setCreating(true)}><span><Plus size={24}/></span><strong>Seu story</strong></button>:null}{people.map(person=><StoryCircle key={person.author_id} person={person} userId={user.id} onOpen={()=>selectStory(person.id)}/>)}{authorId&&!rows.length?<p className="empty-inline">Sem stories ativos.</p>:null}</div>
    {error&&!selected?<p className="chat-error" role="alert">{error}<button className="text-button" onClick={()=>void refresh().catch(issue=>setError(issue.message))}>Tentar novamente</button></p>:null}
    {creating?<StoryComposer onClose={()=>setCreating(false)} onPublished={async()=>{await refresh();onNotify('Story publicado por 24 horas.')}}/>:null}
    {selected?<Modal title={story?`Story de ${story.name}`:loading?'Carregando story…':'Story indisponível'} onClose={closeStory} size="story" headerContent={story?<StoryHeader story={story} sequence={ordered.filter(row=>row.author_id===story.author_id)} onSelect={selectStory} onClose={closeStory} own={story.author_id===user.id} onDelete={()=>setConfirmDelete(true)}/>:null}>
      {story?<div className="story-viewer" onKeyDown={event=>{if(['INPUT','TEXTAREA','SELECT','VIDEO','AUDIO'].includes(event.target.tagName)||event.altKey||event.ctrlKey||event.metaKey)return;if(event.key==='ArrowLeft'){event.preventDefault();step(-1)}if(event.key==='ArrowRight'){event.preventDefault();step(1)}}}>
        <div className="story-viewer-scroll">
          {error?<p className="chat-error" role="alert">{error}<button className="text-button" onClick={()=>void refresh().catch(issue=>setError(issue.message))}>Tentar novamente</button></p>:null}
          <div className="story-stage"><StoryExposure key={story.id} story={story} user={user}><StoryCanvas type={story.media_type} url={story.url} text={story.text_content} background={story.background_color} font={story.font_style} caption={story.caption} presentation={story.presentation}/></StoryExposure><div className="story-stage-navigation"><button className="icon-button" aria-label="Story anterior" disabled={index<1} onClick={()=>step(-1)}><ChevronLeft size={22}/></button><button className="icon-button" aria-label="Próximo story" disabled={index===ordered.length-1} onClick={()=>step(1)}><ChevronRight size={22}/></button></div></div>
          {story.caption?<p className="story-caption">{story.caption}</p>:null}
          {confirmDelete?<div className="story-delete-confirm"><p>Apagar este story para todos?</p><button className="secondary-button" onClick={()=>setConfirmDelete(false)}>Cancelar</button><button className="primary-button" disabled={busy} onClick={remove}>Apagar</button></div>:null}
        </div>
        <StoryFooter onAudience={()=>setActivity(true)} story={story} user={user} busy={busy} onLike={like} onShare={share} onNotify={onNotify} onMessage={onMessage}/>
      </div>:<div className="story-unavailable"><span className="story-empty-symbol"><ImageIcon size={32}/></span><p role="status">{loading?'Carregando seu próximo momento…':'Este story expirou, foi apagado ou não está disponível para sua conta.'}</p>{error?<p className="chat-error" role="alert">{error}</p>:null}<button className="secondary-button" disabled={loading} onClick={()=>void refresh().catch(issue=>setError(issue.message))}>Tentar novamente</button></div>}
    </Modal>:null}
    {activity&&story&&story.author_id===user.id?<StoryActivity story={story} onClose={()=>setActivity(false)} onMessage={person=>{closeStory();onMessage(person)}}/>:null}
  </section>
}

export function StoryFooter({story,user,busy,onLike,onShare,onNotify,onMessage,onAudience}){
 return <footer className="story-footer">{story.author_id!==user.id?<StoryReply key={story.id} story={story} user={user} onNotify={onNotify} onMessage={onMessage}/>:<StoryAudienceButton key={story.id} story={story} onOpen={onAudience}/>}<div className="story-footer-actions"><button className={story.liked?'story-like is-liked':'story-like'} aria-pressed={story.liked} aria-label={story.liked?'Remover curtida do story':'Curtir story'} title="Curtir story" disabled={busy} onClick={onLike}><Heart size={24} fill={story.liked?'currentColor':'none'}/><span>{story.likes}</span></button><button type="button" className="icon-button story-share" aria-label="Compartilhar story" title="Compartilhar story" onClick={onShare}><Share2 size={23}/></button></div></footer>
}

export function StoryCircle({person,userId,onOpen}){
 return <button className="story-circle" aria-label={`Abrir stories de ${person.name}`} onClick={onOpen}><span><Avatar src={person.avatar} alt=""/></span><strong>{person.author_id===userId?'Ver seus stories':person.name}</strong></button>
}

export function StoryHeader({story,sequence,onSelect,onClose,own,onDelete}){
 const position=sequence.findIndex(row=>row.id===story.id)
 return <header className="story-viewer-header"><nav className="story-segments" aria-label="Stories desta pessoa">{sequence.map((row,index)=><button key={row.id} type="button" aria-label={`Ver story ${index+1} de ${story.name}`} aria-current={row.id===story.id?'step':undefined} onClick={()=>onSelect(row.id)} data-position={index<position?'before':row.id===story.id?'current':'after'}><span/></button>)}</nav><div className="story-heading-row"><div className="story-author"><Avatar userId={story.author_id} src={story.avatar} alt={story.name} size="sm"/><div className="story-author-copy"><ProfileName id={story.author_id}>{story.name}</ProfileName><div><time dateTime={story.created_at}>{new Date(story.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</time><span aria-label={`Story ${position+1} de ${sequence.length}`}>{position+1} / {sequence.length}</span></div></div></div><div className="story-heading-actions">{own?<button type="button" className="icon-button" title="Apagar story" aria-label="Apagar story" onClick={onDelete}><Trash2 size={18}/></button>:null}<button type="button" className="icon-button story-close" aria-label="Fechar story" title="Fechar story" onClick={onClose}><X size={24}/></button></div></div></header>
}
