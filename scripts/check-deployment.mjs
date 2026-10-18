import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { loadEnv } from 'vite'

export async function checkDeployment(config, fetcher = fetch) {
  const url = new URL(config.VITE_SUPABASE_URL || '')
  const key = config.VITE_SUPABASE_PUBLISHABLE_KEY
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use a URL HTTPS pública do Supabase, sem credenciais no endereço.')
  if (!key?.startsWith('sb_publishable_') || key.includes('PREENCHER')) throw new Error('Configure a Publishable key do Supabase antes de publicar.')
  const checks = []
  async function request(path) {
    try {
      return await fetcher(`${url.origin}${path}`, { headers: { apikey: key }, signal: AbortSignal.timeout(10000), redirect: 'error' })
    } catch {
      throw new Error('Não foi possível verificar o Supabase pela rede. A publicação foi interrompida; nenhuma validação foi confirmada.')
    }
  }
  const settings = await request('/auth/v1/settings')
  if (!settings.ok) throw new Error('O Supabase recusou a chave pública. Confira o projeto e a Publishable key.')
  const auth = await settings.json()
  if (auth.external?.google !== true) throw new Error('Ative o provedor Google no Supabase antes de publicar.')
  checks.push('Provedor Google habilitado')
  for (const table of ['itext_public_profiles', 'itext_posts', 'itext_page_counts', 'itext_group_counts', 'itext_post_counts', 'itext_profile_counts']) {
    const response = await request(`/rest/v1/${table}?select=*&limit=0`)
    if (!response.ok) throw new Error(`A estrutura ${table} não está acessível. Confira a aplicação de supabase/social.sql e das migrações posteriores.`)
  }
  checks.push('Estrutura pública do aplicativo disponível')
  for (const table of ['direct_messages', 'chat_profiles', 'itext_dating', 'itext_swipes', 'itext_group_invites', 'itext_chat_keys', 'itext_chat_privacy', 'itext_chat_public_keys', 'itext_conversation_reads', 'itext_chat_inbox', 'itext_chat_preferences', 'itext_blocks', 'itext_stories', 'itext_story_likes', 'itext_story_counts', 'itext_message_reactions', 'itext_message_hides', 'itext_conversation_settings']) {
    const response = await request(`/rest/v1/${table}?select=*&limit=0`)
    if (![401, 403].includes(response.status)) {
      throw new Error(`Acesso anônimo a ${table} não foi bloqueado como esperado. Revise as permissões antes de publicar.`)
    }
  }
  checks.push('Tabelas privadas recusam acesso anônimo')
  const crypto = await request('/rest/v1/rpc/itext_crypto_ready')
  if (!crypto.ok) throw new Error('Aplique supabase/creator-privacy.sql antes de publicar. A estrutura de criptografia não foi confirmada.')
  const ready = await crypto.json()
  if (typeof ready !== 'boolean') throw new Error('Não foi possível confirmar a configuração da criptografia.')
  checks.push(ready ? 'Chave pública do criador cadastrada (validar o desbloqueio com contas reais)' : 'Mensagens padrão disponíveis; proteção adicional aguarda a conta e a chave do criador')
  return checks
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const config = { ...loadEnv('independent', process.cwd(), 'VITE_'), ...process.env }
    for (const line of await checkDeployment(config)) console.log(`OK: ${line}`)
    console.log('A checagem não substitui o teste de mensagens com três contas reais nem o teste completo do login Google.')
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
