import {useEffect,useState} from 'react'
import {AudioLines,Image,Video} from 'lucide-react'
import Modal from '../components/Modal.jsx'
import {StoryCanvas} from './Stories.jsx'
import {itextApi} from '../services/itextApi.js'
export function useStoryMessagePreviews(messages,scope){
 const [state,setState]=useState({key:'',items:{},error:''}),[retry,setRetry]=useState(0)
 const ids=messages.filter(row=>row.story_id&&!row.deleted_at).map(row=>row.id).sort(),key=scope+':'+ids.join(',')
 useEffect(()=>{let current=true;setState({key,items:{},error:''});if(!ids.length)return;const load=async()=>{if(document.hidden)return;try{const chunks=[];for(let index=0;index<ids.length;index+=100)chunks.push(itextApi.storyMessagePreviews(ids.slice(index,index+100)));const rows=(await Promise.all(chunks)).flat();if(current)setState({key,items:Object.fromEntries(rows.map(row=>[row.message_id,row.story])),error:''})}catch(issue){if(current)setState({key,items:{},error:issue.message})}};void load();const timer=setInterval(()=>void load(),45000);document.addEventListener('visibilitychange',load);return()=>{current=false;clearInterval(timer);document.removeEventListener('visibilitychange',load)}},[key,retry])
 return {items:state.key===key?state.items:{},error:state.key===key?state.error:'',retry:()=>setRetry(value=>value+1)}
}
export default function MessageStoryPreview({story,own,recipient=true,error,onRetry}){
 const [open,setOpen]=useState(false)
 if(!story)return <div className="message-story-context">Resposta a um story{error?<button type="button" onClick={onRetry}>Carregar prévia</button>:<small>Prévia indisponível, story apagado ou sem acesso.</small>}</div>
 const Icon=story.media_type==='audio'?AudioLines:story.media_type==='video'?Video:Image
 return <><button type="button" className="message-story-preview" onClick={()=>setOpen(true)} aria-label="Ver story desta resposta"><span className="message-story-thumb" style={{background:story.background_color,color:story.background_color==='#e5e7eb'?'#111827':'#fff'}}>{story.media_type==='image'&&story.url?<img src={story.url} alt="Foto do story respondido"/>:story.media_type==='video'&&story.url?<video src={story.url+'#t=0.1'} muted playsInline preload="metadata"/>:story.media_type==='text'?<span>{story.text_content}</span>:<Icon size={24}/>}</span><span><strong>{own?'Você respondeu ao story':recipient?'Respondeu ao seu story':'Resposta a um story'}</strong><small>{story.caption||story.text_content||'Toque para ver o story'}</small></span></button>{open?<Modal title="Story desta resposta" onClose={()=>setOpen(false)} size="story"><div className="message-story-full"><StoryCanvas type={story.media_type} url={story.url} text={story.text_content} background={story.background_color} font={story.font_style} caption={story.caption}/>{story.caption?<p>{story.caption}</p>:null}</div></Modal>:null}</>
}
