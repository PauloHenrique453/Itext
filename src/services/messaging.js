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
      const { data, error } = await client.from('chat_profiles').select('id,name,avatar_url').neq('id', id).order('name').limit(100)
      if (error) throw error
      return data
    },
    async history(partnerId, before = null) {
      const id = await identity()
      const cursor = before ? `,or(created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id}))` : ''
      const query = client.from('direct_messages').select('id,sender_id,recipient_id,body,created_at')
        .or(`and(sender_id.eq.${id},recipient_id.eq.${partnerId}${cursor}),and(sender_id.eq.${partnerId},recipient_id.eq.${id}${cursor})`)
      const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100)
      if (error) throw error
      return data.reverse()
    },
    async send(partnerId, body, messageId) {
      const id = await identity()
      const text = body.trim()
      if (!text || text.length > 4000 || partnerId === id) throw new Error('Mensagem inválida.')
      // A retry reuses the UUID, allowing the caller to reconcile an uncertain send.
      const { data, error } = await client.from('direct_messages').insert({ id: messageId, sender_id: id, recipient_id: partnerId, body: text }).select().single()
      if (error) {
        if (error.code === '23505') {
          const existing = await client.from('direct_messages').select().eq('id', messageId).single()
          if (!existing.error && existing.data.sender_id === id && existing.data.recipient_id === partnerId && existing.data.body === text) return existing.data
        }
        throw error
      }
      return data
    },
    listen(userId, onMessage, onStatus) {
      const channel = client.channel(`inbox-${userId}-${crypto.randomUUID()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${userId}` }, ({ new: row }) => onMessage(row))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `sender_id=eq.${userId}` }, ({ new: row }) => onMessage(row))
        .subscribe(onStatus)
      return () => { void client.removeChannel(channel) }
    },
  }
}
