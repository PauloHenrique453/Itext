import test from 'node:test'
import assert from 'node:assert/strict'
import {createFeedPlayback} from '../src/services/feedPlayback.js'
import {revealMessage,restoreChatScroll} from '../src/services/chatScroll.js'
import {shortClips,shortAddress} from '../src/services/shorts.js'
import {loginOptions} from '../src/services/loginOptions.js'
test('only one visible feed video plays, hiding the page or opening overlays pauses it, removal activates the remaining visible video',()=>{
 const manager=createFeedPlayback(),state={},first={},second={}
 const remove=manager.register(first,value=>state.first=value);manager.register(second,value=>state.second=value)
 manager.update(first,.8);manager.update(second,.6);assert.deepEqual(state,{first:true,second:false})
 manager.update(second,.9);assert.deepEqual(state,{first:false,second:true})
 manager.prefer(first);assert.deepEqual(state,{first:true,second:false});manager.update(first,0);assert.deepEqual(state,{first:false,second:true})
 manager.block(true);assert.deepEqual(state,{first:false,second:false})
 manager.block(false);assert.deepEqual(state,{first:false,second:true})
 manager.update(first,.8);manager.update(second,0);assert.deepEqual(state,{first:true,second:false})
 remove();assert.deepEqual(state,{first:true,second:false});manager.update(second,.8);assert.equal(state.second,true)
 manager.update(second,.2);assert.equal(state.second,false)
})
test('message navigation and older history scroll only their container and retain the visible historical position',()=>{
 const calls=[],area={scrollTop:80,scrollHeight:900,clientHeight:300,contains:node=>node.local,getBoundingClientRect:()=>({top:120}),scrollTo:args=>calls.push(args)}
 revealMessage(area,{local:true,offsetHeight:60,getBoundingClientRect:()=>({top:250})});assert.deepEqual(calls,[{top:90,behavior:'smooth'}])
 revealMessage(area,{local:false});assert.equal(calls.length,1)
 restoreChatScroll(area,{top:80,height:500},false);assert.equal(area.scrollTop,480)
 restoreChatScroll(area,null,false);assert.equal(area.scrollTop,480)
 restoreChatScroll(area,null,true);assert.equal(area.scrollTop,900)
})
test('a targeted feed viewer opens the exact long video without putting ordinary videos in Ishort discovery; shared media selection survives login',()=>{
 const id='00000000-0000-0000-0000-000000000001',post={id,media:[{type:'image'},{type:'video',duration:1300},{type:'video',duration:80}]}
 assert.equal(shortClips([post]).length,0)
 const clips=shortClips([{...post,viewerOnly:true,viewerIndex:2}]);assert.equal(clips.length,2);assert.equal(clips[0].index,2);assert.equal(clips[1].media.duration,1300)
 const address=shortAddress(id,'https://itext-1b9da.web.app/?code=secret#token',2);assert.equal(address,'https://itext-1b9da.web.app/?ishort='+id+'&video=2')
 assert.equal(loginOptions('google','https://itext-1b9da.web.app',new URL(address).search+'&code=secret').redirectTo,address)
 assert.ok(!loginOptions('google','https://itext-1b9da.web.app','?ishort='+id+'&video=999').redirectTo.includes('video='))
})
