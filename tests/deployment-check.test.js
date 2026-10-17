import test from 'node:test'
import assert from 'node:assert/strict'
import { checkDeployment } from '../scripts/check-deployment.mjs'
const config={VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_configuration'}
const privateTables=['direct_messages','chat_profiles','itext_dating','itext_swipes','itext_group_invites','itext_chat_keys','itext_chat_privacy','itext_chat_public_keys']
function service(change = () => null) {
  return async (address, options) => {
    assert.equal(options.headers.apikey, config.VITE_SUPABASE_PUBLISHABLE_KEY)
    assert.equal(new URL(address).origin, config.VITE_SUPABASE_URL)
    assert.equal(options.redirect,'error')
    const changed=change(address)
    if (changed) return changed
    if(address.endsWith('/rest/v1/rpc/itext_crypto_ready'))return Response.json(true)
    if(address.endsWith('/auth/v1/settings'))return Response.json({external:{google:true}})
    const name=new URL(address).pathname.split('/').pop()
    if(privateTables.includes(name))return Response.json({error:'denied'},{status:401})
    return Response.json([])
  }
}
test('deployment accepts available schema and rejects missing schema and disabled Google',async()=>{
 assert.equal((await checkDeployment(config,service())).length,4)
 await assert.rejects(checkDeployment(config,service((url)=>url.includes('/itext_posts?')?Response.json({error:'not found'},{status:404}):null)),/social.sql/)
 await assert.rejects(checkDeployment(config,service((url)=>url.endsWith('/auth/v1/settings')?Response.json({external:{google:false}}):null)),/Ative o provedor Google/)
})
test('each private table must deny anonymous requests even if an exposed table is empty',async()=>{
 for(const table of privateTables){
  await assert.rejects(checkDeployment(config,service((url)=>url.includes(`/${table}?`)?Response.json([]):null)),new RegExp(table))
 }
})
test('network failures and invalid public credentials stop deployment rather than pretending checks passed',async()=>{
 await assert.rejects(checkDeployment(config,async()=>{throw new Error('network denied')}),/nenhuma validação foi confirmada/)
 await assert.rejects(checkDeployment(config,async()=>Response.json({error:'invalid key'},{status:401})),/recusou a chave/)
 await assert.rejects(checkDeployment({...config,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_not_a_public_key'},service()),/Publishable key/)
})

test('initial publication permits a locked chat for Google account creation, but refuses missing encryption schema',async()=>{
 const pending=await checkDeployment(config,service((url)=>url.endsWith('/itext_crypto_ready')?Response.json(false):null))
 assert.match(pending[3],/chat bloqueado/)
 await assert.rejects(checkDeployment(config,service((url)=>url.endsWith('/itext_crypto_ready')?Response.json({}, {status:404}):null)),/creator-privacy.sql/)
 await assert.rejects(checkDeployment(config,service((url)=>url.endsWith('/itext_crypto_ready')?Response.json([]):null)),/configuração da criptografia/)
})
