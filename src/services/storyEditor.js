import {cutPlan} from './videoCuts.js'
export const storyPresentationOptions={
 size:[['small','Pequeno'],['normal','Médio'],['large','Grande']],
 align:[['left','Esquerda'],['center','Centro'],['right','Direita']],
 position:[['top','Em cima'],['middle','No meio'],['bottom','Embaixo']],
 color:[['auto','Automática'],['white','Branco'],['black','Preto'],['yellow','Amarelo']],
 fit:[['contain','Mostrar inteira'],['cover','Preencher']],
 filter:[['none','Original'],['warm','Quente'],['mono','Preto e branco'],['vivid','Vivo']],
}
export const storyPresentationDefaults={size:'normal',align:'center',position:'bottom',color:'auto',fit:'contain',filter:'none',muted:false}
export function storyPresentation(value={}){
 const safe={...storyPresentationDefaults}
 for(const [key,choices] of Object.entries(storyPresentationOptions))if(choices.some(([id])=>id===value?.[key]))safe[key]=value[key]
 safe.muted=value?.muted===true;return safe
}
export const storyFilters={none:'none',warm:'sepia(.25) saturate(1.15)',mono:'grayscale(1)',vivid:'saturate(1.5) contrast(1.08)'}
export function storySelection(info,start=0,end=Math.min(60,info?.duration||0)){
 return cutPlan(info?.duration,start,end,'trim')[0]
}
export function storyAttempt({id=crypto.randomUUID(),file=null,info=null,start=0,end,options={}}){
 return {id,file,info,part:info?storySelection(info,start,end):null,options:{...options,presentation:storyPresentation(options.presentation)},generated:null,uploaded:null,published:null,publishing:false}
}
export async function publishStoryAttempt(attempt,{render,upload,publish,signal,onStatus=()=>{},onProgress=()=>{}}){
 const check=()=>{if(signal?.aborted)throw new DOMException('Edição interrompida.','AbortError')}
 check();if(attempt.published)return attempt.published
 if(attempt.file){
  if(!attempt.generated){onStatus(attempt.info?'Preparando o trecho…':'Preparando a mídia…');attempt.generated=attempt.info?await render(attempt.file,attempt.info,attempt.part,{signal,onStatus,onProgress}):{file:attempt.file}}
  check()
  if(!attempt.uploaded){onStatus('Enviando seu story…');attempt.uploaded=(await upload(attempt.generated.file)).media}
 }
 check();onStatus('Publicando seu story…');attempt.publishing=true
 attempt.published=await publish({id:attempt.id,media:attempt.uploaded,...attempt.options})
 return attempt.published
}
