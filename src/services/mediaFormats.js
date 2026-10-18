export const appearances=[['common','Comum'],['white','Branco'],['graphite','Cinza grafite'],['black','Black']]
export const storyColors=['#102a43','#111111','#7134b6','#be185d','#115e59','#b45309','#2563eb','#e5e7eb']
export const storyFonts={classic:'Inter, sans-serif',serif:'Georgia, serif',rounded:'Manrope, sans-serif',mono:'monospace'}
export function appearance(value){return appearances.some(([id])=>id===value)?value:'common'}
export function videoEmbed(value){
 let url
 try{url=new URL(value)}catch{return null}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return null
 const host=url.hostname.toLowerCase(),parts=url.pathname.split('/').filter(Boolean)
 let id
 if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com','youtu.be','www.youtu.be'].includes(host)){
  id=host.endsWith('youtu.be')?parts[0]:['shorts','embed','live'].includes(parts[0])?parts[1]:parts[0]==='watch'?url.searchParams.get('v'):null
  if(!/^[\w-]{11}$/.test(id||''))return null
  return {provider:'YouTube',id,src:`https://www.youtube-nocookie.com/embed/${id}`,href:`https://www.youtube.com/watch?v=${id}`}
 }
 if(['www.tiktok.com','tiktok.com','m.tiktok.com'].includes(host)){
  id=parts[0]?.startsWith('@')&&parts[1]==='video'?parts[2]:parts[0]==='player'&&parts[1]==='v1'?parts[2]:null
  if(!/^\d{15,25}$/.test(id||''))return null
  return {provider:'TikTok',id,portrait:true,src:`https://www.tiktok.com/player/v1/${id}?controls=1`,href:parts[0]?.startsWith('@')?`https://www.tiktok.com/${parts[0]}/video/${id}`:`https://www.tiktok.com/player/v1/${id}`}
 }
 if(['www.instagram.com','instagram.com'].includes(host)&&['p','reel','reels','tv'].includes(parts[0])&&/^[\w-]{5,64}$/.test(parts[1]||'')){
  const type=parts[0]==='reels'?'reel':parts[0];id=parts[1]
  return {provider:'Instagram',id,portrait:true,src:`https://www.instagram.com/${type}/${id}/embed/`,href:`https://www.instagram.com/${type}/${id}/`}
 }
 return null
}
export function optimisticLike(previous,desired){return {likes:Math.max(0,Number(previous.likes||0)+(previous.liked===desired?0:desired?1:-1)),liked:desired}}
export async function commitLike(previous,desired,write,render){
 render({...optimisticLike(previous,desired),pending:true})
 try{const row=await write(desired);if(!row||typeof row.liked!=='boolean'||!Number.isFinite(row.likes))throw new Error('Não foi possível confirmar a curtida.');render({...row,pending:false});return row}
 catch(issue){render({...previous,pending:false});throw issue}
}
export function mediaTime(value){if(!Number.isFinite(value)||value<0)return '0:00';const seconds=Math.floor(value);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}
