import { useEffect,useState } from 'react'
import { RefreshCw,X } from 'lucide-react'
import { fetchAppVersion,hasNewVersion } from '../services/appVersion.js'
const current=typeof __ITEXT_VERSION__==='undefined'?'development':__ITEXT_VERSION__
export default function UpdateNotice(){
 const [latest,setLatest]=useState(null)
 const [dismissed,setDismissed]=useState('')
 useEffect(()=>{
  if(current==='development')return
  let active=true,pending=false
  async function check(){
   if(pending||document.visibilityState==='hidden')return
   pending=true
   try{const version=await fetchAppVersion();if(active&&hasNewVersion(current,version))setLatest(version.id)}catch{/* Offline or a legacy deployment is not an update. */}finally{pending=false}
  }
  void check()
  const timer=setInterval(check,60000)
  window.addEventListener('focus',check);window.addEventListener('online',check);document.addEventListener('visibilitychange',check)
  return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',check);window.removeEventListener('online',check);document.removeEventListener('visibilitychange',check)}
 },[])
 if(!latest||latest===dismissed)return null
 function update(){
  const dirty=[...document.querySelectorAll('textarea')].some((entry)=>entry.value.trim())||document.querySelector('.modal-backdrop form,[data-has-drafts="true"]')
  if(dirty&&!window.confirm('Há conteúdo em edição. Atualizar agora pode descartar alterações não enviadas. Deseja continuar?'))return
  window.location.reload()
 }
 return <aside className="update-notice" role="status"><RefreshCw size={21}/><span><strong>Uma nova versão do Itext está disponível.</strong><small>Atualize quando estiver pronto para continuar.</small></span><button className="primary-button" onClick={update}>Atualizar agora</button><button className="icon-button" aria-label="Lembrar na próxima versão" onClick={()=>setDismissed(latest)}><X size={18}/></button></aside>
}
