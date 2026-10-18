import { useLayoutEffect } from 'react'
export default function useChatViewport(root,opened,scrollArea,atBottom){
 useLayoutEffect(()=>{
  const compact=window.matchMedia('(max-width: 700px)')
  function measure(){
   const node=root.current;if(!node)return
   const viewport=window.visualViewport,height=viewport?.height||window.innerHeight,offset=viewport?.offsetTop||0
   const full=compact.matches&&opened
   document.body.classList.toggle('has-mobile-chat',full)
   const top=full?0:node.getBoundingClientRect().top
   const nav=document.querySelector('.mobile-nav')?.getBoundingClientRect()
   const bottom=!full&&nav?.height&&nav.top>0?Math.min(height,nav.top):height
   node.style.setProperty('--chat-height',`${Math.max(120,bottom-top-(full?0:12))}px`)
   node.style.setProperty('--chat-top',`${offset}px`)
   if(atBottom&&scrollArea.current)scrollArea.current.scrollTop=scrollArea.current.scrollHeight
  }
  measure();window.addEventListener('resize',measure);window.addEventListener('scroll',measure,{passive:true});compact.addEventListener('change',measure)
  window.visualViewport?.addEventListener('resize',measure);window.visualViewport?.addEventListener('scroll',measure)
  return()=>{document.body.classList.remove('has-mobile-chat');window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure);compact.removeEventListener('change',measure);window.visualViewport?.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('scroll',measure)}
 },[root,opened,scrollArea,atBottom])
}
