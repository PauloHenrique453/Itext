import { useEffect,useState } from 'react'
import { supabase } from '../services/auth.js'
import { messagesClient } from '../services/messaging.js'
const api=supabase?messagesClient(supabase):null
export default function useUnreadCount(userId){
 const [count,setCount]=useState(0)
 useEffect(()=>{
  if(!userId||!api)return
  let active=true
  const refresh=()=>{void Promise.all([api.inbox(),api.blocks()]).then(([rows,blocks])=>{if(active)setCount(rows.filter(row=>!blocks.some(block=>block.blocked_id===row.partner_id)).reduce((sum,row)=>sum+Number(row.unread),0))}).catch(()=>{})}
  refresh()
  const stop=api.listen(userId,refresh,(status)=>{if(status==='SUBSCRIBED')refresh()},false,refresh)
  const timer=setInterval(refresh,60000)
  return()=>{active=false;stop();clearInterval(timer)}
 },[userId])
 return count
}
