import { Download, ExternalLink, FileText } from 'lucide-react'
import { extractLinks } from '../services/content.js'
export default function PostMedia({media=[],image}) {
 const items=image?[{url:image,type:'image'},...media]:media
 if(!items.length)return null
 return <div className="post-media-list">{items.map((item,index)=>!item.url?<p key={index} className="form-note">Mídia indisponível.</p>:item.type==='file'?<a className="post-file" key={item.storagePath||index} href={item.url} target="_blank" rel="noopener noreferrer" download={item.name||true}><FileText size={24}/><span><strong>{item.name||'Arquivo anexado'}</strong><small>{item.size?`${(item.size/1000000).toFixed(1)} MB · `:''}Baixar arquivo</small></span><Download size={18}/></a>:item.type==='audio'?<audio key={item.url} className="post-audio" src={item.url} controls preload="metadata"/>:item.type==='video'?<video key={item.url} className="post-card__media" src={item.url} controls playsInline preload="metadata"/>:<img key={item.url} className="post-card__media" src={item.url} alt={item.name||'Mídia publicada no Itext'} loading="lazy"/>)}</div>
}
export function PostLinks({text}){return <div className="post-links">{extractLinks(text).map(url=><a key={url} href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={19}/><span><strong>{new URL(url).hostname}</strong><small>{url}</small></span></a>)}</div>}
