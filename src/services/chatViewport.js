export function chatViewportBounds({height,offset=0,full=false,top=0,navTop=null}){
 const bottom=offset+height
 return {top:full?offset:top,height:Math.max(0,full?height:Math.min(bottom,navTop??bottom)-top-12),inputMax:Math.max(44,Math.min(120,Math.floor(height*.2))),extrasMax:Math.max(24,Math.min(150,Math.floor(height*.18)))}
}
export function resizeChatInput(node,max=120){
 if(!node)return
 node.style.height='0px'
 node.style.height=`${Math.max(44,Math.min(max,node.scrollHeight+2))}px`
}
// Keep the composer inside the visual viewport, including keyboard pan/resize.
export function watchChatViewport({root,scrollArea,textarea,opened,isAtBottom,win=window,doc=document}){
 const compact=win.matchMedia('(max-width: 930px)'),viewport=win.visualViewport
 let frame=null,locked=false,savedScroll=0
 function unlock(){
  if(!locked)return
  locked=false;doc.body.classList.remove('has-mobile-chat');doc.documentElement.classList.remove('has-mobile-chat')
  doc.body.style.removeProperty('--chat-page-top');win.scrollTo(0,savedScroll)
 }
 function measure(){
  const node=root.current;if(!node)return
  const full=compact.matches&&opened
  if(full&&!locked){savedScroll=win.scrollY;locked=true;doc.body.style.setProperty('--chat-page-top',`${-savedScroll}px`);doc.body.classList.add('has-mobile-chat');doc.documentElement.classList.add('has-mobile-chat')}
  if(!full)unlock()
  const height=viewport?.height||win.innerHeight,offset=viewport?.offsetTop||0
  const nav=doc.querySelector('.mobile-nav')?.getBoundingClientRect()
  const bounds=chatViewportBounds({height,offset,full,top:full?0:node.getBoundingClientRect().top,navTop:!full&&nav?.height&&nav.top>0?nav.top:null})
  node.style.setProperty('--chat-height',`${bounds.height}px`);node.style.setProperty('--chat-top',`${bounds.top}px`)
  node.style.setProperty('--chat-input-max-height',`${bounds.inputMax}px`);node.style.setProperty('--chat-extras-max-height',`${bounds.extrasMax}px`)
  node.classList.toggle('is-chat-compact',full&&height<500)
  resizeChatInput(textarea.current,bounds.inputMax)
  if(isAtBottom()&&scrollArea.current)scrollArea.current.scrollTop=scrollArea.current.scrollHeight
 }
 function schedule(){if(frame===null)frame=win.requestAnimationFrame(()=>{frame=null;measure()})}
 measure();win.addEventListener('resize',schedule);win.addEventListener('scroll',schedule,{passive:true});compact.addEventListener('change',schedule)
 viewport?.addEventListener('resize',schedule);viewport?.addEventListener('scroll',schedule)
 return()=>{if(frame!==null)win.cancelAnimationFrame(frame);win.removeEventListener('resize',schedule);win.removeEventListener('scroll',schedule);compact.removeEventListener('change',schedule);viewport?.removeEventListener('resize',schedule);viewport?.removeEventListener('scroll',schedule);root.current?.classList.remove('is-chat-compact');unlock()}
}
