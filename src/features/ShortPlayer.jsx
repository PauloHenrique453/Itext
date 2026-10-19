import { useEffect,useLayoutEffect,useRef,useState } from 'react'
import { Heart,Maximize,MessageCircle,Pause,Play,Share2,Volume2,VolumeX } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import PostViews,{usePostViews} from '../components/PostViews.jsx'
import {HashtagText} from '../components/Hashtags.jsx'
import { ProfileName } from '../components/ProfileNavigation.jsx'
import usePostLike from '../hooks/usePostLike.js'
import { mediaTime } from '../services/mediaFormats.js'
import { SHORT_MAX_SECONDS,shortAddress,syncShortPlayback } from '../services/shorts.js'
export default function ShortPlayer({clip,user,active,nearby,blocked,muted,onMuted,onComments,onNotify,onFollow,following,onRetry}){
 const {post,media}=clip,video=useRef(null),stage=useRef(null)
 const [paused,setPaused]=useState(false),[playing,setPlaying]=useState(false),[current,setCurrent]=useState(0),[duration,setDuration]=useState(0),[error,setError]=useState(''),[expanded,setExpanded]=useState(false)
 const views=usePostViews(stage,post,user,active&&!blocked)
 const reaction=usePostLike(post,null,onNotify)
 useLayoutEffect(()=>{setError('');setDuration(0);setCurrent(0);setPlaying(false)},[media.url])
 useEffect(()=>{if(!active)setPaused(false)},[active])
 useEffect(()=>{
  const node=video.current;if(!node)return
  return syncShortPlayback(node,active&&!blocked&&!paused&&duration>0&&!error,()=>setPaused(true))
 },[active,blocked,paused,duration,error,media.url])

 function metadata(event){const value=event.currentTarget.duration;if(!Number.isFinite(value)||value<=0||(!post.viewerOnly&&value>SHORT_MAX_SECONDS)){event.currentTarget.pause();setError('Este vídeo não atende ao limite de 10 minutos do Ishort.');return}setDuration(value)}
 function seek(event){const node=video.current;if(node){node.currentTime=Number(event.target.value);setCurrent(Number(event.target.value))}}
 function toggle(){if(!active||blocked||error)return;setPaused(playing)}
 async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else if(stage.current?.requestFullscreen)await stage.current.requestFullscreen();else if(video.current?.webkitEnterFullscreen)video.current.webkitEnterFullscreen();else onNotify('A tela cheia não está disponível neste navegador.')}catch{onNotify('Não foi possível abrir em tela cheia.')}}
 async function share(){try{const url=shortAddress(post.id,window.location.href,clip.index);if(navigator.share)await navigator.share({title:`Vídeo de ${post.author} no Ishort`,url});else{await navigator.clipboard.writeText(url);onNotify('Link do Ishort copiado.')}}catch(issue){if(issue.name!=='AbortError')onNotify('Não foi possível compartilhar o vídeo.')}}
 return <article ref={stage} className={`ishort-clip${active?' is-active':''}`} aria-label={`Vídeo de ${post.author}`}>
  <div className="ishort-video-shell"><video ref={video} src={nearby?media.url:undefined} playsInline loop muted={muted} preload={active?'metadata':'none'} onLoadedMetadata={metadata} onTimeUpdate={event=>setCurrent(event.currentTarget.currentTime)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onError={()=>{if(nearby)setError('Não foi possível reproduzir o vídeo. Atualize ou tente um formato compatível.')}}/>{!error?<button type="button" className="ishort-tap-target" aria-label={playing?'Pausar vídeo':'Reproduzir vídeo'} onClick={toggle}>{!playing?<span><Play size={36} fill="currentColor"/></span>:null}</button>:<div className="ishort-player-error" role="alert"><p>{error}</p><button className="secondary-button" onClick={onRetry}>Atualizar vídeo</button></div>}</div>
  <button type="button" className="ishort-sound" aria-label={muted?'Ativar som':'Silenciar vídeo'} aria-pressed={!muted} onClick={()=>onMuted(!muted)}>{muted?<VolumeX size={21}/>:<Volume2 size={21}/>}</button>
  <div className="ishort-author-copy"><div className="ishort-author-row"><Avatar userId={post.authorId} src={post.avatar} alt={post.author} size="sm"/><ProfileName id={post.authorId}>{post.author}</ProfileName>{post.authorId!==user.id?<button className="ishort-follow" disabled={following.pending} aria-pressed={following.value} onClick={()=>onFollow(post.authorId)}>{following.value?'Seguindo':'Seguir'}</button>:null}</div>{media.partsTotal>1?<span className="ishort-series">Parte {media.partNumber} de {media.partsTotal}</span>:null}{post.text?<div className={`ishort-caption${expanded?' is-expanded':''}`}><p><HashtagText text={post.text}/></p>{post.text.length>100?<button className="text-button" onClick={()=>setExpanded(value=>!value)}>{expanded?'Menos':'Mais'}</button>:null}</div>:null}</div>
  <aside className="ishort-actions" aria-label="Interações do vídeo"><PostViews value={views}/><Avatar userId={post.authorId} src={post.avatar} alt={post.author}/><button type="button" disabled={reaction.pending} aria-pressed={reaction.liked} className={reaction.liked?'is-liked':''} aria-label={reaction.liked?'Remover curtida do vídeo':'Curtir vídeo'} onClick={reaction.toggle}><Heart size={27} fill={reaction.liked?'currentColor':'none'}/><span>{reaction.likes}</span></button><button type="button" aria-label="Abrir comentários do vídeo" onClick={()=>onComments(post)}><MessageCircle size={26}/><span>{post.comments}</span></button><button type="button" aria-label="Compartilhar vídeo" onClick={share}><Share2 size={25}/><span>Enviar</span></button></aside>
  <div className="ishort-transport"><button type="button" aria-label={playing?'Pausar reprodução':'Iniciar reprodução'} onClick={toggle} disabled={!!error}>{playing?<Pause size={20} fill="currentColor"/>:<Play size={20} fill="currentColor"/>}</button><time>{mediaTime(current)}</time><input type="range" aria-label="Posição do vídeo" min={0} max={duration||1} step={0.1} value={Math.min(current,duration||1)} disabled={!duration||!!error} onChange={seek}/><time>{mediaTime(duration)}</time><button type="button" aria-label="Tela cheia do vídeo" onClick={fullscreen}><Maximize size={20}/></button></div>
 </article>
}
