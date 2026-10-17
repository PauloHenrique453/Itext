import { createClient } from '@supabase/supabase-js'

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
    const current = new URL(window.location.href)
    const code = current.searchParams.get('code')
    const oauthError = current.searchParams.get('error_description')
    if (oauthError) {
      current.searchParams.delete('error_description'); current.searchParams.delete('error'); current.searchParams.delete('error_code')
      window.history.replaceState({}, '', `${current.pathname}${current.search}`)
      throw new Error(oauthError)
    }
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      current.searchParams.delete('code')
      window.history.replaceState({}, '', `${current.pathname}${current.search}${current.hash}`)
      if (error) throw error
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

export async function signInWithGoogle() {
  await initializeAuth()
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: {
    redirectTo: `${window.location.origin}/`, scopes: 'openid email profile',
  } })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  window.location.assign('/')
}
