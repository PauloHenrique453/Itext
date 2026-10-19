import test from 'node:test'
import assert from 'node:assert/strict'
import {storyPresentation,storySelection,storyAttempt,publishStoryAttempt} from '../src/services/storyEditor.js'
import {discoveryFiles,siteOrigin} from '../scripts/site-discovery.mjs'

test('story presentation accepts only fixed choices and old stories retain safe defaults',()=>{
 assert.deepEqual(storyPresentation({size:'large',align:'left',position:'top',color:'yellow',filter:'mono',fit:'cover',muted:true}),{size:'large',align:'left',position:'top',color:'yellow',fit:'cover',filter:'mono',muted:true})
 const invalid=storyPresentation({color:'url(https://example.test)',filter:'blur(999px)',muted:'true',align:'justify',html:'<script>'})
 assert.equal(invalid.color,'auto');assert.equal(invalid.filter,'none');assert.equal(invalid.muted,false);assert.equal(invalid.align,'center');assert.equal(invalid.html,undefined)
 assert.equal(storyPresentation(null).size,'normal')
})
test('story video selection uses actual source duration, starts with one minute and supports a chosen segment of large originals',()=>{
 const info={duration:1200,width:1920,height:1080}
 assert.equal(storySelection(info).end,60)
 assert.deepEqual(storySelection(info,800.5,850.7),{key:'800.500-850.700',start:800.5,end:850.7,duration:850.7-800.5})
 assert.equal(storySelection({duration:12}).end,12)
 for(const [start,end] of [[-1,20],[10,1201],[0,601],[50,50]])assert.throws(()=>storySelection(info,start,end))
})
test('a story uploads only generated clip bytes and resumes the same upload/publication without rendering or posting twice',async()=>{
 const original=new File(['original'],'large.mp4',{type:'video/mp4'}),clip=new File(['chosen segment'],'clip.mp4',{type:'video/mp4'})
 const attempt=storyAttempt({id:'stable-story',file:original,info:{duration:1200},start:800,end:850,options:{text:'Keep text',caption:'Caption',presentation:{align:'right'}}})
 let renders=0,uploads=0,publishes=0,fail=true
 const deps={render:async(file,info,part)=>{renders++;assert.equal(file,original);assert.equal(part.start,800);assert.equal(part.end,850);return {file:clip,info:{duration:50}}},upload:async file=>{uploads++;assert.equal(await file.text(),'chosen segment');return {media:{type:'video',storagePath:'owned/clip.mp4'}}},publish:async payload=>{publishes++;assert.equal(payload.id,'stable-story');assert.equal(payload.text,'Keep text');assert.equal(payload.presentation.align,'right');if(fail){fail=false;throw new Error('Network interrupted')}return {id:payload.id}}}
 await assert.rejects(publishStoryAttempt(attempt,deps),/Network interrupted/)
 assert.equal(attempt.publishing,true)
 assert.deepEqual(await publishStoryAttempt(attempt,deps),{id:'stable-story'})
 await publishStoryAttempt(attempt,deps)
 assert.deepEqual([renders,uploads,publishes],[1,1,2])
})
test('stopping story preparation keeps the draft; text stories need no media upload',async()=>{
 const controller=new AbortController(),file=new File(['original'],'original.mp4',{type:'video/mp4'}),attempt=storyAttempt({id:'one',file,info:{duration:80},start:20,end:40})
 let uploaded=false
 await assert.rejects(publishStoryAttempt(attempt,{signal:controller.signal,render:async()=>{controller.abort();return {file}},upload:async()=>{uploaded=true},publish(){}}),{name:'AbortError'})
 assert.equal(uploaded,false);assert.equal(attempt.published,null)
 const text=storyAttempt({id:'text',options:{text:'Only text'}})
 assert.deepEqual(await publishStoryAttempt(text,{render(){throw Error('not used')},upload(){throw Error('not used')},publish:async payload=>({id:payload.id,text:payload.text,media:payload.media})}),{id:'text',text:'Only text',media:null})
})
test('search metadata and sitemap identify only the real public homepage, keep the title Itext and reject verification injection',()=>{
 const files=discoveryFiles()
 assert.ok(files.head.includes('rel="canonical" href="https://itext-1b9da.web.app/"'))
 assert.ok(files.head.includes('property="og:title" content="Itext"'))
 const structured=JSON.parse(files.head.match(/application\/ld\+json">(.*?)<\/script>/s)[1])
 assert.equal(structured.name,'Itext');assert.equal(structured['@type'],'WebSite');assert.equal(structured.url,'https://itext-1b9da.web.app/')
 assert.equal((files.sitemap.match(/<loc>/g)||[]).length,1);assert.equal(new URL(files.sitemap.match(/<loc>(.*?)<\/loc>/)[1]).search,'');assert.ok(!files.sitemap.includes('profile'))
 assert.ok(files.robots.includes('Disallow: /*?'));assert.ok(files.robots.includes('Sitemap: https://itext-1b9da.web.app/sitemap.xml'))
 assert.ok(discoveryFiles({VITE_GOOGLE_SITE_VERIFICATION:'real_public_verification_code'}).head.includes('name="google-site-verification"'))
 assert.throws(()=>discoveryFiles({VITE_BING_SITE_VERIFICATION:'"><script>alert(1)</script>'}))
 for(const url of ['http://example.test','https://user:password@example.test','https://example.test/private','https://example.test/?code=secret'])assert.throws(()=>siteOrigin(url))
 assert.equal(siteOrigin('https://example.test'),'https://example.test')
})
