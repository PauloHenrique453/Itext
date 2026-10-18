let unlocked = null
let epoch = 0
export function chatSessionEpoch() { return epoch }
export function rememberChatSession(session, expectedEpoch=epoch) { if(expectedEpoch!==epoch)return false;unlocked=session;return true }
export function unlockedChatSession(userId) { return unlocked?.id === userId ? unlocked : null }
export function lockChatSession() { unlocked = null;epoch+=1 }
