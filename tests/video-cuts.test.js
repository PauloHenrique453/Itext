import test from 'node:test'
import assert from 'node:assert/strict'
import {cutPlan,clipArgs,validateSource,originalCanBeUsed} from '../src/services/videoCuts.js'
import {createVideoEditor} from '../src/services/videoEditor.js'
import {createPartJob,runPartJob} from '../src/services/partPublishing.js'
const file=new File(['ORIGINAL SOURCE'],'source.mp4',{type:'video/mp4'}),info={duration:1250,width:1280,height:720}
test('trim and numbered parts cover exactly the selected source without gaps or duplicated boundaries',()=>{
 const parts=cutPlan(1250,0,1250,'parts',600)
 assert.deepEqual(parts.map(({start,end})=>[start,end]),[[0,600],[600,1200],[1200,1250]])
 assert.equal(parts.reduce((sum,part)=>sum+part.duration,0),1250)
 assert.deepEqual(cutPlan(1250,75.5,90.5,'trim').map(({start,end})=>[start,end]),[[75.5,90.5]])
 for(const args of [[1250,-1,10],[1250,10,9],[1250,0,1251],[1250,0,601],[1250,0,10,'parts',601],[1250,0,10,'parts',0],[NaN,0,1]])assert.throws(()=>cutPlan(...args))
 const args=clipArgs({start:75.5,duration:15});assert.equal(args[args.indexOf('-ss')+1],'75.500');assert.equal(args[args.indexOf('-t')+1],'15.000');assert.ok(args.includes('0:a:0?'));assert.ok(args.includes('libx264'));assert.ok(args.includes('aac'))
 assert.equal(originalCanBeUsed(file,{duration:10},{start:1,end:10}),false)
 assert.equal(originalCanBeUsed(file,{duration:10},{start:0,end:10}),true)
 assert.throws(()=>validateSource({type:'video/mp4',size:200000001},info),/200 MB/)
 assert.equal(validateSource({type:'video/mp4',size:200000000},info).duration,1250)
})
test('editor exports separate clip bytes, caches only the source and avoids loading WASM for an unchanged eligible video',async()=>{
 const calls=[],listeners=new Map()
 const client={async load(){calls.push('load')},async writeFile(name,bytes){calls.push(['write',name,new TextDecoder().decode(bytes)])},async deleteFile(name){calls.push(['delete',name])},async exec(args){calls.push(['exec',args]);listeners.get('progress')?.({time:1000000});return 0},async readFile(){return new TextEncoder().encode('EXPORTED CLIP')},on(name,callback){listeners.set(name,callback)},off(name){listeners.delete(name)},terminate(){calls.push('terminate')}}
 const progress=[]
 const editor=createVideoEditor({loader:async()=>({client,options:{}}),inspect:async()=>({duration:2,width:640,height:360})})
 const first=await editor.render(file,info,{start:3,end:5,duration:2},{onProgress:value=>progress.push(value)})
 assert.notEqual(first.file,file);assert.equal(await first.file.text(),'EXPORTED CLIP');assert.equal(first.file.type,'video/mp4');assert.ok(progress.includes(.5));assert.equal(progress.at(-1),1)
 await editor.render(file,info,{start:5,end:7,duration:2});assert.equal(calls.filter(row=>Array.isArray(row)&&row[0]==='write').length,1)
 editor.dispose();assert.ok(calls.includes('terminate'))
 const bypass=createVideoEditor({loader:()=>{throw new Error('Should not load')}});assert.equal((await bypass.render(file,{duration:5,width:640,height:360},{start:0,end:5,duration:5})).file,file)
})
test('part publishing uploads the generated files and resumes exact attempts without reposting completed parts',async()=>{
 const parts=cutPlan(1250,0,1250,'parts',600),job=createPartJob(file,info,'Legenda',parts),rendered=[],uploads=[],published=[]
 let fail=true
 const deps={render:async(_file,_info,part)=>{const clip=new File([`part ${part.start}`],'clip.mp4',{type:'video/mp4'});rendered.push(part.start);return {file:clip,info:{duration:part.duration,width:640,height:360}}},upload:async clip=>{const bytes=await clip.text();uploads.push(bytes);assert.notEqual(bytes,'ORIGINAL SOURCE');return {media:{storagePath:bytes,type:'video',size:clip.size}}},publish:async payload=>{published.push(payload);if(payload.media.partNumber===2&&fail){fail=false;throw new Error('offline')}return {id:payload.id}}}
 await assert.rejects(runPartJob(job,deps),/offline/)
 assert.equal(job.parts[2].status,'published');assert.equal(job.parts[1].status,'error');assert.equal(job.parts[0].status,'pending')
 const ids=await runPartJob(job,deps);assert.equal(ids.length,3)
 assert.deepEqual(rendered,[1200,600,0]);assert.equal(uploads.length,3)
 const retried=published.filter(row=>row.media.partNumber===2);assert.equal(retried.length,2);assert.equal(retried[0].id,retried[1].id)
 assert.equal(published.filter(row=>row.media.partNumber===3).length,1)
 assert.equal(published.at(-1).text,'Legenda\nParte 1 de 3')
})
test('cancel after upload retains the uploaded part for continuation and does not publish while stopped',async()=>{
 const job=createPartJob(file,{duration:2,width:640,height:360},'',cutPlan(2,0,2)),controller=new AbortController();let uploads=0,publishes=0
 const deps={signal:controller.signal,render:async()=>({file,info:{duration:2,width:640,height:360}}),upload:async()=>{uploads++;controller.abort();return {media:{type:'video',size:file.size}}},publish:async payload=>{publishes++;return {id:payload.id}}}
 await assert.rejects(runPartJob(job,deps),{name:'AbortError'});assert.equal(publishes,0);assert.equal(uploads,1)
 await runPartJob(job,{...deps,signal:undefined});assert.equal(uploads,1);assert.equal(publishes,1)
})
