export function shortViewportRect({height,width,offset=0,fullscreen=false,headerBottom=offset,navTop=null,mainLeft=0,mainRight=width}){
 const top=fullscreen?offset:Math.max(offset,headerBottom),bottom=fullscreen?offset+height:Math.min(offset+height,navTop??offset+height)
 const left=fullscreen?0:Math.max(0,mainLeft),right=fullscreen?width:Math.min(width,mainRight)
 return {top,left,width:Math.max(0,right-left),height:Math.max(0,bottom-top)}
}
const boundedRoots=new Set()
export function watchShortViewport({root,feed,header,fullscreen=false,win=window,doc=document}){
 const compact=win.matchMedia('(max-width: 1100px)'),viewport=win.visualViewport,node=root.current,area=feed.current
 if(!node||!area)return()=>{}
 let frame=null,lastHeight=0
 function lock(value){if(value)boundedRoots.add(node);else boundedRoots.delete(node);doc.body.classList.toggle('has-ishort-stage',boundedRoots.size>0);doc.documentElement.classList.toggle('has-ishort-stage',boundedRoots.size>0)}
 function measure(){
  const bound=compact.matches||fullscreen,height=viewport?.height||win.innerHeight,offset=viewport?.offsetTop||0
  const nav=doc.querySelector('.mobile-nav')?.getBoundingClientRect(),bar=doc.querySelector('.mobile-header')?.getBoundingClientRect(),main=node.closest('.app-main')?.getBoundingClientRect()
  const rect=shortViewportRect({height,width:win.innerWidth,offset,fullscreen,headerBottom:bar?.height?bar.bottom:offset,navTop:nav?.height&&nav.top>offset?nav.top:null,mainLeft:main?.left||0,mainRight:main?.right||win.innerWidth})
  node.classList.toggle('is-bound',bound);lock(bound)
  if(bound){node.style.setProperty('--ishort-top',`${rect.top}px`);node.style.setProperty('--ishort-left',`${rect.left}px`);node.style.setProperty('--ishort-width',`${rect.width}px`);node.style.setProperty('--ishort-view-height',`${rect.height}px`)}
  const stageHeight=Math.max(0,(bound?rect.top+rect.height:offset+height-10)-area.getBoundingClientRect().top)
  const index=lastHeight?Math.round(area.scrollTop/lastHeight):0
  area.style.setProperty('--ishort-height',`${stageHeight}px`)
  node.classList.toggle('is-condensed-stage',stageHeight<430);node.classList.toggle('is-low-stage',stageHeight<300);node.classList.toggle('is-micro-stage',stageHeight<190)
  if(lastHeight&&lastHeight!==stageHeight)area.scrollTop=index*stageHeight
  lastHeight=stageHeight
 }
 function schedule(){if(frame===null)frame=win.requestAnimationFrame(()=>{frame=null;measure()})}
 measure();win.addEventListener('resize',schedule);win.addEventListener('scroll',schedule,{passive:true});compact.addEventListener('change',schedule);viewport?.addEventListener('resize',schedule);viewport?.addEventListener('scroll',schedule)
 const observer=win.ResizeObserver?new win.ResizeObserver(schedule):null
 for(const target of [header.current,doc.querySelector('.mobile-header'),doc.querySelector('.mobile-nav'),doc.querySelector('.signin-banner')])if(target)observer?.observe(target)
 return()=>{if(frame!==null)win.cancelAnimationFrame(frame);observer?.disconnect();win.removeEventListener('resize',schedule);win.removeEventListener('scroll',schedule);compact.removeEventListener('change',schedule);viewport?.removeEventListener('resize',schedule);viewport?.removeEventListener('scroll',schedule);lock(false)}
}
