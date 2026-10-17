import { lockChatSession } from './chatSession.js'
import { createClient } from '@supabase/supabase-js'
import { enabledLoginProviders, loginOptions, readLoginCallback, loginErrorMessage } from './loginOptions.js'

export const independent = true
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const supabase = independent && url && key ? createClient(url, key, {
  auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
}) : null

let initialized
export async function initializeAuth() {
  if (!independent) return null
  if (!supabase) throw new Error('O login Google ainda não foi configurado pelo administrador.')
  initialized ||= (async () => {
    const callback = readLoginCallback(window.location.href)
    if (callback.error || callback.code) {
      // Consume the callback once, including error fragments that used to disappear silently.
      window.history.replaceState({}, '', callback.cleaned)
    }
    if (callback.error) throw new Error(loginErrorMessage(callback.error))
    if (callback.code) {
      const { error } = await supabase.auth.exchangeCodeForSession(callback.code)
      if (error) throw new Error(loginErrorMessage(error))
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
  lockChatSession()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  window.location.assign('/')
}
