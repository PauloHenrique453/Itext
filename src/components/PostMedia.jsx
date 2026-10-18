import { useContext,useState } from 'react'
import { Download,ExternalLink,FileText,Play } from 'lucide-react'
import { extractLinks } from '../services/content.js'
import { videoEmbed } from '../services/mediaFormats.js'
import { PhotoNavigation } from './ProfileNavigation.jsx'
import AudioPlayer from './AudioPlayer.jsx'
import FeedVideo from './FeedVideo.jsx'
export default function PostMedia({media=[],image,postId}) {
 const openPhoto=useContext(PhotoNavigation)
 const items=image?[{url:image,type:'image'},...media]:media
 if(!items.length)return null
 let photoIndex=-1
 return <div className="post-media-list">{items.map((item,index)=>{
  if(item.type==='image')photoIndex++
  const selected=photoIndex
  if(!item.url)return <p key={index} className="form-note">Mídia indisponível.</p>
  if(item.type==='file')return <a className="post-file" key={item.storagePath||index} href={item.url} target="_blank" rel="noopener noreferrer" download={item.name||true}><FileText size={24}/><span><strong>{item.name||'Arquivo anexado'}</strong><small>{item.size?`${(item.size/1000000).toFixed(1)} MB · `:''}Baixar arquivo</small></span><Download size={18}/></a>
  if(item.type==='audio')return <AudioPlayer key={item.url} src={item.url} title={item.name||'Áudio publicado'}/>
  if(item.type==='video')return <FeedVideo key={item.url} item={item} postId={postId} index={index-(image?1:0)}/>
  const photo=<img className="post-card__media" src={item.url} alt={item.name||'Foto publicada no Itext'} loading="lazy"/>
  return postId&&openPhoto?<button type="button" className="post-photo-open" key={item.url} onClick={()=>openPhoto({postId,index:selected})} aria-label="Abrir foto em tela cheia">{photo}</button>:<span key={item.url}>{photo}</span>
 })}</div>
}
export function VideoEmbed({video}){
 const [playing,setPlaying]=useState(false)
 return <section className={`video-embed${video.portrait?' video-embed--portrait':''}`} aria-label={`Vídeo do ${video.provider}`}><div className="video-embed-player">{playing?<iframe src={video.src+(video.provider==='Instagram'?'':`${video.src.includes('?')?'&':'?'}autoplay=1`)} title={`Vídeo do ${video.provider}`} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:<button type="button" className="video-embed-start" onClick={()=>setPlaying(true)}><span><Play size={32} fill="currentColor"/></span><strong>Reproduzir vídeo do {video.provider}</strong><small>O player oficial será carregado aqui.</small></button>}</div><footer><a href={video.href} target="_blank" rel="noopener noreferrer">Abrir no {video.provider}<ExternalLink size={14}/></a><small>A reprodução depende das permissões do vídeo e da plataforma.</small></footer></section>
}
export function PostLinks({text}){return <div className="post-links">{extractLinks(text).map(url=>{const video=videoEmbed(url);return video?<VideoEmbed key={url} video={video}/>:<a key={url} href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={19}/><span><strong>{new URL(url).hostname}</strong><small>{url}</small></span></a>})}</div>}
