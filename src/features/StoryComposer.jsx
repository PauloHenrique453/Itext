import {useEffect,useRef,useState} from 'react'
import {AudioLines,Image as ImageIcon,LoaderCircle,RotateCcw,Square,Type,Upload,Video,X} from 'lucide-react'
import Modal from '../components/Modal.jsx'
import {itextApi} from '../services/itextApi.js'
import {attachmentInfo} from '../services/content.js'
import {storyColors,storyFonts,mediaTime} from '../services/mediaFormats.js'
import {inspectShortSource} from '../services/shorts.js'
import {createVideoEditor} from '../services/videoEditor.js'
import {storyPresentationDefaults,storyPresentationOptions,storySelection,storyAttempt,publishStoryAttempt} from '../services/storyEditor.js'
import {StoryCanvas} from './Stories.jsx'
import VideoTrim from './VideoTrim.jsx'
import './ishort.css'
import './story-editor.css'

export default function StoryComposer({onClose,onPublished}){
 const [kind,setKind]=useState('text'),[file,setFile]=useState(null),[info,setInfo]=useState(null),[preview,setPreview]=useState(''),[caption,setCaption]=useState(''),[text,setText]=useState(''),[background,setBackground]=useState(storyColors[0]),[font,setFont]=useState('classic'),[presentation,setPresentation]=useState({...storyPresentationDefaults,position:'middle'}),[start,setStart]=useState(0),[end,setEnd]=useState(0),[reading,setReading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[progress,setProgress]=useState(null),[tab,setTab]=useState('edit')
 const input=useRef(null),player=useRef(null),editor=useRef(null),controller=useRef(null),attempt=useRef(null),version=useRef(0),mounted=useRef(true)
 const locked=busy||reading||!!attempt.current?.publishing
 let selectionError='';if(info){try{storySelection(info,start,end)}catch(issue){selectionError=issue.message}}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;version.current++;controller.current?.abort();editor.current?.dispose()}},[])
 useEffect(()=>{if(!file){setPreview('');return}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file])
 useEffect(()=>{if(player.current?.readyState){player.current.pause();player.current.currentTime=start}},[start,end])
 function resetAttempt(){attempt.current=null;setError('');setStatus('');setProgress(null)}
 function change(key,value){resetAttempt();setPresentation(previous=>({...previous,[key]:value}))}
 function remove(){version.current++;setFile(null);setInfo(null);setPreview('');setReading(false);resetAttempt();editor.current?.dispose();editor.current=null;if(input.current)input.current.value=''}
 function format(value){remove();setKind(value);setTab('edit')}
 async function selectFile(next){
  if(locked||!next)return
  const ticket=++version.current,type=next.type?.split('/')[0]
  resetAttempt();setError('');setReading(true);setFile(null);setInfo(null);editor.current?.dispose();editor.current=null
  try{
   if(!['image','audio','video'].includes(type))throw new Error('Escolha uma foto, vídeo ou áudio.')
   const metadata=type==='video'?await inspectShortSource(next):(attachmentInfo(next),null)
   if(ticket!==version.current)return
   setKind(type);setFile(next);setInfo(metadata);setStart(0);setEnd(metadata?Math.min(60,metadata.duration):0)
  }catch(issue){if(ticket===version.current)setError(issue.message)}finally{if(ticket===version.current)setReading(false)}
 }
 async function previewSelection(){if(!player.current)return;setTab('preview');player.current.currentTime=start;try{await player.current.play()}catch{setError('Não foi possível assistir à prévia. Tente um vídeo MP4 com H.264/AAC.')}}
 async function submit(event){
  event.preventDefault();if(busy||reading||selectionError||(kind==='text'?!text.trim():!file))return
  setBusy(true);setError('');setProgress(null);player.current?.pause();controller.current=new AbortController()
  attempt.current ||= storyAttempt({file,info,start,end,options:{caption,text,background,font,presentation}})
  editor.current ||= createVideoEditor()
  try{
   await publishStoryAttempt(attempt.current,{signal:controller.current.signal,render:(...args)=>editor.current.render(...args),upload:file=>itextApi.uploadMedia(file),publish:payload=>itextApi.publishStory(payload),onStatus:value=>{if(mounted.current)setStatus(value)},onProgress:value=>{if(mounted.current)setProgress(value)}})
   // A refresh failure must never publish the same story a second time.
   try{await onPublished()}catch{/* The saved story will appear on the next refresh. */}
   if(mounted.current)onClose()
  }catch(issue){if(mounted.current)setError(issue.name==='AbortError'?'Interrompido. Sua seleção foi mantida; você pode continuar.':issue.message)}finally{if(mounted.current){setBusy(false);setProgress(null);setStatus('')}}
 }
 const ready=kind==='text'?!!text.trim():!!file
 return <Modal title="Criar story" size="lg" onClose={()=>{if(!busy)onClose()}}><form className={`stack-form story-compose story-editor story-editor--${tab}`} onSubmit={submit} data-has-drafts={file||caption||text?'true':undefined} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(!locked)void selectFile(event.dataTransfer.files?.[0])}}>
  <div className="story-compose-intro"><div><h3>Crie do seu jeito.</h3><p>Edite, confira a prévia e compartilhe seu momento.</p></div><span className="story-expiry-badge">24 horas</span></div>
  <fieldset disabled={locked} className="story-kind"><legend>Formato</legend>{[['text','Texto',Type],['image','Foto',ImageIcon],['video','Vídeo',Video],['audio','Áudio',AudioLines]].map(([value,label,Icon])=><label key={value}><input type="radio" name="story-kind" checked={kind===value} onChange={()=>format(value)}/><Icon size={20}/>{label}</label>)}</fieldset>
  <div className="story-editor-tabs" role="group" aria-label="Editor e prévia">{[['edit','Editar'],['preview','Prévia']].map(([value,label])=><button key={value} type="button" aria-pressed={tab===value} onClick={()=>setTab(value)}>{label}</button>)}</div>
  <div className="story-compose-grid"><div className="story-compose-options">
   {kind!=='text'?<div className="story-upload-area"><input ref={input} type="file" accept={`${kind}/*`} className="sr-only" aria-label="Escolher mídia do story" disabled={locked} onChange={event=>{const next=event.target.files?.[0];event.target.value='';void selectFile(next)}}/><button type="button" className="secondary-button" disabled={locked} onClick={()=>input.current?.click()}><Upload size={18}/>{reading?'Lendo arquivo…':file?'Trocar arquivo':`Escolher ${kind==='video'?'vídeo':kind==='image'?'foto':'áudio'}`}</button><small>{kind==='video'?'Original até 200 MB. Arraste as alças para escolher até 10 minutos; o trecho enviado pode ter até 50 MB.':kind==='image'?'Até 8 MB. Você também pode arrastar uma foto para cá.':'Até 18 MB. Adicione texto e escolha o fundo do áudio.'}</small>{file?<div className="story-source-info"><span><strong>{file.name}</strong><small>{(file.size/1000000).toFixed(1)} MB{info?` · ${mediaTime(info.duration)} de duração`:''}</small></span><button type="button" className="icon-button" disabled={locked} aria-label="Remover mídia" onClick={remove}><X size={18}/></button></div>:null}</div>:null}
   {info?<><VideoTrim duration={info.duration} start={start} end={end} mode="trim" seconds={600} allowParts={false} disabled={locked} onStart={value=>{resetAttempt();setStart(value)}} onEnd={value=>{resetAttempt();setEnd(value)}} onPreview={previewSelection}/><p className="story-selection-note">Será enviado somente {mediaTime(start)} → {mediaTime(end)} ({mediaTime(end-start)}).{info.duration<=600?<button type="button" className="text-button" disabled={locked} onClick={()=>{resetAttempt();setStart(0);setEnd(info.duration)}}>Usar vídeo inteiro</button>:null}</p></>:null}
   <label>Texto {kind!=='text'?'opcional':''}<textarea required={kind==='text'} rows={3} value={text} disabled={locked} maxLength={1000} placeholder="Escreva seu story…" onChange={event=>{resetAttempt();setText(event.target.value)}}/><small>{text.length}/1000</small></label>
   <div className="story-edit-fields"><label>Fonte<select value={font} disabled={locked} onChange={event=>{resetAttempt();setFont(event.target.value)}}>{Object.keys(storyFonts).map((value,index)=><option key={value} value={value}>{['Clássica','Serifada','Arredondada','Monoespaçada'][index]}</option>)}</select></label>{[['size','Tamanho'],['align','Alinhamento'],['position','Posição do texto'],['color','Cor do texto']].map(([key,label])=><label key={key}>{label}<select value={presentation[key]} disabled={locked} onChange={event=>change(key,event.target.value)}>{storyPresentationOptions[key].map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label>)}</div>
   <fieldset className="story-colors" disabled={locked}><legend>Cor de fundo</legend>{storyColors.map(color=><label key={color} style={{background:color}}><input type="radio" name="story-color" aria-label={`Cor ${color}`} checked={background===color} onChange={()=>{resetAttempt();setBackground(color)}}/><span aria-hidden="true">{background===color?'✓':''}</span></label>)}</fieldset>
   {['image','video'].includes(kind)?<div className="story-edit-fields">{[['fit','Enquadramento'],['filter','Filtro']].map(([key,label])=><label key={key}>{label}<select value={presentation[key]} disabled={locked} onChange={event=>change(key,event.target.value)}>{storyPresentationOptions[key].map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label>)}</div>:null}
   {kind==='video'?<label className="story-audio-choice"><input type="checkbox" checked={presentation.muted} disabled={locked} onChange={event=>change('muted',event.target.checked)}/>Começar sem som</label>:null}
   <button type="button" className="text-button" disabled={locked} onClick={()=>{resetAttempt();setPresentation({...storyPresentationDefaults,position:'middle'});setFont('classic');setBackground(storyColors[0])}}><RotateCcw size={16}/>Restaurar visual</button>
   <label>Legenda opcional<textarea rows={2} value={caption} disabled={locked} maxLength={280} onChange={event=>{resetAttempt();setCaption(event.target.value)}}/><small>{caption.length}/280</small></label>
  </div><div className="story-preview-panel"><span className="story-preview-label">PRÉVIA DO SEU STORY</span><StoryCanvas preview type={kind} url={preview} text={text} background={background} font={font} caption={caption} presentation={presentation} videoRef={player} onVideoMetadata={event=>{event.currentTarget.currentTime=start}} onVideoTime={event=>{if(!info)return;const node=event.currentTarget;if(node.currentTime>=end)node.pause();else if(node.currentTime<start)node.currentTime=start}}/>{caption?<p className="story-preview-caption">{caption}</p>:null}<small>Visível por 24 horas. Respostas chegam nas suas mensagens.</small></div></div>
  {reading?<p role="status"><LoaderCircle size={17}/>Lendo vídeo e preparando seleção…</p>:null}{selectionError||error?<p className="chat-error" role="alert">{selectionError||error}</p>:null}{status?<p className="ishort-cut-status" role="status">{status}</p>:null}{progress!==null?<progress max={1} value={progress} aria-label="Progresso do corte do story"/>:null}
  {busy&&info&&!attempt.current?.uploaded?<button type="button" className="secondary-button" onClick={()=>controller.current?.abort()}><Square size={16}/>Interromper preparação</button>:null}
  {attempt.current?.publishing&&!busy?<p className="form-note">Use Continuar envio para confirmar o mesmo story, sem duplicar. A mídia preparada foi mantida nesta janela.</p>:null}
  {info?<p className="form-note">O corte é feito neste aparelho e pode demorar. O original completo não é enviado quando você escolhe um trecho. <a href="/licenses/video-editor.txt" target="_blank" rel="noopener noreferrer">Licenças do editor</a></p>:null}
  <div className="form-actions story-editor-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy||reading||!ready||!!selectionError}>{busy?'Preparando seu story…':attempt.current?'Continuar envio':'Publicar story'}</button></div>
 </form></Modal>
}
