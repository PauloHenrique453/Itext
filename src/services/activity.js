import { supabase } from './auth.js'
export async function heartbeat(session,active) {const {error}=await supabase.rpc('itext_heartbeat',{device_id:session,active});if(error)throw error}
export async function onlineStatus(ids) {
 if(!ids.length)return []
 const rows=[]
 for(let offset=0;offset<ids.length;offset+=200){const {data,error}=await supabase.rpc('itext_online_status',{profile_ids:ids.slice(offset,offset+200)});if(error)throw error;rows.push(...data)}
 return rows
}
export async function notificationCount(){const {count,error}=await supabase.from('itext_notifications').select('id',{count:'exact',head:true}).is('read_at',null);if(error)throw error;return count||0}
export async function notifications(before=null){
 let query=supabase.from('itext_notifications').select('*').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50)
 if(before)query=query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`)
 const {data,error}=await query;if(error)throw error
 const ids=[...new Set(data.map(row=>row.actor_id))]
 const people=ids.length?await supabase.from('itext_public_profiles').select('id,name,avatar_url').in('id',ids):{data:[]}
 if(people.error)throw people.error
 const actors=await Promise.all(people.data.map(async person=>{let avatar=person.avatar_url;if(avatar?.startsWith('itext-media:')){const signed=await supabase.storage.from('itext-media').createSignedUrl(avatar.slice(12),300);avatar=signed.data?.signedUrl||null}return {...person,avatar}}))
 const byId=new Map(actors.map(person=>[person.id,person]))
 return {rows:data.map(row=>({...row,name:byId.get(row.actor_id)?.name||'Membro do Itext',avatar:byId.get(row.actor_id)?.avatar})),hasMore:data.length===50,cursor:data.at(-1)||null}
}
export async function markNotifications(ids=null){const {error}=await supabase.rpc('itext_mark_notifications',{ids});if(error)throw error;window.dispatchEvent(new Event('itext:notifications'))}
export function listenActivity(uid,change) {
 const channel=supabase.channel(`activity-${uid}-${crypto.randomUUID()}`)
 for(const event of ['INSERT','UPDATE'])channel.on('postgres_changes',{event,schema:'public',table:'itext_activity',filter:`user_id=eq.${uid}`},change)
 channel.subscribe(status=>{if(status==='SUBSCRIBED')change()})
 return()=>{void supabase.removeChannel(channel)}
}
