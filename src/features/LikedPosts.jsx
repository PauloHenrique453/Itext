import { useEffect,useRef,useState } from 'react'
import PostMedia,{ PostLinks } from '../components/PostMedia.jsx'
import { ProfileName } from '../components/ProfileNavigation.jsx'
import { itextApi } from '../services/itextApi.js'

export default function LikedPosts({profileId}) {
 const [data,setData]=useState(null)
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const [retry,setRetry]=useState(0)
 const current=useRef(profileId)
 current.current=profileId
 useEffect(()=>{
  let active=true
  setData(null);setError('')
  const refresh=()=>{void itextApi.likedPosts(profileId).then((result)=>{if(active)setData(result)}).catch((issue)=>{if(active){setData(null);setError(issue.message)}})}
  refresh()
  const timer=setInterval(refresh,30000)
  return()=>{active=false;clearInterval(timer)}
 },[profileId,retry])
 async function more(){
  if(busy||!data?.hasMore)return
  setBusy(true)
  try{
   const next=await itextApi.likedPosts(profileId,data.cursor)
   if(current.current===profileId)setData((previous)=>next.visible?{...next,posts:[...(previous?.posts||[]),...next.posts].filter((row,index,all)=>all.findIndex((item)=>item.id===row.id)===index)}:next)
  }catch(issue){if(current.current===profileId){setData(null);setError(issue.message)}}finally{if(current.current===profileId)setBusy(false)}
 }
 if(error)return <p role="alert">{error}<button className="text-button" onClick={()=>setRetry((value)=>value+1)}>Tentar novamente</button></p>
 if(!data)return <p role="status">Carregando curtidas…</p>
 if(!data.visible)return <p className="empty-inline">Esta pessoa mantém suas curtidas privadas.</p>
 return <section className="liked-posts" aria-label="Publicações curtidas">{!data.posts.length?<p className="empty-inline">Nenhuma publicação curtida disponível para você.</p>:data.posts.map((post)=><article className="liked-post" key={post.id}><header><ProfileName id={post.authorId}>{post.author}</ProfileName><small>{new Date(post.createdAt).toLocaleDateString('pt-BR')}</small></header>{post.text?<p>{post.text}</p>:null}<PostLinks text={post.text}/><PostMedia postId={post.id} media={post.media}/>{post.hasCode?<small>Esta publicação contém um jogo ou código.</small>:null}</article>)}{data.hasMore?<button className="secondary-button" disabled={busy} onClick={more}>{busy?'Carregando…':'Carregar mais curtidas'}</button>:null}</section>
}
