import test from 'node:test'
import assert from 'node:assert/strict'
import {validateShort,inspectShort,shortAddress,shortTarget,shortClips,mergeShortPosts} from '../src/services/shorts.js'
const file={name:'real.mp4',type:'video/mp4',size:50000000},info={duration:600,width:1080,height:1920}
test('Ishort accepts ten minutes and 50 MB, rejects longer/larger files and unreadable metadata, allows landscape',()=>{
 assert.deepEqual(validateShort(file,info),info)
 assert.equal(validateShort(file,{...info,width:1920,height:1080}).duration,600)
 assert.throws(()=>validateShort(file,{...info,duration:600.1}),/10 minutos/)
 assert.throws(()=>validateShort({...file,size:50000001},info),/50 MB/)
 for(const duration of [0,-1,NaN,Infinity,undefined])assert.throws(()=>validateShort(file,{...info,duration}))
 assert.throws(()=>validateShort({...file,type:'image/png',size:100},info),/vídeo/)
 assert.throws(()=>validateShort(file,{...info,width:0}))
})
test('Ishort metadata inspection reads the actual video element and releases temporary media on success and format failure',async()=>{
 const originalDocument=globalThis.document,create=URL.createObjectURL,revoke=URL.revokeObjectURL
 const nodes=[],released=[]
 URL.createObjectURL=()=>`blob:${nodes.length}`;URL.revokeObjectURL=value=>released.push(value)
 globalThis.document={createElement(){const node={duration:600,videoWidth:1080,videoHeight:1920,removeAttribute(){this.removed=true},load(){this.cleaned=true}};nodes.push(node);return node}}
 try{
  const reading=inspectShort(file);nodes[0].onloadedmetadata();assert.deepEqual(await reading,info);assert.equal(nodes[0].removed,true);assert.equal(nodes[0].cleaned,true)
  const failing=inspectShort(file);nodes[1].onerror();await assert.rejects(failing,/compatível/)
  assert.equal(released.length,2);assert.equal(nodes[1].onloadedmetadata,null)
 }finally{globalThis.document=originalDocument;URL.createObjectURL=create;URL.revokeObjectURL=revoke}
})
test('Ishort sharing retains only its exact ID; clips exclude ordinary long videos and pagination deduplicates posts',()=>{
 const id='00000000-0000-0000-0000-000000000001',address=shortAddress(id,'https://itext-1b9da.web.app/?convite=secret&code=oauth#token')
 assert.equal(address,'https://itext-1b9da.web.app/?ishort='+id);assert.equal(shortTarget(new URL(address).search),id);assert.equal(shortTarget('?ishort=invalid'),null)
 assert.throws(()=>shortAddress('invalid','https://itext-1b9da.web.app'))
 assert.throws(()=>shortAddress(id,'javascript:alert(1)'))
 const posts=[{id,media:[{type:'video',duration:600,short:true},{type:'video',duration:601,short:true},{type:'video',duration:10},{type:'image',short:true,duration:10}]}]
 assert.equal(shortClips(posts).length,1)
 assert.deepEqual(mergeShortPosts([{id:'one',likes:0}],[{id:'one',likes:1},{id:'two'}]),[{id:'one',likes:1},{id:'two'}])
})

test('late playback promises cannot restart hidden videos or pause a newer legitimate playback request',async()=>{
 const {syncShortPlayback}=await import('../src/services/shorts.js')
 const pending=[];let pauses=0,blocked=0
 const node={pause(){pauses++},play(){return new Promise((resolve,reject)=>pending.push({resolve,reject}))}}
 const stop=syncShortPlayback(node,true,()=>blocked++)
 stop();const before=pauses;pending[0].resolve();await new Promise(resolve=>setImmediate(resolve));assert.ok(pauses>before)
 const old=syncShortPlayback(node,true,()=>blocked++);old();syncShortPlayback(node,true,()=>blocked++)
 const latestPause=pauses;pending[1].resolve();pending[2].resolve();await new Promise(resolve=>setImmediate(resolve));assert.equal(pauses,latestPause)
 syncShortPlayback(node,true,()=>blocked++);pending[3].reject(new Error('Autoplay blocked'));await new Promise(resolve=>setImmediate(resolve));assert.equal(blocked,1)
 syncShortPlayback(node,false,()=>blocked++);assert.ok(pauses>latestPause)
})
