import test from 'node:test'
import assert from 'node:assert/strict'
import {createPullRefresh,PULL_THRESHOLD} from '../src/services/pullRefresh.js'
import {shortViewportRect,watchShortViewport} from '../src/services/shortViewport.js'
import {setShortSound,syncShortPlayback} from '../src/services/shorts.js'

test('refresh requires a downward pull from the top, cancels horizontal/short/interactive gestures, and sends one real request',async()=>{
 let atTop=true,calls=0,finish
 const changes=[],machine=createPullRefresh({canStart:()=>atTop,refresh:()=>{calls++;return new Promise(resolve=>finish=resolve)},onChange:value=>changes.push(value)})
 machine.begin(0,0,false);assert.equal(machine.move(0,200),false);machine.end();assert.equal(calls,0)
 atTop=false;machine.begin(0,0);assert.equal(machine.move(0,200),false);machine.end();assert.equal(calls,0)
 atTop=true;machine.begin(0,0);assert.equal(machine.move(100,20),false);machine.end();assert.equal(calls,0)
 machine.begin(0,0);machine.move(0,60);assert.equal(machine.snapshot().phase,'pulling');machine.end();assert.equal(calls,0)
 machine.begin(0,0);machine.move(0,200);assert.equal(machine.snapshot().phase,'ready');machine.move(0,20);machine.end();assert.equal(calls,0)
 machine.begin(0,0);machine.move(0,200);atTop=false;assert.equal(machine.move(0,220),false);machine.end();assert.equal(calls,0)
 atTop=true;machine.begin(0,0);assert.equal(machine.move(0,150),true);assert.equal(machine.snapshot().phase,'ready')
 const refreshing=machine.end();assert.equal(calls,1);assert.deepEqual(machine.snapshot(),{phase:'refreshing',distance:PULL_THRESHOLD})
 machine.begin(0,0);machine.move(0,150);machine.end();await machine.refresh();assert.equal(calls,1)
 finish();await refreshing;assert.deepEqual(machine.snapshot(),{phase:'idle',distance:0})
 assert.ok(changes.some(row=>row.phase==='ready'));machine.dispose()
})
test('refresh failure clears the loader and reports the error; leaving the page suppresses late notifications',async()=>{
 const errors=[];let fail
 const machine=createPullRefresh({refresh:()=>new Promise((_,reject)=>fail=reject),onError:issue=>errors.push(issue.message)})
 const first=machine.refresh();fail(new Error('offline'));await first;assert.deepEqual(errors,['offline']);assert.equal(machine.snapshot().phase,'idle')
 const second=machine.refresh();machine.dispose();fail(new Error('late'));await second;assert.deepEqual(errors,['offline'])
})
test('Ishort fits between app navigation bars, respects tablet content width and includes viewport pan only once',()=>{
 assert.deepEqual(shortViewportRect({width:390,height:844,headerBottom:58,navTop:782}),{top:58,left:0,width:390,height:724})
 assert.deepEqual(shortViewportRect({width:1024,height:768,mainLeft:84,mainRight:1024}),{top:0,left:84,width:940,height:768})
 assert.deepEqual(shortViewportRect({width:390,height:320,offset:24,fullscreen:true,navTop:200,headerBottom:58,mainLeft:84}),{top:24,left:0,width:390,height:320})
 assert.equal(shortViewportRect({width:320,height:100,headerBottom:58,navTop:30}).height,0)
})
function events(){const listeners=new Map();return {listeners,addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn)},removeEventListener(type,fn){listeners.get(type)?.delete(fn)},emit(type){for(const fn of listeners.get(type)||[])fn()},count(){return [...listeners.values()].reduce((sum,set)=>sum+set.size,0)}}}
function element(){const values=new Map(),classes=new Set();return {style:{setProperty:(key,value)=>values.set(key,value),getPropertyValue:key=>values.get(key)},classList:{toggle(c,on){if(on)classes.add(c);else classes.delete(c)},contains:c=>classes.has(c)}}}
test('Ishort keeps the current clip on orientation changes, chooses compact controls for low space and releases its scroll lock',()=>{
 const compact={...events(),matches:true},viewport={...events(),height:844,offsetTop:0},frames=new Map();let next=0,nav={top:782,height:62},bar={bottom:58,height:58},main={left:0,right:390}
 const win={...events(),visualViewport:viewport,innerWidth:390,innerHeight:844,matchMedia:()=>compact,requestAnimationFrame(fn){frames.set(++next,fn);return next},cancelAnimationFrame:id=>frames.delete(id)}
 const node=element(),area={...element(),scrollTop:0,getBoundingClientRect:()=>({top:compact.matches?Number.parseFloat(node.style.getPropertyValue('--ishort-top'))+56:180})}
 node.closest=()=>({getBoundingClientRect:()=>main})
 const doc={body:element(),documentElement:element(),querySelector:selector=>selector==='.mobile-nav'?{getBoundingClientRect:()=>nav}:selector==='.mobile-header'?{getBoundingClientRect:()=>bar}:null}
 const stop=watchShortViewport({root:{current:node},feed:{current:area},header:{current:{}},win,doc})
 assert.equal(node.style.getPropertyValue('--ishort-view-height'),'724px');assert.equal(area.style.getPropertyValue('--ishort-height'),'668px');assert.ok(doc.body.classList.contains('has-ishort-stage'))
 area.scrollTop=668*2;win.innerWidth=740;viewport.height=360;nav={top:298,height:62};main={left:0,right:740};viewport.emit('resize');win.emit('resize');assert.equal(frames.size,1)
 for(const [id,fn] of frames){frames.delete(id);fn()}
 assert.equal(area.style.getPropertyValue('--ishort-height'),'184px');assert.equal(area.scrollTop,184*2);assert.ok(node.classList.contains('is-condensed-stage'));assert.ok(node.classList.contains('is-low-stage'));assert.ok(node.classList.contains('is-micro-stage'))
 compact.matches=false;win.innerWidth=1280;viewport.height=900;bar={height:0};nav={height:0};compact.emit('change');for(const [id,fn] of frames){frames.delete(id);fn()}
 assert.equal(area.style.getPropertyValue('--ishort-height'),'710px');assert.ok(!doc.body.classList.contains('has-ishort-stage'))
 win.emit('resize');stop();assert.equal(frames.size,0);assert.equal(win.count()+compact.count()+viewport.count(),0)
})
test('unmuting happens synchronously in the gesture, resumes only eligible playback, and late play cannot restart a hidden video',async()=>{
 const calls=[],pending=[];const node={muted:true,pause(){calls.push('pause')},play(){calls.push(['play',this.muted]);return new Promise(resolve=>pending.push(resolve))}}
 setShortSound(node,false,true,()=>{});assert.equal(node.muted,false);assert.deepEqual(calls,[['play',false]])
 syncShortPlayback(node,false,()=>{});const pauses=calls.length;pending[0]();await new Promise(resolve=>setImmediate(resolve));assert.ok(calls.length>pauses)
 calls.length=0;setShortSound(node,true,false,()=>{});assert.equal(node.muted,true);assert.equal(calls.length,0)
 setShortSound(node,false,false,()=>{});assert.equal(node.muted,false);assert.equal(calls.length,0)
})
