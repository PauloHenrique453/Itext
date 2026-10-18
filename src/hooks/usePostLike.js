import { useEffect,useRef,useState } from 'react'
import { commitLike } from '../services/mediaFormats.js'
import { itextApi } from '../services/itextApi.js'
export default function usePostLike(post,onWrite,onNotify){
 const [state,setState]=useState({likes:Number(post.likes||0),liked:!!post.liked,pending:false})
 const pending=useRef(false),mounted=useRef(true)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{if(!pending.current)setState({likes:Number(post.likes||0),liked:!!post.liked,pending:false})},[post.id,post.likes,post.liked])
 async function toggle(){
  if(pending.current)return
  pending.current=true
  try{await commitLike(state,!state.liked,desired=>onWrite?onWrite(post.id,desired):itextApi.setPostLike(post.id,desired),next=>{if(mounted.current)setState(next)})}
  catch(issue){onNotify?.(issue.message)}finally{pending.current=false}
 }
 return {...state,toggle}
}
