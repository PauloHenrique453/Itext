import {useEffect,useRef} from 'react'
export default function useVisibleEvent(ref,key,enabled,callback,delay=1800){
 const call=useRef(callback);call.current=callback
 useEffect(()=>{
  const node=ref.current;if(!node||!enabled||!globalThis.IntersectionObserver)return
  let timer=null,done=false,visible=false
  function sync(){
   clearTimeout(timer)
   const topModal=[...document.querySelectorAll('.modal[role="dialog"]')].at(-1)
   const covered=topModal?!topModal.contains(node):document.body.classList.contains('has-short-viewer')&&!node.closest('.ishort-view.is-fullscreen')
   if(!done&&visible&&!document.hidden&&!covered)timer=setTimeout(()=>{done=true;Promise.resolve().then(()=>call.current()).catch(()=>{done=false})},delay)
  }
  const observer=new IntersectionObserver(entries=>{const entry=entries[0];visible=entry.isIntersecting&&entry.intersectionRect.height>=Math.min(120,entry.boundingClientRect.height*.5);sync()},{threshold:[0,.1,.25,.5,.75,1]})
  observer.observe(node);document.addEventListener('visibilitychange',sync)
  const changes=new MutationObserver(sync);changes.observe(document.body,{attributes:true,attributeFilter:['class']})
  return()=>{clearTimeout(timer);observer.disconnect();changes.disconnect();document.removeEventListener('visibilitychange',sync)}
 },[ref,key,enabled,delay])
}
