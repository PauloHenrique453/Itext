import { createVault, decryptMessage, encryptMessage, PRIVACY_NOTICE, unlockVault } from './chatCrypto.js'

export function privacyClient(client) {
  async function uid() {
    const { data, error } = await client.auth.getUser()
    if (error || !data.user) throw new Error('Entre com Google para conversar.')
    return data.user.id
  }
  async function directory(ids) {
    if (!ids.length) return {}
    const { data, error } = await client.from('itext_chat_public_keys').select('user_id,public_key,fingerprint').in('user_id', [...new Set(ids)])
    if (error) throw error
    return Object.fromEntries(data.map((key) => [key.user_id, key]))
  }
  return {
    async state() {
      const id = await uid()
      const config = await client.from('itext_chat_privacy').select('owner_id,notice_version').single()
      if (config.error) throw new Error('As mensagens criptografadas aguardam a configuração do criador. O envio está bloqueado.')
      if (config.data.notice_version !== PRIVACY_NOTICE) throw new Error('A política de mensagens precisa ser atualizada.')
      const vault = await client.from('itext_chat_keys').select('*').eq('user_id', id).maybeSingle()
      if (vault.error) throw vault.error
      const keys = await directory([config.data.owner_id])
      return { id, ownerId: config.data.owner_id, isOwner: id === config.data.owner_id, ownerReady: !!keys[config.data.owner_id], vault: vault.data }
    },
    async activate(state, code) {
      if (!state.isOwner && !state.ownerReady) throw new Error('O criador precisa ativar sua chave primeiro.')
      const id = await uid()
      const record = await createVault(id, code)
      const { error } = await client.from('itext_chat_keys').insert(record)
      if (error) throw error
      return this.unlock({ ...state, vault: record }, code)
    },
    async unlock(state, code) {
      const privateKey = await unlockVault(state.vault, code)
      // The decrypted key remains only in this in-memory session, never localStorage.
      return {
        id: state.id, ownerId: state.ownerId, isOwner: state.isOwner,
        async encrypt(partner, text, messageId) {
          const records = await directory([state.id, partner, state.ownerId])
          return encryptMessage({ id: messageId, sender_id: state.id, recipient_id: partner, owner_id: state.ownerId, body: text }, records, privateKey)
        },
        async decrypt(rows) {
          if (!rows.length) return []
          const records = await directory(rows.filter((row) => row.encryption_version === 1).map((row) => row.sender_id))
          return Promise.all(rows.map(async (row) => {
            try { return await decryptMessage(row, privateKey, records[row.sender_id]) }
            catch { return { ...row, plaintext: 'Não foi possível abrir ou verificar esta mensagem.', invalid: true } }
          }))
        },
      }
    },
  }
}
