export function mergeMessages(current, incoming) {
  const rows = new Map(current.map((row) => [row.id, row]))
  for (const row of incoming) rows.set(row.id, row)
  return [...rows.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
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
      const { data, error } = await client.from('itext_public_profiles').select('id,name,avatar_url').neq('id', id).order('name').limit(100)
      if (error) throw error
      return data
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
      if (payload.sender_id !== id || payload.recipient_id === id || payload.encryption_version !== 1 || !payload.body.startsWith('-----BEGIN PGP MESSAGE-----')) throw new Error('Mensagem criptografada inválida.')
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
    listen(userId, onMessage, onStatus, creator = false) {
      let channel = client.channel(`inbox-${userId}-${crypto.randomUUID()}`)
      if (creator) channel = channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, ({ new: row }) => onMessage(row))
      else channel = channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${userId}` }, ({ new: row }) => onMessage(row))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `sender_id=eq.${userId}` }, ({ new: row }) => onMessage(row))
      channel.subscribe(onStatus)
      return () => { void client.removeChannel(channel) }
    },
  }
}
