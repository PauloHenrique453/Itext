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
