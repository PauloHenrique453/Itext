import {useEffect,useRef,useState} from 'react'
import {createPullRefresh} from '../services/pullRefresh.js'
export default function usePullRefresh(root,onRefresh,onError){
 const [phase,setPhase]=useState('idle'),latest=useRef({onRefresh,onError}),controller=useRef(null)
 latest.current={onRefresh,onError}
 useEffect(()=>{
  const node=root.current;if(!node)return
  const machine=createPullRefresh({canStart:()=>window.scrollY<=2&&!document.body.classList.contains('has-modal')&&!document.body.classList.contains('has-short-viewer'),refresh:()=>latest.current.onRefresh(),onError:issue=>latest.current.onError(issue),onChange:state=>{node.style.setProperty('--feed-pull',`${state.distance}px`);node.style.setProperty('--pull-progress',String(state.distance/64));setPhase(previous=>previous===state.phase?previous:state.phase)}})
  controller.current=machine
  function start(event){if(event.touches.length!==1){machine.cancel();return}const touch=event.touches[0],interactive=event.target.closest('input,textarea,select,button,a,video,audio,[contenteditable="true"],[data-no-pull]');machine.begin(touch.clientX,touch.clientY,!interactive&&!window.getSelection()?.toString())}
  function move(event){if(event.touches.length!==1){machine.cancel();return}const touch=event.touches[0];if(machine.move(touch.clientX,touch.clientY)&&event.cancelable)event.preventDefault()}
  const end=()=>void machine.end(),cancel=()=>machine.cancel()
  document.documentElement.classList.add('has-home-pull')
  node.addEventListener('touchstart',start,{passive:true});node.addEventListener('touchmove',move,{passive:false});node.addEventListener('touchend',end);node.addEventListener('touchcancel',cancel)
  return()=>{machine.dispose();controller.current=null;document.documentElement.classList.remove('has-home-pull');node.removeEventListener('touchstart',start);node.removeEventListener('touchmove',move);node.removeEventListener('touchend',end);node.removeEventListener('touchcancel',cancel)}
 },[root])
 return {phase,refresh:()=>controller.current?.refresh()}
}
