let unlocked = null
export function rememberChatSession(session) { unlocked = session }
export function unlockedChatSession(userId) { return unlocked?.id === userId ? unlocked : null }
export function lockChatSession() { unlocked = null }
