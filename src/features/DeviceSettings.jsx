import { useEffect,useState } from 'react'
import { deviceSecurity,lockDeviceEverywhere } from '../services/deviceSecurity.js'

export default function DeviceSettings({userId,onNotify}){
 const [state,setState]=useState(null),[current,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{let active=true;void deviceSecurity.status(userId).then(value=>{if(active)setState(value)}).catch(issue=>onNotify(issue.message));return()=>{active=false}},[userId,onNotify])
 async function save(event){
  event.preventDefault();setBusy(true)
  try{if(password!==confirmation)throw new Error('As senhas não coincidem.');await deviceSecurity.setPassword(userId,password,state.passwordEnabled?current:undefined);setState(await deviceSecurity.status(userId));setPassword('');setConfirmation('');setCurrent('');onNotify('Bloqueio ativado neste aparelho. Ele será solicitado ao abrir ou recarregar o Itext.')}
  catch(issue){onNotify(issue.message)}finally{setBusy(false)}
 }
 async function remove(){
  setBusy(true)
  try{await deviceSecurity.removePassword(userId,current);setState(await deviceSecurity.status(userId));setCurrent('');onNotify('Bloqueio deste aparelho desativado.')}
  catch(issue){onNotify(issue.message)}finally{setBusy(false)}
 }
 return <section className="settings-panel device-settings"><h2>Segurança deste aparelho</h2><p>Adicione um PIN ou senha para bloquear o Itext ao abrir ou recarregar. O login Google continua protegendo sua conta. Este bloqueio funciona neste navegador e pode ser removido ao apagar seus dados locais.</p>{state?<><form className="stack-form" onSubmit={save}>{state.passwordEnabled?<label>PIN ou senha atual<input type="password" autoComplete="current-password" value={current} maxLength={256} onChange={event=>setCurrent(event.target.value)}/></label>:null}<label>Novo PIN ou senha<input type="password" autoComplete="new-password" required maxLength={256} value={password} onChange={event=>setPassword(event.target.value)}/></label><label>Confirmar novo PIN ou senha<input type="password" autoComplete="new-password" required maxLength={256} value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></label><p className="form-note">PIN: pelo menos 8 números. Senha recomendada: pelo menos 12 caracteres. Nunca use o código de recuperação das mensagens como senha.</p><div className="form-actions"><button className="primary-button" disabled={busy}>{busy?'Salvando…':state.passwordEnabled?'Alterar bloqueio':'Ativar bloqueio'}</button>{state.passwordEnabled?<button className="secondary-button" type="button" disabled={busy||!current} onClick={remove}>Desativar bloqueio</button>:null}</div></form>{state.passwordEnabled?<button className="secondary-button" onClick={()=>lockDeviceEverywhere(userId)}>Bloquear agora</button>:null}</>:<p role="status">Conferindo opções de segurança…</p>}</section>
}
