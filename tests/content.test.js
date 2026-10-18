import test from 'node:test'
import assert from 'node:assert/strict'
import {attachmentInfo,safeLink,extractLinks,threadComments} from '../src/services/content.js'
test('attachment validation accepts actual media and documents with per-type size limits',()=>{
 assert.equal(attachmentInfo({name:'foto.png',type:'image/png',size:2000}).type,'image')
 assert.equal(attachmentInfo({name:'notas.pdf',type:'application/pdf',size:100}).type,'file')
 assert.equal(attachmentInfo({name:'dados.csv',type:'',size:100}).type,'file')
 assert.throws(()=>attachmentInfo({name:'programa.exe',type:'application/octet-stream',size:100}))
 assert.throws(()=>attachmentInfo({name:'arquivo.pdf',type:'application/pdf',size:15000001}))
 assert.throws(()=>attachmentInfo({name:'foto.png',type:'image/png',size:8000001}))
})
test('link cards allow explicit web protocols and reject executable or credential-bearing URLs',()=>{
 assert.equal(safeLink('javascript:alert(1)'),null);assert.equal(safeLink('data:text/html,hello'),null);assert.equal(safeLink('https://user:password@example.com'),null)
 assert.equal(safeLink('https://example.com'),'https://example.com/')
 assert.deepEqual(extractLinks('Veja https://example.com e https://example.com.'),['https://example.com/'])
})
test('comment threads retain exact reply targets, order children and survive hidden parents or malformed cycles',()=>{
 const rows=threadComments([{id:'root'},{id:'child',parent_id:'root'},{id:'nested',parent_id:'child'},{id:'orphan',parent_id:'hidden'}])
 assert.deepEqual(rows.map(row=>[row.id,row.depth]),[['root',0],['child',1],['nested',2],['orphan',0]])
 assert.equal(threadComments([{id:'a',parent_id:'b'},{id:'b',parent_id:'a'}]).length,2)
})

test('story share links contain only the story ID and never forward invitation keys, OAuth codes, signed URLs or fragments',async()=>{
 const {storyAddress,storyIdFromSearch}=await import('../src/services/content.js')
 const id='00000000-0000-0000-0000-000000000001'
 const url=storyAddress(id,'https://itext-1b9da.web.app/?grupo=private&convite=secret&code=oauth&url=signed#token')
 assert.equal(url,'https://itext-1b9da.web.app/?story='+id)
 assert.equal(storyIdFromSearch(new URL(url).search),id)
 assert.equal(storyIdFromSearch('?story=not-a-uuid'),null)
 assert.equal(storyIdFromSearch('?perfil='+id),null)
 assert.throws(()=>storyAddress('bad','https://itext-1b9da.web.app'))
 assert.throws(()=>storyAddress(id,'javascript:alert(1)'))
})
