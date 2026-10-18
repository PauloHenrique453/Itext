import test from 'node:test'
import assert from 'node:assert/strict'
import {standardMessage,chatMode,messageSession} from '../src/services/chatMode.js'

test('standard messages need no key and protected mode never silently downgrades after the user opted in',()=>{
 const normal=standardMessage('alice','bob',' Olá! ','message-id')
 assert.equal(normal.body,'Olá!');assert.equal(normal.encryption_version,0);assert.equal(normal.owner_id,null)
 assert.throws(()=>standardMessage('alice','alice','oi','id'))
 assert.throws(()=>standardMessage('alice','bob',' '.repeat(10),'id'))
 assert.throws(()=>standardMessage('alice','bob','a'.repeat(4001),'id'))
 assert.equal(chatMode({loaded:false}), 'loading')
 assert.equal(chatMode({loaded:true,enabled:false}), 'standard')
 assert.equal(chatMode({loaded:true,enabled:true,keyReady:false}), 'needs-setup')
 assert.equal(chatMode({loaded:true,enabled:true,keyReady:true,partnerReady:false,creatorReady:true}), 'needs-setup')
 assert.equal(chatMode({loaded:true,enabled:true,keyReady:true,partnerReady:true,creatorReady:true}), 'protected')
 assert.equal(chatMode({loaded:true,enabled:true,standardAccepted:true}), 'standard')
})
test('mixed history displays standard text but never exposes ciphertext as readable text or treats it as a new standard message',async()=>{
 const rows=[{id:'old',body:'-----BEGIN PGP MESSAGE-----secret',encryption_version:1},{id:'new',body:'Conversa normal',encryption_version:0}]
 const result=await messageSession('alice',false,null).decrypt(rows)
 assert.equal(result[0].locked,true);assert.ok(!result[0].plaintext.includes('secret'))
 assert.equal(result[1].plaintext,'Conversa normal');assert.equal(result[1].legacy,false)
 const session={decrypt:async encrypted=>{assert.equal(encrypted.length,1);return [{...encrypted[0],plaintext:'Mensagem recuperada'}]}}
 const restored=await messageSession('alice',false,session).decrypt(rows)
 assert.equal(restored[0].plaintext,'Mensagem recuperada');assert.equal(restored[1].plaintext,'Conversa normal')
 await assert.rejects(messageSession('alice',false,{decrypt:async()=>{throw new Error('invalid signature')}}).decrypt(rows))
})

test('ordinary replies retain the selected target; a deleted message always displays a tombstone instead of stale body',async()=>{
 const row=standardMessage('alice','bob','resposta','id',{reply_to:'target',story_id:'story'})
 assert.equal(row.reply_to,'target');assert.equal(row.story_id,'story')
 const [deleted]=await messageSession('alice',false,null).decrypt([{...row,body:'conteúdo anterior',deleted_at:new Date().toISOString()}])
 assert.equal(deleted.plaintext,'Mensagem apagada');assert.ok(!deleted.plaintext.includes('anterior'))
})
