import { useState } from 'react'
import { Edit3, Trash2, X } from 'lucide-react'
import Modal from '../components/Modal.jsx'

export default function PostManage({post,onEdit,onDelete,onUploadMedia,onNotify}) {
  const [action,setAction]=useState('')
  const [text,setText]=useState(post.text||'')
  const [code,setCode]=useState(post.code||null)
  const [media,setMedia]=useState(post.media||[])
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  function open(next){setText(post.text||'');setCode(post.code||null);setMedia(post.media||[]);setError('');setAction(next)}
  async function upload(event) {
    const files=[...(event.target.files||[])].slice(0,6-media.length);event.target.value=''
    setBusy(true);setError('')
    try {for(const file of files){const result=await onUploadMedia(file);setMedia(rows=>[...rows,result.media])}}catch(issue){setError(issue.message)}finally{setBusy(false)}
  }
  async function submit(event) {
    event.preventDefault();if(busy)return
    setBusy(true);setError('')
    try {
      if(action==='delete')await onDelete(post.id)
      else await onEdit(post.id,{text,code,media})
      setAction('');onNotify(action==='delete'?'Publicação apagada.':'Publicação atualizada.')
    }catch(issue){setError(issue.message)}finally{setBusy(false)}
  }
  const valid=text.trim()||media.length||(code&&Object.values(code).some(value=>value.trim()))
  return <div className="post-manage"><button className="icon-button" aria-label="Editar publicação" onClick={()=>open('edit')}><Edit3 size={17}/></button><button className="icon-button" aria-label="Apagar publicação" onClick={()=>open('delete')}><Trash2 size={17}/></button>{action?<Modal title={action==='delete'?'Apagar publicação?':'Editar publicação'} onClose={()=>{if(!busy)setAction('')}}><form className="stack-form" onSubmit={submit} data-has-drafts={action==='edit'?'true':undefined}>{action==='delete'?<p>A publicação, as curtidas e os comentários serão removidos para todos. Esta ação não pode ser desfeita.</p>:<><label>Texto<textarea value={text} maxLength={10000} onChange={event=>setText(event.target.value)}/></label>{code?<div className="composer-code-grid">{['html','css','js'].map(key=><label key={key}>{key.toUpperCase()}<textarea value={code[key]||''} onChange={event=>setCode({...code,[key]:event.target.value})}/></label>)}</div>:null}<div className="composer-media-list">{media.map((item,index)=><span className="composer-media-chip" key={item.storagePath||index}>{item.type==='image'?'Foto':item.type==='video'?'Vídeo':'Áudio'}<button type="button" aria-label="Remover mídia" onClick={()=>setMedia(rows=>rows.filter((_,i)=>i!==index))}><X size={16}/></button></span>)}</div>{media.length<6?<label>Adicionar mídia<input type="file" multiple accept="image/*,video/*,audio/*" disabled={busy} onChange={upload}/></label>:null}</>}{error?<p className="chat-error" role="alert">{error}</p>:null}<div className="form-actions"><button className="secondary-button" type="button" disabled={busy} onClick={()=>setAction('')}>Cancelar</button><button className="primary-button" disabled={busy||(action==='edit'&&!valid)}>{busy?'Salvando…':action==='delete'?'Apagar':'Salvar alterações'}</button></div></form></Modal>:null}</div>
}
