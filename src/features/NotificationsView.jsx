import { useEffect,useRef,useState } from 'react'
import { Bell,CheckCheck } from 'lucide-react'
import ViewHeader from '../components/ViewHeader.jsx'
import Avatar from '../components/Avatar.jsx'
import { ProfileName } from '../components/ProfileNavigation.jsx'
import { listenActivity,markNotifications,notifications } from '../services/activity.js'
const labels={post_like:'curtiu sua publicação.',comment:'comentou na sua publicação.',reply:'respondeu ao seu comentário.',comment_like:'curtiu seu comentário.',follow:'começou a seguir você.',message:'enviou uma mensagem.',story_like:'curtiu seu story.',page_follow:'começou a seguir sua página.',group_request:'pediu para entrar no seu grupo.',group_accepted:'aprovou sua entrada no grupo.'}
export default function NotificationsView({user,onOpenPost,onMessage,onNavigate,onProfile,onNotify}){
 const [data,setData]=useState({rows:[],hasMore:false,cursor:null})
 const loaded=useRef(50)
 loaded.current=Math.max(50,data.rows.length)
 const [error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0)
 useEffect(()=>{
  let active=true
  const load=()=>{void (async()=>{let next=await notifications();while(active&&next.hasMore&&next.rows.length<loaded.current){const page=await notifications(next.cursor);next={...page,rows:[...next.rows,...page.rows]}}if(active){setData(next);setError('')}})().catch(issue=>{if(active)setError(issue.message)}).finally(()=>{if(active)setLoading(false)})}
  load();const stop=listenActivity(user.id,load),timer=setInterval(load,30000)
  return()=>{active=false;stop();clearInterval(timer)}
 },[user.id,retry])
 async function more(){setLoading(true);try{const next=await notifications(data.cursor);setData(previous=>({...next,rows:[...previous.rows,...next.rows].filter((row,index,all)=>all.findIndex(item=>item.id===row.id)===index)}))}catch(issue){setError(issue.message)}finally{setLoading(false)}}
 async function readAll(){try{await markNotifications();setRetry(value=>value+1)}catch(issue){setError(issue.message)}}
 async function open(row){
  try{await markNotifications([row.id]);setData(previous=>({...previous,rows:previous.rows.map(item=>item.id===row.id?{...item,read_at:new Date().toISOString()}:item)}))}catch(issue){onNotify(issue.message)}
  if(row.kind==='message')onMessage({id:row.actor_id,name:row.name})
  else if(row.post_id)onOpenPost(row.post_id,row.comment_id)
  else if(row.group_id)onNavigate('communities')
  else if(row.page_id)onNavigate('pages')
  else onProfile(row.actor_id)
 }
 return <main className="feature-view"><ViewHeader title="Notificações" subtitle="Curtidas, respostas, seguidores, mensagens e atividades dos seus espaços." action={<button className="secondary-button" onClick={readAll}><CheckCheck size={17}/>Marcar todas como lidas</button>}/><div className="feature-content notification-list">{error?<p className="chat-error" role="alert">{error}<button className="text-button" onClick={()=>setRetry(value=>value+1)}>Tentar novamente</button></p>:null}{data.rows.map(row=><article key={row.id} className={row.read_at?'notification':'notification is-unread'}><Avatar userId={row.actor_id} src={row.avatar} alt={row.name}/><div><ProfileName id={row.actor_id}>{row.name}</ProfileName><button className="notification-open" onClick={()=>open(row)}><span>{labels[row.kind]}</span><time>{new Date(row.created_at).toLocaleString('pt-BR')}</time></button></div>{!row.read_at?<span className="notification-dot" aria-label="Não lida"/>:null}</article>)}{loading?<p role="status">Carregando notificações…</p>:!data.rows.length?<div className="profile-empty"><Bell size={30}/><h2>Nenhuma notificação por enquanto.</h2><p>As atividades reais aparecerão aqui.</p></div>:null}{data.hasMore?<button className="secondary-button" disabled={loading} onClick={more}>Carregar notificações anteriores</button>:null}</div></main>
}
