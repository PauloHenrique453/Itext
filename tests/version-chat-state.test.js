import test from 'node:test'
import assert from 'node:assert/strict'
import { hasNewVersion,fetchAppVersion } from '../src/services/appVersion.js'
import { messageWasRead } from '../src/services/messaging.js'
import { rememberChatSession,unlockedChatSession,lockChatSession,chatSessionEpoch } from '../src/services/chatSession.js'
test('update notice only accepts a real different deployment and never treats offline or HTML fallbacks as updates',async()=>{
 assert.equal(hasNewVersion('version-current',{id:'version-current'}),false)
 assert.equal(hasNewVersion('version-current',{id:'version-updated'}),true)
 assert.equal(hasNewVersion('development',{id:'version-updated'}),false)
 for(const value of [null,{}, {id:42},{id:'<html>'}])assert.equal(hasNewVersion('version-current',value),false)
 const result=await fetchAppVersion(async(url,options)=>{assert.ok(url.startsWith('/version.json?'));assert.equal(options.cache,'no-store');return Response.json({id:'version-updated'})})
 assert.equal(result.id,'version-updated')
 await assert.rejects(fetchAppVersion(async()=>new Response('<html>old deployment</html>')))
 await assert.rejects(fetchAppVersion(async()=>new Response('',{status:404})))
})
test('read status uses the exact persisted timestamp and ID boundary, never optimistic UI state',()=>{
 const row={id:'b',created_at:'2026-10-17T12:00:00Z'}
 assert.equal(messageWasRead(row,null),false)
 assert.equal(messageWasRead(row,{last_read_at:row.created_at,last_read_id:'a'}),false)
 assert.equal(messageWasRead(row,{last_read_at:row.created_at,last_read_id:'b'}),true)
 assert.equal(messageWasRead(row,{last_read_at:'2026-10-17T12:00:01Z',last_read_id:'a'}),true)
})
test('unlocked chat sessions stay scoped to one user and disappear on lock',()=>{
 const session={id:'creator',isOwner:true}
 rememberChatSession(session)
 assert.equal(unlockedChatSession('creator'),session)
 assert.equal(unlockedChatSession('other-account'),null)
 const oldEpoch=chatSessionEpoch()
 lockChatSession()
 assert.equal(rememberChatSession(session,oldEpoch),false)
 assert.equal(unlockedChatSession('creator'),null)
})
