import test from 'node:test'
import assert from 'node:assert/strict'
import {createDeviceSecurity} from '../src/services/deviceSecurity.js'
import {validPinIdentification,emailMethodFromToken,verifiedEmailIdentification} from '../src/services/pinRecovery.js'
function fixture(){
 const rows=new Map()
 const store={get:async id=>structuredClone(rows.get(id)),set:async(id,row)=>rows.set(id,structuredClone(row)),remove:async id=>rows.delete(id)}
 return {rows,security:createDeviceSecurity(store)}
}
test('remembered recovery is encrypted, account-bound, fingerprint-bound and survives browser session reload without plaintext storage',async()=>{
 const {security,rows}=fixture(),code='code-only-used-locally'
 await security.remember('alice',code,'key-one')
 const record=rows.get('alice')
 assert.equal(record.key.extractable,false)
 assert.equal(JSON.stringify(record).includes(code),false)
 assert.equal(new TextDecoder().decode(record.data).includes(code),false)
 await assert.rejects(crypto.subtle.exportKey('raw',record.key))
 security.clear()
 assert.equal(await security.recovery('alice','key-one'),code)
 assert.equal(await security.recovery('alice','other-key'),null)
 assert.equal(await security.recovery('bob','key-one'),null)
 rows.set('bob',{...record,userId:'bob'})
 await assert.rejects(security.recovery('bob','key-one'))
 rows.delete('bob')
 await security.forget('alice');security.clear()
 assert.equal(await security.recovery('alice','key-one'),null)
})
test('device password wraps remembered secrets, rejects wrong PIN, locks after reload, and can be changed without losing recovery',async()=>{
 const {security,rows}=fixture()
 await security.remember('alice','recovery-code','key-one')
 await assert.rejects(security.setPassword('alice','1234'))
 await security.setPassword('alice','a long first password')
 assert.equal('key' in rows.get('alice'),false)
 assert.equal(rows.get('alice').mode,'password')
 security.clear()
 assert.equal((await security.status('alice')).locked,true)
 await assert.rejects(security.recovery('alice','key-one'))
 await assert.rejects(security.unlock('alice','incorrect password'))
 await security.unlock('alice','a long first password')
 assert.equal(await security.recovery('alice','key-one'),'recovery-code')
 await assert.rejects(security.setPassword('alice','a long second password','incorrect password'))
 await security.setPassword('alice','a long second password','a long first password')
 security.clear()
 await assert.rejects(security.unlock('alice','a long first password'))
 await security.unlock('alice','a long second password')
 assert.equal(await security.recovery('alice','key-one'),'recovery-code')
 await security.forget('alice');security.clear()
 assert.equal((await security.status('alice')).passwordEnabled,true)
 await security.unlock('alice','a long second password')
 assert.equal(await security.recovery('alice','key-one'),null)
 await security.removePassword('alice','a long second password')
 assert.equal((await security.status('alice')).passwordEnabled,false)
})
test('email reset replaces only the local lock and removes the old remembered recovery key',async()=>{
 const {security}=fixture()
 await security.remember('alice','original-recovery','key-one')
 await security.setPassword('alice','old device password')
 security.clear()
 await security.resetPassword('alice','87654321')
 security.clear()
 await assert.rejects(security.unlock('alice','old device password'))
 await security.unlock('alice','87654321')
 assert.equal(await security.recovery('alice','key-one'),null)
})
test('email identity requires the requested confirmed account and a fresh verified email method, not an existing Google session or URL flag',()=>{
 const now=Date.now(),pending={userId:'alice',email:'alice@example.com',requestedAt:now-60000},user={id:'alice',email:'Alice@example.com',email_confirmed_at:'2026-10-17'}
 assert.equal(validPinIdentification(pending,user,now),true)
 assert.equal(validPinIdentification(pending,{...user,id:'bob'},now),false)
 assert.equal(validPinIdentification(pending,{...user,email:'bob@example.com'},now),false)
 assert.equal(validPinIdentification(pending,{...user,email_confirmed_at:null},now),false)
 assert.equal(validPinIdentification({...pending,requestedAt:now-16*60000},user,now),false)
 assert.equal(validPinIdentification({...pending,requestedAt:now+1000},user,now),false)
 const token=amr=>'unused.'+Buffer.from(JSON.stringify({amr})).toString('base64url')+'.unused'
 assert.equal(emailMethodFromToken(token([{method:'otp',timestamp:now/1000}]),pending.requestedAt),true)
 assert.equal(emailMethodFromToken(token([{method:'oauth',timestamp:now/1000}]),pending.requestedAt),false)
 assert.equal(emailMethodFromToken(token([{method:'otp',timestamp:(now-600000)/1000}]),pending.requestedAt),false)
 assert.equal(emailMethodFromToken('invalid',pending.requestedAt),false)
})

test('locking cancels an in-flight local unlock instead of repopulating decrypted memory',async()=>{
 const {security}=fixture()
 await security.setPassword('alice','a long device password')
 security.clear()
 const pending=security.unlock('alice','a long device password')
 security.clear()
 await assert.rejects(pending)
 assert.equal((await security.status('alice')).locked,true)
})

test('reset authorization requires a successful callback plus server verification of that exact access token',async()=>{
 const now=Date.now(),pending={userId:'alice',email:'alice@example.com',requestedAt:now-1000},user={id:'alice',email:'alice@example.com',email_confirmed_at:'2026-10-17'}
 const token='unused.'+Buffer.from(JSON.stringify({amr:[{method:'otp',timestamp:now/1000}]})).toString('base64url')+'.unused'
 const response={data:{session:{access_token:token}},error:null}
 const verified={getUser:async received=>{assert.equal(received,token);return {data:{user},error:null}}}
 assert.equal(await verifiedEmailIdentification(verified,response,pending,{now}),true)
 assert.equal(await verifiedEmailIdentification(verified,{...response,error:new Error('expired')},pending,{emailHash:true,now}),false)
 assert.equal(await verifiedEmailIdentification(verified,{data:{session:null}},pending,{emailHash:true,now}),false)
 assert.equal(await verifiedEmailIdentification({getUser:async()=>({data:{user},error:new Error('revoked')})},response,pending,{emailHash:true,now}),false)
 assert.equal(await verifiedEmailIdentification({getUser:async()=>({data:{user:{...user,id:'bob'}},error:null})},response,pending,{emailHash:true,now}),false)
})
