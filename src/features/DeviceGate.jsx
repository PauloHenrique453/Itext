import { useEffect,useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { deviceSecurity } from '../services/deviceSecurity.js'
import { lockChatSession } from '../services/chatSession.js'
import { signOut,requestPinIdentification,hasPinIdentification,resetPinAfterIdentification } from '../services/auth.js'

export default function DeviceGate({userId,children,recoveryError}){
 const [state,setState]=useState(null),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0),[sent,setSent]=useState(''),[confirmation,setConfirmation]=useState('')
 useEffect(()=>{
  let active=true
  setState(null)
  const check=()=>{void deviceSecurity.status(userId).then((next)=>{if(active){setState(next);setError('')}}).catch(issue=>{if(active){setState(null);setError(issue.message)}})}
  const changed=event=>{if(event.detail?.id===userId)check()}
  const crossTab=event=>{
   if(event.key!=='itext-device-event')return
   try{if(JSON.parse(event.newValue)?.id!==userId)return}catch{return}
   deviceSecurity.clear();lockChatSession();setPassword('');setState(null);check()
  }
  const lock=()=>{deviceSecurity.clear();lockChatSession();setPassword('');setState(null);check()}
  const restored=event=>{if(event.persisted)lock()}
  check();window.addEventListener('pageshow',restored);window.addEventListener('itext-device-changed',changed);window.addEventListener('storage',crossTab);window.addEventListener('itext-lock-device',lock)
  return()=>{active=false;window.removeEventListener('pageshow',restored);window.removeEventListener('itext-device-changed',changed);window.removeEventListener('storage',crossTab);window.removeEventListener('itext-lock-device',lock)}
 },[userId,retry])
 async function unlock(event){
  event.preventDefault();setBusy(true);setError('')
  try{if(identifying){if(password!==confirmation)throw new Error('As senhas não coincidem.');await resetPinAfterIdentification(userId,password)}else await deviceSecurity.unlock(userId,password);setPassword('');setConfirmation('');setState(await deviceSecurity.status(userId))}catch(issue){setError(issue.message)}finally{setBusy(false)}
 }
 async function identify(){
  setBusy(true);setError('')
  try{const email=await requestPinIdentification(userId);setSent(email)}catch(issue){setError(issue.message)}finally{setBusy(false)}
 }
 const identifying=hasPinIdentification(userId)
 if(state&&!state.locked&&!identifying)return children
 return <main className="entry-loading device-lock"><LockKeyhole size={32}/><h1>{identifying?'Identificação confirmada':'Itext protegido neste aparelho'}</h1>{error||recoveryError?<p role="alert">{error||recoveryError}</p>:null}{state?.locked||identifying?<form className="stack-form" onSubmit={unlock}><label>{identifying?'Crie um novo PIN ou senha':'PIN ou senha deste aparelho'}<input type="password" autoComplete={identifying?'new-password':'current-password'} required value={password} maxLength={256} onChange={event=>setPassword(event.target.value)}/></label>{identifying?<><label>Confirme o novo PIN ou senha<input type="password" autoComplete="new-password" required value={confirmation} maxLength={256} onChange={event=>setConfirmation(event.target.value)}/></label><p>Use um PIN com 8 números ou mais, ou uma senha com 12 caracteres ou mais. A senha é recomendada.</p><p>Redefinir remove a chave de mensagens lembrada neste aparelho. Para abrir as conversas depois, use seu código de recuperação uma vez.</p></>:null}<button className="primary-button" disabled={busy}>{busy?'Processando…':identifying?'Salvar nova senha':'Desbloquear Itext'}</button>{!identifying?<button className="text-button" type="button" disabled={busy} onClick={identify}>Esqueci meu PIN: enviar solicitação de identificação</button>:null}</form>:error?<button className="secondary-button" onClick={()=>setRetry(value=>value+1)}>Tentar novamente</button>:<p role="status">Conferindo proteção…</p>}{sent?<p role="status">Solicitação enviada para {sent}. Abra o link no mesmo navegador e aparelho em até 15 minutos. Só depois de validar o link será possível criar uma nova senha.</p>:null}<p>Este bloqueio protege a abertura do Itext neste navegador. Sua conta continua usando o login Google. Cada aparelho tem seu próprio bloqueio.</p><button className="text-button" disabled={busy} onClick={()=>{void signOut().catch(issue=>setError(issue.message))}}>Sair da conta</button></main>
}
