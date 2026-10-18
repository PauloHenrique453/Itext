import { useEffect,useMemo,useRef,useState } from 'react'
import { Heart,Reply,Send,X } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import { ProfileName } from '../components/ProfileNavigation.jsx'
import Modal from '../components/Modal.jsx'
import { itextApi } from '../services/itextApi.js'
import { threadComments } from '../services/content.js'

export default function CommentsDialog({postId,user,onClose,onChanged=()=>{},focusComment=null}) {
 const [data,setData]=useState({rows:[],hasMore:false,cursor:null})
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [draft,setDraft]=useState('')
 const [reply,setReply]=useState(null)
 const [retry,setRetry]=useState(0)
 const [target,setTarget]=useState(focusComment)
 const pending=useRef(null)
 const loadingMore=useRef(false)
 const scrollArea=useRef(null)
 const list=useMemo(()=>threadComments(data.rows),[data.rows])
 useEffect(()=>{
  let active=true;setLoading(true)
  void itextApi.comments(postId).then(async initial=>{
   // A notification can point past the first page. Load until its actual row is present.
   let next=initial
   while(active&&target&&!next.rows.some(row=>row.id===target)&&next.hasMore){const page=await itextApi.comments(postId,next.cursor);next={...page,rows:[...next.rows,...page.rows]}}
   if(active){setData(next);setError('')}
  }).catch(issue=>{if(active)setError(issue.message)}).finally(()=>{if(active)setLoading(false)})
  return()=>{active=false}
 },[postId,retry,target])
 useEffect(()=>{if(!loading&&target)document.getElementById(`comment-${target}`)?.scrollIntoView({block:'nearest'})},[loading,target])
 async function more(){if(loadingMore.current||loading||!data.hasMore)return;loadingMore.current=true;setLoading(true);try{const next=await itextApi.comments(postId,data.cursor);setData(previous=>({...next,rows:[...previous.rows,...next.rows]}))}catch(issue){setError(issue.message)}finally{loadingMore.current=false;setLoading(false)}}
 async function send(event){
  event.preventDefault();if(!draft.trim()||busy)return
  const text=draft.trim(),parent=reply?.id||null
  if(!pending.current||pending.current.text!==text||pending.current.parent!==parent)pending.current={id:crypto.randomUUID(),text,parent}
  setBusy(true);setError('')
  try{await itextApi.replyComment(postId,text,parent,pending.current.id);setTarget(pending.current.id);setDraft('');setReply(null);pending.current=null;setRetry(value=>value+1);void onChanged()}catch(issue){setError(issue.message)}finally{setBusy(false)}
 }
 async function like(row){if(busy)return;setBusy(true);try{const liked=await itextApi.toggleCommentLike(row.id);setData(previous=>({...previous,rows:previous.rows.map(item=>item.id===row.id?{...item,liked,likes:Math.max(0,item.likes+(liked?1:-1))}:item)}));setError('')}catch(issue){setError(issue.message)}finally{setBusy(false)}}
 return <Modal title="Comentários e respostas" onClose={onClose} size="comments"><div className="comments-dialog" data-has-drafts={draft.trim()?'true':undefined}>{error?<p className="chat-error" role="alert">{error}<button className="text-button" onClick={()=>setRetry(value=>value+1)}>Tentar novamente</button></p>:null}<button className="secondary-button" disabled={loading} onClick={()=>setRetry(value=>value+1)}>Atualizar comentários</button><div className="comments-scroll" ref={scrollArea} tabIndex={0} role="region" aria-label="Lista de comentários e respostas" onScroll={event=>{const box=event.currentTarget;if(box.scrollHeight-box.scrollTop-box.clientHeight<180)void more()}}><div className="comment-thread">{list.map(row=><article key={row.id} id={`comment-${row.id}`} className={`thread-comment${row.id===target?' is-highlighted':''}`} style={{'--comment-depth':Math.min(row.depth,3)}}><Avatar userId={row.author_id} src={row.avatar} alt={row.author} size="sm"/><div><header><ProfileName id={row.author_id}>{row.author}</ProfileName><time>{new Date(row.created_at).toLocaleString('pt-BR')}</time></header>{row.parent_id?<small className="reply-label">Em resposta a {data.rows.find(parent=>parent.id===row.parent_id)?.author||'um comentário anterior'}</small>:null}<p>{row.text}</p><div className="comment-actions"><button disabled={busy} aria-pressed={row.liked} aria-label={row.liked?'Remover curtida do comentário':'Curtir comentário'} onClick={()=>like(row)}><Heart size={16} fill={row.liked?'currentColor':'none'}/>{row.likes}</button><button disabled={busy} onClick={()=>{setReply(row);document.getElementById('comment-draft')?.focus()}}><Reply size={16}/>Responder</button></div></div></article>)}</div>{loading?<p role="status">Carregando comentários…</p>:!list.length?<p className="empty-inline">Ainda não há comentários. Seja a primeira pessoa a comentar.</p>:null}{data.hasMore?<button className="secondary-button" disabled={loading} onClick={more}>Carregar mais comentários e respostas</button>:null}</div><form className="comment-compose" onSubmit={send}>{reply?<div className="chat-composer-context"><span>Respondendo a {reply.author}<small>{reply.text}</small></span><button type="button" className="icon-button" aria-label="Cancelar resposta" onClick={()=>setReply(null)}><X size={16}/></button></div>:null}<div><Avatar userId={user.id} src={user.avatar} alt="Você" size="sm"/><textarea id="comment-draft" aria-label="Seu comentário" placeholder={reply?'Escreva sua resposta…':'Escreva um comentário…'} rows={2} maxLength={2000} value={draft} disabled={busy} onChange={event=>setDraft(event.target.value)}/><button className="send-button" aria-label="Enviar comentário" disabled={busy||!draft.trim()}><Send size={18}/></button></div></form></div></Modal>
}
