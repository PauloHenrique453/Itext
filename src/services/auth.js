import { lockChatSession } from './chatSession.js'
import { deviceSecurity } from './deviceSecurity.js'
import { pinRecoveryStorageKey,verifiedEmailIdentification } from './pinRecovery.js'
import { createClient } from '@supabase/supabase-js'
import { enabledLoginProviders, loginOptions, readLoginCallback, loginErrorMessage } from './loginOptions.js'

export const independent = true
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = independent && url && key ? createClient(url, key, {
  auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
}) : null

let pinResetGrant=null
let initialized
export async function initializeAuth() {
  if (!independent) return null
  if (!supabase) throw new Error('O login Google ainda não foi configurado pelo administrador.')
  initialized ||= (async () => {
    const location=new URL(window.location.href)
    const emailHash=location.searchParams.get('token_hash')
    const emailType=location.searchParams.get('type')
    if(emailHash){location.searchParams.delete('token_hash');location.searchParams.delete('type');window.history.replaceState({},'',location.pathname+location.search+location.hash)}
    const callback = readLoginCallback(window.location.href)
    if (callback.error || callback.code) {
      // Consume the callback once, including error fragments that used to disappear silently.
      window.history.replaceState({}, '', callback.cleaned)
    }
    if (callback.error) throw new Error(loginErrorMessage(callback.error))
    if (emailHash||callback.code) {
      if(emailHash&&emailType!=='email')throw new Error('Este link de identificação não é válido.')
      const response=emailHash?await supabase.auth.verifyOtp({token_hash:emailHash,type:'email'}):await supabase.auth.exchangeCodeForSession(callback.code)
      if(response.error)throw new Error('O link de entrada ou identificação expirou ou já foi usado. Solicite um novo link.')
      if(!response.data.session?.access_token)throw new Error('Não foi possível validar a identificação. Solicite outro link.')
      const pendingText=localStorage.getItem(pinRecoveryStorageKey)
      let pending
      try{pending=JSON.parse(pendingText)}catch{/* No identification request on this browser. */}
      if(pending){
        if(await verifiedEmailIdentification(supabase.auth,response,pending,{emailHash:!!emailHash})){
          pinResetGrant={userId:pending.userId,expires:Date.now()+10*60*1000}
          localStorage.removeItem(pinRecoveryStorageKey)
        }
      }
    }
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    return data.session
  })()
  try { return await initialized } catch (error) { initialized = null; throw error }
}

export async function accessToken() {
  if (!independent) return null
  await initializeAuth()
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session?.access_token || null
}

export async function getLoginProviders() {
  if (!supabase) throw new Error('O serviço de login ainda não foi configurado.')
  const response = await fetch(`${new URL(url).origin}/auth/v1/settings`, {
    headers: { apikey: key }, signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error('Não foi possível carregar as formas de entrar. Tente novamente.')
  return enabledLoginProviders(await response.json())
}

export async function signInWithProvider(provider) {
  await initializeAuth()
  // Recheck availability at the time of the action, without displaying unconfigured providers.
  const enabled = await getLoginProviders()
  if (!enabled.some((entry) => entry.id === provider)) throw new Error('Essa forma de entrar não está disponível no momento.')
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: loginOptions(provider, window.location.origin, window.location.search) })
  if (error) throw error
}

export async function signInWithGoogle() {
  return signInWithProvider('google')
}

export async function signOut() {
  const {data}=await supabase.auth.getSession()
  const id=data.session?.user?.id
  if(id){try{await deviceSecurity.forget(id)}catch{/* A locked password-encrypted vault stays encrypted. */}}
  deviceSecurity.clear();pinResetGrant=null
  localStorage.removeItem(pinRecoveryStorageKey)
  lockChatSession()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  window.location.assign('/')
}

export async function requestPinIdentification(userId){
 const {data,error}=await supabase.auth.getUser()
 if(error||data.user?.id!==userId||!data.user.email||!data.user.email_confirmed_at)throw new Error('Entre novamente com a conta Google cujo bloqueio deseja redefinir.')
 const pending={userId,email:data.user.email.toLowerCase(),requestedAt:Date.now(),nonce:crypto.randomUUID()}
 localStorage.setItem(pinRecoveryStorageKey,JSON.stringify(pending))
 const response=await supabase.auth.signInWithOtp({email:data.user.email,options:{shouldCreateUser:false,emailRedirectTo:window.location.origin+'/'}})
 if(response.error){
  localStorage.removeItem(pinRecoveryStorageKey)
  if(response.error.code==='email_address_not_authorized')throw new Error('O envio de identificação por e-mail ainda precisa ser configurado pelo administrador.')
  if(response.error.status===429)throw new Error('Aguarde antes de solicitar outro e-mail de identificação.')
  throw new Error('Não foi possível solicitar a identificação por e-mail. Tente novamente ou contate o administrador.')
 }
 return data.user.email
}
export function hasPinIdentification(userId){return pinResetGrant?.userId===userId&&pinResetGrant.expires>Date.now()}
export async function resetPinAfterIdentification(userId,password){
 if(!hasPinIdentification(userId))throw new Error('Solicite um novo link de identificação para redefinir o bloqueio.')
 await deviceSecurity.resetPassword(userId,password)
 pinResetGrant=null;lockChatSession()
}
