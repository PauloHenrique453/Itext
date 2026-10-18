import { useEffect,useState } from 'react'
import { supabase } from '../services/auth.js'
import { privacyClient } from '../services/chatPrivacy.js'
import { recoveryCode } from '../services/chatCrypto.js'
import { deviceSecurity } from '../services/deviceSecurity.js'
import { lockChatSession } from '../services/chatSession.js'

const privacy=supabase?privacyClient(supabase):null
export function ChatAccessContent({state,ready,code,saved,busy,error,onCode,onSaved,onGenerate,onSave,onForget,onRetry,onToggle}){
 return <section className="settings-panel chat-security" id="messages-access"><h2>Proteção adicional das mensagens</h2>{error?<p className="chat-error" role="alert">{error}</p>:null}{!state?<><p role="status">Conferindo acesso às mensagens…</p><button className="secondary-button" disabled={busy} onClick={onRetry}>Verificar novamente</button></>:<><label className="settings-check"><input type="checkbox" checked={state.enabled===true} disabled={busy} onChange={event=>onToggle(event.target.checked)}/>Quero ativar a proteção adicional com código</label>{!state.enabled?null:ready?<><p role="status">Proteção adicional pronta neste aparelho. Ela será usada quando a outra pessoa também tiver ativado o recurso.</p><button className="secondary-button" disabled={busy} onClick={onForget}>Esquecer mensagens neste aparelho</button></>:!state.ownerReady&&!state.isOwner?<p>O criador precisa ativar as mensagens primeiro.</p>:<form className="stack-form" onSubmit={onSave}>{state.vault?<><label>Código de recuperação das mensagens<input type="password" autoComplete="off" spellCheck={false} value={code} onChange={event=>onCode(event.target.value)} required/></label><p>Use seu código guardado uma vez. Ele abre sua chave existente e não é enviado ao servidor. O PIN do aparelho é uma proteção separada.</p></>:<><button type="button" className="secondary-button" disabled={busy} onClick={onGenerate}>Gerar meu código de recuperação</button>{code?<><label>Guarde este código em um local seguro<input className="recovery-code" readOnly value={code} onFocus={event=>event.target.select()}/></label><label className="chat-consent"><input type="checkbox" checked={saved} onChange={event=>onSaved(event.target.checked)}/>Guardei o código e entendi a privacidade das mensagens.</label></>:null}</>}<p>As mensagens são criptografadas para os participantes e para o criador do Itext, que também pode ler as conversas.</p><p className="form-note">Ao salvar, o acesso fica protegido neste navegador. Use apenas em um aparelho seu. Quem usar sua sessão desbloqueada poderá abrir as conversas. Você pode ativar um PIN ou senha abaixo. Guarde o código para aparelhos novos; não há redefinição automática dessa chave.</p><button className="primary-button" disabled={busy||!code||(!state.vault&&!saved)}>{busy?'Salvando…':'Salvar acesso neste aparelho'}</button></form>}</>}</section>
}

export default function ChatAccessSettings({userId,onNotify}){
 const [state,setState]=useState(null),[ready,setReady]=useState(false),[code,setCode]=useState(''),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 useEffect(()=>{
  let active=true
  setState(null);setReady(false);setError('')
  void (async()=>{
   const current=await privacy.state()
   if(current.id!==userId)throw new Error('Entre novamente na conta correta.')
   let restored=null
   try{restored=await privacy.restore(current)}catch(issue){if(active)setError(issue.message)}
   if(active){setState(current);setReady(!!restored)}
  })().catch(issue=>{if(active)setError(issue.message)})
  return()=>{active=false}
 },[userId,retry])
 async function toggle(enabled){
  if(busy)return
  setBusy(true);setError('')
  try{
   const current=await privacy.setEnabled(enabled)
   setState(current);setCode('');setSaved(false)
   let restored=null
   if(enabled){try{restored=await privacy.restore(current)}catch(issue){setError(issue.message)}}
   setReady(!!restored)
   onNotify(enabled?'Proteção adicional escolhida. Configure seu acesso abaixo.':'Mensagens no modo padrão. As chaves e as mensagens antigas foram preservadas.')
  }catch(issue){setError(issue.message)}finally{setBusy(false)}
 }
 async function save(event){
  event.preventDefault();if(busy||!state?.enabled)return
  setBusy(true);setError('')
  try{
   if(state.vault)await privacy.unlock(state,code,{remember:true})
   else await privacy.activate(state,code,{remember:true})
   setCode('');setSaved(false);setState(await privacy.state());setReady(true)
   onNotify('Acesso salvo. Agora você pode abrir Mensagens sem repetir o código.')
  }catch(issue){
   setError(issue.message)
   // If registration succeeded before a lost reply, keep its original vault and recovery code.
   try{setState(await privacy.state())}catch{/* Original error stays visible. */}
  }finally{setBusy(false)}
 }
 async function forget(){
  if(busy)return
  setBusy(true);setError('')
  try{await deviceSecurity.forget(userId);lockChatSession();setReady(false);setCode('');onNotify('Acesso removido deste aparelho. Para recuperá-lo, use seu código aqui nas Configurações.')}
  catch(issue){setError(issue.message)}finally{setBusy(false)}
 }
 return <ChatAccessContent state={state} ready={ready} code={code} saved={saved} busy={busy} error={error} onCode={setCode} onSaved={setSaved} onGenerate={()=>{setCode(recoveryCode());setSaved(false)}} onSave={save} onForget={forget} onRetry={()=>setRetry(value=>value+1)} onToggle={toggle}/>
}
