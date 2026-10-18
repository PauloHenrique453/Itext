const avatarCache = new Map()
async function chatAvatar(client, value) {
  if (!value?.startsWith('itext-media:')) return value
  const path = value.slice(12)
  const cached = avatarCache.get(path)
  if (cached && cached.expires > Date.now()) return cached.url
  const { data, error } = await client.storage.from('itext-media').createSignedUrl(path,3600)
  if (error) return null
  avatarCache.set(path,{url:data.signedUrl,expires:Date.now()+3300000})
  return data.signedUrl
}

export function mergeMessages(current, incoming) {
  const rows = new Map(current.map((row) => [row.id, row]))
  for (const row of incoming) rows.set(row.id, row)
  return [...rows.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}

export function messageWasRead(message, receipt) {
  return !!receipt && (message.created_at < receipt.last_read_at || (message.created_at === receipt.last_read_at && message.id <= receipt.last_read_id))
}

export function messagesClient(client) {
  async function identity() {
    const { data, error } = await client.auth.getUser()
    if (error || !data.user) throw new Error('Entre com Google para usar as mensagens.')
    return data.user.id
  }
  return {
    identity,
    async people() {
      const id = await identity()
      const directory = await client.from('itext_public_profiles').select('id,name,avatar_url').neq('id', id).order('name').limit(100)
      let data = directory.data
      const error = directory.error
      if (error) throw error
      const recent = await client.from('itext_chat_inbox').select('partner_id').order('last_message_at',{ascending:false}).limit(100)
      if (recent.error) throw recent.error
      const missing = recent.data.map((row) => row.partner_id).filter((partner) => !data.some((person) => person.id === partner))
      if (missing.length) {
        const extra = await client.from('itext_public_profiles').select('id,name,avatar_url').in('id',missing)
        if (extra.error) throw extra.error
        data = [...data,...extra.data]
      }
      if (!data.length) return []
      const keys = await client.from('itext_chat_public_keys').select('user_id').in('user_id',data.map((person) => person.id))
      if (keys.error) throw keys.error
      const preferences=await client.from('itext_chat_preferences').select('user_id,enabled').in('user_id',data.map(person=>person.id))
      if(preferences.error)throw preferences.error
      return Promise.all(data.map(async (person) => ({ ...person, avatar_url: await chatAvatar(client, person.avatar_url), ready: keys.data.some((key) => key.user_id === person.id)&&preferences.data.some(pref=>pref.user_id===person.id&&pref.enabled) })))
    },
    async person(id) {
      const profile = await client.from('itext_public_profiles').select('id,name,avatar_url').eq('id',id).single()
      const key = await client.from('itext_chat_public_keys').select('user_id').eq('user_id',id).maybeSingle()
      if (profile.error || key.error) throw profile.error || key.error
      const preference=await client.from('itext_chat_preferences').select('enabled').eq('user_id',id).single()
      if(preference.error)throw preference.error
      return { ...profile.data, avatar_url: await chatAvatar(client, profile.data.avatar_url), ready: !!key.data&&preference.data.enabled }
    },
    async inbox() {
      const { data, error } = await client.from('itext_chat_inbox').select('*')
      if (error) throw error
      return data
    },
    async receipts() {
      const { data, error } = await client.from('itext_conversation_reads').select('*')
      if (error) throw error
      return data
    },
    async markRead(messageId) {
      const { error } = await client.rpc('itext_mark_message_read', { message_id: messageId })
      if (error) throw error
    },
    async history(partnerId, before = null) {
      const id = await identity()
      const cursor = before ? `,or(created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id}))` : ''
      const query = client.from('direct_messages').select('id,sender_id,recipient_id,body,created_at,encryption_version,owner_id')
        .or(`and(sender_id.eq.${id},recipient_id.eq.${partnerId}${cursor}),and(sender_id.eq.${partnerId},recipient_id.eq.${id}${cursor})`)
      const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100)
      if (error) throw error
      return data.reverse()
    },
    async creatorHistory(before = null) {
      await identity()
      const allowed = await client.rpc('itext_is_creator')
      if (allowed.error || allowed.data !== true) throw new Error('Acesso reservado ao criador.')
      let query = client.from('direct_messages').select('id,sender_id,recipient_id,body,created_at,encryption_version,owner_id')
      if (before) query = query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`)
      const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100)
      if (error) throw error
      return data.reverse()
    },
    async send(payload) {
      const id = await identity()
      const validFormat=payload.encryption_version===0?payload.owner_id===null&&typeof payload.body==='string'&&payload.body.trim().length>0&&payload.body.length<=4000:payload.encryption_version===1&&typeof payload.body==='string'&&payload.body.startsWith('-----BEGIN PGP MESSAGE-----')
      if (payload.sender_id !== id || payload.recipient_id === id || !validFormat) throw new Error('Mensagem inválida.')
      const { data, error } = await client.from('direct_messages').insert(payload).select().single()
      if (error) {
        if (error.code === '23505') {
          const existing = await client.from('direct_messages').select().eq('id', payload.id).single()
          if (!existing.error && ['sender_id', 'recipient_id', 'body', 'encryption_version', 'owner_id'].every((field) => existing.data[field] === payload[field])) return existing.data
        }
        throw error
      }
      return data
    },
    listen(userId, onMessage, onStatus, creator = false, onReceipt = () => {}) {
      let channel = client.channel(`inbox-${userId}-${crypto.randomUUID()}`)
      if (creator) channel = channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, ({ new: row }) => onMessage(row))
      else channel = channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${userId}` }, ({ new: row }) => onMessage(row))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `sender_id=eq.${userId}` }, ({ new: row }) => onMessage(row))
      for (const field of ['user_id', 'partner_id']) for (const event of ['INSERT', 'UPDATE']) {
        channel = channel.on('postgres_changes', { event, schema: 'public', table: 'itext_conversation_reads', filter: `${field}=eq.${userId}` }, ({ new: row }) => onReceipt(row))
      }
      channel.subscribe(onStatus)
      return () => { void client.removeChannel(channel) }
    },
  }
}
