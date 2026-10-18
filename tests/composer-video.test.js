import test from 'node:test'
import assert from 'node:assert/strict'
import {addComposerFiles} from '../src/services/composerAttachments.js'
import {inspectShortSource,validateShort} from '../src/services/shorts.js'
import {createPartJob,preparePartAttachments} from '../src/services/partPublishing.js'
import {cutPlan} from '../src/services/videoCuts.js'

test('home composer opens large videos in the editor before the 50 MB upload guard; explicit cutting also opens small videos',async()=>{
 const large={name:'video.mp4',type:'video/mp4',size:100000000},small={...large,size:10000},photo={name:'photo.jpg',type:'image/jpeg',size:1000},calls=[]
 const deps={edit:(file,multiple)=>calls.push(['edit',file,multiple]),upload:async file=>{calls.push(['upload',file]);return {media:file}},onUploaded:media=>calls.push(['attached',media])}
 await addComposerFiles([large],deps);assert.deepEqual(calls,[['edit',large,false]])
 calls.length=0;await addComposerFiles([photo,large],deps);assert.deepEqual(calls,[['edit',large,true]])
 calls.length=0;await addComposerFiles([small],{...deps,forceVideoEdit:true});assert.deepEqual(calls,[['edit',small,false]])
 calls.length=0;await addComposerFiles([photo,small],deps);assert.deepEqual(calls,[['upload',photo],['attached',photo],['upload',small],['attached',small]])
})
test('selected 100 MB home video reaches metadata and trim selection without passing the upload-only limit',async()=>{
 const documentBefore=globalThis.document,create=URL.createObjectURL,revoke=URL.revokeObjectURL
 let node;const released=[]
 URL.createObjectURL=()=> 'blob:local-source';URL.revokeObjectURL=value=>released.push(value)
 globalThis.document={createElement(){return node={duration:1250,videoWidth:1920,videoHeight:1080,removeAttribute(){},load(){}}}}
 try{
  const file={name:'large.mp4',type:'video/mp4',size:100000000}
  assert.throws(()=>validateShort(file,{duration:1250,width:1920,height:1080}),/50 MB/)
  const reading=inspectShortSource(file);node.onloadedmetadata();const metadata=await reading
  assert.equal(metadata.duration,1250);assert.equal(cutPlan(metadata.duration,120,150).length,1);assert.deepEqual(released,['blob:local-source'])
  await assert.rejects(inspectShortSource({...file,size:200000001}),/200 MB/)
 }finally{globalThis.document=documentBefore;URL.createObjectURL=create;URL.revokeObjectURL=revoke}
})
test('home cut attachments upload only rendered clips, preserve source order and resume without posting or reuploading finished parts',async()=>{
 const original=new File(['ORIGINAL'],'original.mp4',{type:'video/mp4'}),job=createPartJob(original,{duration:620,width:640,height:360},'Keep draft',cutPlan(620,0,620,'parts',600))
 const uploaded=[],rendered=[];let fail=true
 const deps={render:async(_source,_info,part)=>{rendered.push(part.start);return {file:new File([`CUT ${part.start}`],'cut.mp4',{type:'video/mp4'}),info:{duration:part.duration,width:640,height:360}}},upload:async file=>{const data=await file.text();uploaded.push(data);if(data==='CUT 600'&&fail){fail=false;throw new Error('offline')}return {media:{type:'video',storagePath:data,size:file.size}}}}
 await assert.rejects(preparePartAttachments(job,deps),/offline/)
 const media=await preparePartAttachments(job,deps)
 assert.deepEqual(rendered,[0,600]);assert.deepEqual(uploaded,['CUT 0','CUT 600','CUT 600'])
 assert.deepEqual(media.map(row=>row.partNumber),[1,2]);assert.ok(media.every(row=>row.short===false));assert.ok(job.parts.every(row=>row.postId===null));assert.ok(!uploaded.includes('ORIGINAL'))
})
test('stopping a home attachment after upload keeps that result for continuation and never creates a post',async()=>{
 const original=new File(['source'],'source.mp4',{type:'video/mp4'}),job=createPartJob(original,{duration:5,width:640,height:360},'',cutPlan(5,0,5)),controller=new AbortController();let uploads=0
 const deps={signal:controller.signal,render:async()=>({file:original,info:{duration:5,width:640,height:360}}),upload:async file=>{uploads++;controller.abort();return {media:{type:'video',size:file.size,storagePath:'ready'}}}}
 await assert.rejects(preparePartAttachments(job,deps),{name:'AbortError'})
 const media=await preparePartAttachments(job,{...deps,signal:undefined});assert.equal(uploads,1);assert.equal(media.length,1);assert.equal(job.parts[0].postId,null)
})
