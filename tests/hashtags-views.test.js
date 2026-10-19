import test from 'node:test'
import assert from 'node:assert/strict'
import {extractHashtags,hashtagParts,normalizeTag} from '../src/services/hashtags.js'
import {createViewRecorder} from '../src/services/viewRecording.js'
test('hashtags tokenize real boundaries, normalize Unicode/case, ignore URL fragments and reconstruct safe plain text',()=>{
 const text='Olá #CAFÉ #cafe\u0301 e #novo_2026! https://example.test/#hidden x#not ##double #'+ 'a'.repeat(65)
 assert.deepEqual(extractHashtags(text),['#café','#novo_2026'])
 assert.equal(hashtagParts(text).map(part=>part.text).join(''),text.normalize('NFC'))
 assert.equal(normalizeTag('#CAFÉ'),'#café');assert.equal(normalizeTag('novo_2026'),'#novo_2026');assert.equal(normalizeTag('two words'),null);assert.equal(normalizeTag('<script>'),null)
 assert.equal(extractHashtags(Array.from({length:40},(_,i)=>'#tag'+i).join(' ')).length,30)
})
test('view recording coalesces concurrent observations per account without merging different users or permanently caching failures',async()=>{
 const calls=[];let fail=true
 const record=createViewRecorder(async id=>{calls.push(id);if(id==='retry'&&fail){fail=false;throw new Error('offline')}return 7})
 assert.deepEqual(await Promise.all([record('one','post'),record('one','post'),record('one','post')]),[7,7,7]);assert.equal(calls.length,1)
 await record('two','post');assert.equal(calls.length,2)
 await record('one','post');assert.equal(calls.length,3)
 await assert.rejects(record('one','retry'),/offline/);assert.equal(await record('one','retry'),7);assert.equal(calls.filter(id=>id==='retry').length,2)
})
