import { useEffect,useRef,useState } from 'react'
import { Film,Upload,Video,X } from 'lucide-react'
import Modal from '../components/Modal.jsx'
import { itextApi } from '../services/itextApi.js'
import { inspectShort } from '../services/shorts.js'
import { mediaTime } from '../services/mediaFormats.js'
export default function ShortComposer({onClose,onPublished}){
 const [file,setFile]=useState(null),[info,setInfo]=useState(null),[preview,setPreview]=useState(''),[text,setText]=useState(''),[reading,setReading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('')
 const version=useRef(0),upload=useRef(null),attempt=useRef(null),input=useRef(null)
 useEffect(()=>{if(!file){setPreview('');return}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file])
 useEffect(()=>()=>{version.current++},[])
 async function choose(event){const next=event.target.files?.[0];if(!next)return;const ticket=++version.current;setReading(true);setError('');setInfo(null);setFile(null);upload.current=null;attempt.current=null;try{const metadata=await inspectShort(next);if(ticket===version.current){setFile(next);setInfo(metadata)}}catch(issue){if(ticket===version.current)setError(issue.message)}finally{if(ticket===version.current)setReading(false);event.target.value=''}}
 async function submit(event){event.preventDefault();if(busy||reading||!file||!info)return;setBusy(true);setError('');try{
  setStatus('Enviando vídeo…')
  if(upload.current?.file!==file){const saved=await itextApi.uploadMedia(file);upload.current={file,media:{...saved.media,...info,short:true}}}
  if(attempt.current?.file!==file||attempt.current.text!==text.trim())attempt.current={id:crypto.randomUUID(),file,text:text.trim()}
  setStatus('Publicando no Ishort…')
  const saved=await itextApi.createShort({id:attempt.current.id,text:attempt.current.text,media:upload.current.media})
  onPublished(saved.id);onClose()
 }catch(issue){setError(issue.message)}finally{setBusy(false);setStatus('')}}
 return <Modal title="Publicar no Ishort" size="lg" onClose={()=>{if(!busy)onClose()}}><form className="stack-form ishort-compose" onSubmit={submit} data-has-drafts={file||text.trim()?'true':undefined}><p>Compartilhe um vídeo de até <strong>10 minutos</strong> e <strong>50 MB</strong>. O formato vertical é recomendado.</p><div className="ishort-compose-grid"><div className="ishort-file-preview">{preview?<video key={preview} src={preview} controls playsInline preload="metadata"/>:<div><Film size={40}/><strong>Seu próximo vídeo começa aqui.</strong><span>Escolha um vídeo do seu aparelho.</span></div>}</div><div className="ishort-compose-fields"><input ref={input} type="file" accept="video/*" className="sr-only" aria-label="Escolher vídeo para o Ishort" disabled={busy||reading} onChange={choose}/><button type="button" className="secondary-button" disabled={busy||reading} onClick={()=>input.current?.click()}><Upload size={18}/>{reading?'Lendo vídeo…':file?'Trocar vídeo':'Escolher vídeo'}</button>{file&&info?<div className="ishort-file-info"><strong>{file.name}</strong><span>{mediaTime(info.duration)} · {(file.size/1000000).toFixed(1)} MB · {info.width} × {info.height}</span><button type="button" className="text-button" disabled={busy} onClick={()=>{setFile(null);setInfo(null);upload.current=null;attempt.current=null}}><X size={14}/>Remover vídeo</button></div>:null}<label>Legenda<textarea value={text} maxLength={10000} rows={5} placeholder="Conte sobre este vídeo…" disabled={busy} onChange={event=>setText(event.target.value)}/></label><small>Publicado no seu perfil e no Ishort. Curtidas e comentários são os mesmos da publicação.</small>{error?<p role="alert" className="chat-error">{error}</p>:null}{status?<p role="status">{status}</p>:null}<button className="primary-button" disabled={busy||reading||!file||!info}><Video size={18}/>{busy?'Publicando…':'Publicar vídeo'}</button></div></div></form></Modal>
}
