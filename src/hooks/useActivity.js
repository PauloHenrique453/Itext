import { useEffect,useState } from 'react'
import { heartbeat,listenActivity,notificationCount,onlineStatus } from '../services/activity.js'
export function usePresence(userId){
 useEffect(()=>{
  if(!userId)return
  const session=crypto.randomUUID()
  const update=()=>{void heartbeat(session,document.visibilityState==='visible').catch(()=>{})}
  update();const timer=setInterval(update,25000)
  document.addEventListener('visibilitychange',update)
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);void heartbeat(session,false).catch(()=>{})}
 },[userId])
}
export function useOnline(ids){
 const [rows,setRows]=useState(null)
 const key=[...new Set(ids)].sort().join(',')
 useEffect(()=>{
  let active=true;setRows(null)
  const update=()=>{void onlineStatus(key?key.split(','):[]).then(rows=>{if(active)setRows(rows)}).catch(()=>{if(active)setRows(null)})}
  update();const timer=setInterval(update,15000)
  window.addEventListener('focus',update)
  return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',update)}
 },[key])
 return rows
}
export function useNotificationCount(uid){
 const [count,setCount]=useState(0)
 useEffect(()=>{
  if(!uid)return
  let active=true
  const refresh=()=>{void notificationCount().then(value=>{if(active)setCount(value)}).catch(()=>{})}
  refresh();const stop=listenActivity(uid,refresh),timer=setInterval(refresh,30000)
  window.addEventListener('itext:notifications',refresh);window.addEventListener('focus',refresh)
  return()=>{active=false;stop();clearInterval(timer);window.removeEventListener('itext:notifications',refresh);window.removeEventListener('focus',refresh)}
 },[uid])
 return count
}
