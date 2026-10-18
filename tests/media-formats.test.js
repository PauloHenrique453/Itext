import test from 'node:test'
import assert from 'node:assert/strict'
import {appearance,videoEmbed,optimisticLike,commitLike,mediaTime} from '../src/services/mediaFormats.js'
import {attachmentInfo} from '../src/services/content.js'

test('video embeds canonicalize official public links and reject untrusted hosts, credentials and malformed IDs',()=>{
 for(const input of ['https://youtu.be/abcdefgh_12?t=12','https://www.youtube.com/watch?v=abcdefgh_12&foo=bar','https://youtube.com/shorts/abcdefgh_12'])assert.equal(videoEmbed(input).src,'https://www.youtube-nocookie.com/embed/abcdefgh_12')
 assert.equal(videoEmbed('https://www.tiktok.com/@person/video/1234567890123456789').src,'https://www.tiktok.com/player/v1/1234567890123456789?controls=1')
 assert.equal(videoEmbed('https://www.instagram.com/reel/Abcde_12345/?igsh=tracking').src,'https://www.instagram.com/reel/Abcde_12345/embed/')
 for(const value of ['javascript:alert(1)','https://youtube.com.evil.test/watch?v=abcdefgh_12','https://user:secret@youtube.com/watch?v=abcdefgh_12','https://youtube.com/watch?v=bad','https://www.instagram.com/reel/%22onload=bad','https://vm.tiktok.com/short/','https://example.com/video'])assert.equal(videoEmbed(value),null,value)
})
test('post likes render immediately while the server is pending and roll back failed requests',async()=>{
 const previous={likes:5,liked:false},renders=[]
 let resolve
 const wait=new Promise(done=>{resolve=done})
 const pending=commitLike(previous,true,()=>wait,row=>renders.push(row))
 assert.deepEqual(renders,[{likes:6,liked:true,pending:true}])
 resolve({likes:7,liked:true});await pending
 assert.deepEqual(renders.at(-1),{likes:7,liked:true,pending:false})
 await assert.rejects(commitLike(previous,true,()=>Promise.reject(new Error('offline')),row=>renders.push(row)),/offline/)
 assert.deepEqual(renders.at(-1),{...previous,pending:false})
 assert.deepEqual(optimisticLike({likes:0,liked:true},false),{likes:0,liked:false})
 assert.deepEqual(optimisticLike({likes:2,liked:true},true),{likes:2,liked:true})
})
test('video uploads allow the free-plan file ceiling with no duration cutoff and appearances use an explicit enum',()=>{
 assert.equal(attachmentInfo({name:'movie.mp4',type:'video/mp4',size:50000000,duration:7200}).limit,50000000)
 assert.throws(()=>attachmentInfo({name:'movie.mp4',type:'video/mp4',size:50000001}),/50 MB.*YouTube/)
 for(const value of ['white','graphite','black','common'])assert.equal(appearance(value),value)
 assert.equal(appearance('url(javascript:alert(1))'),'common')
 assert.equal(mediaTime(7261.9),'121:01');assert.equal(mediaTime(Infinity),'0:00');assert.equal(mediaTime(NaN),'0:00')
})
