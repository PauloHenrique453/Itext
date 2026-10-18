import { attachmentInfo } from './content.js'
export const SHORT_MAX_SECONDS=600
export function validateShort(file,info){
 if(attachmentInfo(file).type!=='video')throw new Error('Escolha um arquivo de vídeo.')
 if(!Number.isFinite(info?.duration)||info.duration<=0)throw new Error('Não foi possível ler a duração do vídeo. Escolha um arquivo compatível.')
 if(info.duration>SHORT_MAX_SECONDS)throw new Error('O Ishort aceita vídeos de até 10 minutos. Publique vídeos maiores no feed normal.')
 if(!Number.isFinite(info.width)||!Number.isFinite(info.height)||info.width<=0||info.height<=0)throw new Error('Não foi possível ler a imagem do vídeo.')
 return {duration:info.duration,width:info.width,height:info.height}
}
export function inspectShort(file){
 if(attachmentInfo(file).type!=='video')return Promise.reject(new Error('Escolha um arquivo de vídeo.'))
 return new Promise((resolve,reject)=>{
  const video=document.createElement('video'),url=URL.createObjectURL(file)
  const done=(error,value)=>{clearTimeout(timer);video.onloadedmetadata=null;video.onerror=null;video.removeAttribute('src');video.load();URL.revokeObjectURL(url);if(error)reject(error);else resolve(value)}
  const timer=setTimeout(()=>done(new Error('A leitura do vídeo demorou demais. Tente outro arquivo.')),15000)
  video.preload='metadata';video.muted=true
  video.onloadedmetadata=()=>{try{done(null,validateShort(file,{duration:video.duration,width:video.videoWidth,height:video.videoHeight}))}catch(issue){done(issue)}}
  video.onerror=()=>done(new Error('Este vídeo não é compatível com o navegador. Tente MP4 com vídeo H.264 e áudio AAC.'))
  video.src=url
 })
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function shortTarget(search=''){const params=new URLSearchParams(search),id=params.get('ishort');return uuid.test(id||'')?id:null}
export function shortAddress(id,address){if(!uuid.test(id||''))throw new Error('Vídeo inválido.');const url=new URL(address);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Endereço inválido.');url.search='';url.hash='';url.searchParams.set('ishort',id);return url.href}
export function mergeShortPosts(previous,next){const items=new Map(previous.map(post=>[post.id,post]));for(const post of next)items.set(post.id,{...items.get(post.id),...post});return [...items.values()]}
export function shortClips(posts){return posts.flatMap(post=>(post.media||[]).filter(item=>item.type==='video'&&item.short===true&&Number.isFinite(item.duration)&&item.duration>0&&item.duration<=SHORT_MAX_SECONDS).map((item,index)=>({post,media:item,key:`${post.id}:${index}`})))}

const playbackIntents=new WeakMap()
export function syncShortPlayback(node,allowed,onBlocked){
 const intent={allowed};playbackIntents.set(node,intent)
 if(!allowed)node.pause()
 else void (async()=>{try{await node.play();if(!playbackIntents.get(node)?.allowed)node.pause()}catch{if(playbackIntents.get(node)===intent)onBlocked()}})()
 return()=>{if(playbackIntents.get(node)===intent){playbackIntents.set(node,{allowed:false});node.pause()}}
}
