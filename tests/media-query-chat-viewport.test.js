import test from 'node:test'
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {PGlite} from '@electric-sql/pglite'
import {mediaPostsQuery} from '../src/services/mediaPostsQuery.js'
import {chatViewportBounds,resizeChatInput,watchChatViewport} from '../src/services/chatViewport.js'

test('the actual SDK sends valid JSONB for Ishort and photos; PostgreSQL returns only matching public media',async()=>{
 const db=new PGlite(),requests=[]
 await db.exec(`create table itext_posts(id text, group_id text, media jsonb);
 insert into itext_posts values
 ('short',null,'[{"type":"video","short":true,"duration":9}]'),
 ('ordinary',null,'[{"type":"video","short":false,"duration":390}]'),
 ('group','private-group','[{"type":"video","short":true}]'),
 ('photo',null,'[{"type":"image"}]');`)
 const client=createClient('https://example.test','test-public-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async input=>{
  const url=new URL(input);requests.push(url)
  try{const data=await db.query('select id from itext_posts where group_id is null and media @> $1::jsonb order by id',[url.searchParams.get('media').slice(3)]);return Response.json(data.rows)}
  catch(issue){return Response.json({message:issue.message,code:issue.code},{status:400})}
 }}})
 try{
  const broken=await client.from('itext_posts').select('id').contains('media',[{type:'video',short:true}])
  assert.equal(broken.error.code,'22P02');assert.match(broken.error.message,/invalid input syntax for type json/)
  const shorts=await mediaPostsQuery(client,'id',{type:'video',short:true})
  assert.equal(shorts.error,null);assert.deepEqual(shorts.data,[{id:'short'}])
  const request=requests.at(-1)
  assert.equal(request.searchParams.get('group_id'),'is.null');assert.equal(request.searchParams.get('limit'),'20');assert.equal(request.searchParams.get('order'),'created_at.desc,id.desc')
  assert.deepEqual(JSON.parse(request.searchParams.get('media').slice(3)),[{type:'video',short:true}])
  const photos=await mediaPostsQuery(client,'id',{type:'image'})
  assert.equal(photos.error,null);assert.deepEqual(photos.data,[{id:'photo'}])
  await mediaPostsQuery(client,'id',{type:'video',short:true}).in('author_id',['following']).or('created_at.lt.2026-10-19T00:00:00Z')
  assert.equal(requests.at(-1).searchParams.get('author_id'),'in.(following)');assert.ok(requests.at(-1).searchParams.get('or').includes('created_at.lt.'))
 }finally{await db.close()}
})

test('chat sizing uses keyboard viewport bounds, safe panning, navigation space and bounded multiline input',()=>{
 assert.deepEqual(chatViewportBounds({height:320,offset:24,full:true}),{top:24,height:320,inputMax:64,extrasMax:57})
 assert.equal(chatViewportBounds({height:800,top:160,navTop:738}).height,566)
 assert.equal(chatViewportBounds({height:300,offset:40,top:80}).height,248)
 assert.equal(chatViewportBounds({height:100,top:200}).height,0)
 const node={style:{},scrollHeight:500};resizeChatInput(node,64);assert.equal(node.style.height,'64px')
 node.scrollHeight=20;resizeChatInput(node,64);assert.equal(node.style.height,'44px')
})
function events(){const listeners=new Map();return {listeners,addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn)},removeEventListener(type,fn){listeners.get(type)?.delete(fn)},emit(type){for(const fn of listeners.get(type)||[])fn()},count(){return [...listeners.values()].reduce((sum,set)=>sum+set.size,0)}}}
function element(){const classes=new Set(),styles=new Map();return {classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){if(on)classes.add(c);else classes.delete(c)}},style:{setProperty:(key,value)=>styles.set(key,value),removeProperty:key=>styles.delete(key),getPropertyValue:key=>styles.get(key)},getBoundingClientRect:()=>({top:160})}}

test('mobile chat resizes above the keyboard without dragging the page, preserves history and unlocks on rotation/unmount',()=>{
 const compact={...events(),matches:true},viewport={...events(),height:800,offsetTop:0},frames=new Map(),restored=[]
 let next=0,atBottom=true,nav={height:62,top:738}
 const win={...events(),visualViewport:viewport,innerHeight:800,scrollY:210,matchMedia:()=>compact,requestAnimationFrame(fn){frames.set(++next,fn);return next},cancelAnimationFrame:id=>frames.delete(id),scrollTo:(...args)=>restored.push(args)}
 const doc={body:element(),documentElement:element(),querySelector:()=>({getBoundingClientRect:()=>nav})},root={current:element()},scrollArea={current:{scrollTop:80,scrollHeight:1500}},textarea={current:{style:{},scrollHeight:300}}
 const flush=()=>{for(const [id,fn] of frames){frames.delete(id);fn()}}
 const stop=watchChatViewport({root,scrollArea,textarea,opened:true,isAtBottom:()=>atBottom,win,doc})
 assert.ok(doc.body.classList.contains('has-mobile-chat'));assert.equal(doc.body.style.getPropertyValue('--chat-page-top'),'-210px')
 assert.equal(root.current.style.getPropertyValue('--chat-height'),'800px');assert.equal(scrollArea.current.scrollTop,1500)
 viewport.height=320;viewport.offsetTop=24;viewport.emit('resize');viewport.emit('scroll');assert.equal(frames.size,1);flush()
 assert.equal(root.current.style.getPropertyValue('--chat-height'),'320px');assert.equal(root.current.style.getPropertyValue('--chat-top'),'24px');assert.equal(textarea.current.style.height,'64px');assert.ok(root.current.classList.contains('is-chat-compact'))
 atBottom=false;scrollArea.current.scrollTop=80;viewport.height=300;viewport.emit('resize');flush();assert.equal(scrollArea.current.scrollTop,80)
 compact.matches=false;nav={height:0,top:0};viewport.height=600;viewport.offsetTop=0;compact.emit('change');flush()
 assert.ok(!doc.body.classList.contains('has-mobile-chat'));assert.deepEqual(restored,[[0,210]]);assert.equal(root.current.style.getPropertyValue('--chat-height'),'428px')
 stop();assert.equal(win.count()+viewport.count()+compact.count(),0);assert.equal(frames.size,0)
 compact.matches=true;const close=watchChatViewport({root,scrollArea,textarea,opened:true,isAtBottom:()=>false,win,doc});viewport.emit('resize');close()
 assert.equal(frames.size,0);assert.ok(!doc.documentElement.classList.contains('has-mobile-chat'));assert.equal(doc.body.style.getPropertyValue('--chat-page-top'),undefined)
})
