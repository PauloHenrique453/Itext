import { useContext,useEffect,useRef,useState } from 'react'
import { Maximize,Pause,Play,Volume2,VolumeX } from 'lucide-react'
import { VideoNavigation } from './ProfileNavigation.jsx'
import { feedPlayback } from '../services/feedPlayback.js'
import { syncShortPlayback } from '../services/shorts.js'
export default function FeedVideo({item,postId,index}){
 const node=useRef(null),token=useRef({}),open=useContext(VideoNavigation)
 const [active,setActive]=useState(false),[muted,setMuted]=useState(true),[paused,setPaused]=useState(false),[playing,setPlaying]=useState(false),[blocked,setBlocked]=useState(false)
 useEffect(()=>{
  const id=token.current,unregister=feedPlayback.register(id,setActive)
  const observer=globalThis.IntersectionObserver?new IntersectionObserver(entries=>{for(const entry of entries)feedPlayback.update(id,entry.isIntersecting?entry.intersectionRatio:0)},{threshold:[0,.4,.6,.8,1],rootMargin:'-58px 0px -8% 0px'}):null
  if(node.current)observer?.observe(node.current)
  function visibility(){const hidden=document.hidden||document.body.classList.contains('has-modal')||document.body.classList.contains('has-short-viewer');setBlocked(hidden);feedPlayback.block(hidden)}
  visibility();document.addEventListener('visibilitychange',visibility)
  const changes=new MutationObserver(visibility);changes.observe(document.body,{attributes:true,attributeFilter:['class']})
  return()=>{observer?.disconnect();changes.disconnect();document.removeEventListener('visibilitychange',visibility);unregister()}
 },[])
 useEffect(()=>{if(!active)setPaused(false)},[active])
 useEffect(()=>syncShortPlayback(node.current,active&&!paused&&!blocked,()=>setPaused(true)),[active,paused,blocked,item.url])
 return <div className="feed-video"><video ref={node} className="post-card__media" src={item.url} playsInline muted={muted} loop preload="metadata" controls={!open||!postId} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}/>{open&&postId?<button className="feed-video-open" type="button" aria-label="Abrir vídeo em tela cheia no Ishort" onClick={()=>open({postId,index})}><span><Maximize size={18}/>Abrir no Ishort</span></button>:null}<div className="feed-video-controls"><button type="button" aria-label={playing?'Pausar vídeo':'Reproduzir vídeo'} onClick={()=>{if(!playing){feedPlayback.update(token.current,1);feedPlayback.prefer(token.current);setPaused(false);if(!globalThis.IntersectionObserver&&!blocked)void node.current.play().catch(()=>setPaused(true))}else setPaused(true)}}>{playing?<Pause size={20}/>:<Play size={20}/>}</button><button type="button" aria-label={muted?'Ativar som do vídeo':'Silenciar vídeo'} aria-pressed={!muted} onClick={()=>setMuted(value=>!value)}>{muted?<VolumeX size={20}/>:<Volume2 size={20}/>}</button></div></div>
}
