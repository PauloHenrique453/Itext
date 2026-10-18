export const LOGIN_PROVIDERS = Object.freeze([
  { id: 'google', label: 'Google' },
  { id: 'github', label: 'GitHub' },
  { id: 'azure', label: 'Microsoft' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'apple', label: 'Apple' },
  { id: 'discord', label: 'Discord' },
  { id: 'linkedin_oidc', label: 'LinkedIn' },
])

export function enabledLoginProviders(settings) {
  return LOGIN_PROVIDERS.filter((provider) => settings?.external?.[provider.id] === true)
}

export function loginOptions(provider, origin, inviteSearch = '') {
  if (!LOGIN_PROVIDERS.some((entry) => entry.id === provider)) throw new Error('Essa forma de entrar não está disponível.')
  const callback = new URL('/', origin)
  const invite = new URLSearchParams(inviteSearch)
  for (const field of ['grupo', 'convite', 'story', 'ishort']) {
    const value = invite.get(field)
    if (value) callback.searchParams.set(field, value)
  }
  const options = { redirectTo: callback.href }
  if (provider === 'google') {
    options.scopes = 'openid email profile'
    options.queryParams = { prompt: 'select_account' }
  }
  if (provider === 'azure') options.scopes = 'email'
  return options
}

// Supabase can return OAuth failures in either the query or fragment.
// Remove only authentication parameters; preserve group invitations and other navigation.
export function readLoginCallback(address) {
  const url = new URL(address)
  const hash = new URLSearchParams(url.hash.slice(1))
  const code = url.searchParams.get('code') || hash.get('code')
  const error = url.searchParams.get('error_description') || hash.get('error_description') || url.searchParams.get('error') || hash.get('error')
  for (const field of ['code', 'error', 'error_code', 'error_description']) url.searchParams.delete(field)
  const hasAuthHash = ['code', 'error', 'error_code', 'error_description'].some((field) => hash.has(field))
  if (hasAuthHash) {
    for (const field of ['code', 'error', 'error_code', 'error_description']) hash.delete(field)
    url.hash = hash.toString()
  }
  return { code, error, cleaned: `${url.pathname}${url.search}${url.hash}` }
}

export function loginErrorMessage(error) {
  const friendly = [
    'O acesso não foi autorizado. Tente novamente com uma conta permitida.',
    'O serviço de login precisa ser revisado pelo responsável pelo Itext. Tente novamente mais tarde.',
    'Essa tentativa de login expirou. Inicie novamente neste navegador.',
    'Não foi possível conectar ao serviço de login. Confira sua conexão e tente novamente.',
  ]
  if (friendly.includes(error?.message)) return error.message
  const message = String(error?.message || error || '').toLowerCase()
  if (message.includes('access_denied') || message.includes('access denied')) return 'O acesso não foi autorizado. Tente novamente com uma conta permitida.'
  if (message.includes('invalid_client') || message.includes('client secret')) return 'O serviço de login precisa ser revisado pelo responsável pelo Itext. Tente novamente mais tarde.'
  if (message.includes('verifier') || message.includes('expired') || message.includes('flow_state')) return 'Essa tentativa de login expirou. Inicie novamente neste navegador.'
  if (message.includes('fetch') || message.includes('network') || message.includes('timeout')) return 'Não foi possível conectar ao serviço de login. Confira sua conexão e tente novamente.'
  return 'Não foi possível concluir o login. Tente novamente.'
}
