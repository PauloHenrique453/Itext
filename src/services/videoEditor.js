import { clipArgs,originalCanBeUsed } from './videoCuts.js'
import { inspectShort } from './shorts.js'
function cancelled(){return new DOMException('Edição interrompida.','AbortError')}
async function loadClient(){
 if(typeof WebAssembly==='undefined'||typeof Worker==='undefined')throw new Error('Este navegador não oferece o editor de vídeo. Use uma versão atual do Edge, Chrome, Firefox ou Safari.')
 const [{FFmpeg},{default:workerURL}]=await Promise.all([import('@ffmpeg/ffmpeg'),import('@ffmpeg/ffmpeg/worker?worker&url')])
 const client=new FFmpeg(),base=new URL(`${import.meta.env.BASE_URL}vendor/ffmpeg-0.12.10/`,window.location.origin).href
 return {client,options:{classWorkerURL:new URL(workerURL,window.location.origin).href,coreURL:base+'ffmpeg-core.js',wasmURL:base+'ffmpeg-core.wasm'}}
}
export function createVideoEditor({loader=loadClient,inspect=inspectShort}={}){
 let client=null,ready=false,source=null,busy=false,currentProgress=null
 function dispose(){client?.terminate();client=null;ready=false;source=null}
 async function render(file,info,part,{signal,onStatus=()=>{},onProgress=()=>{}}={}){
  if(busy)throw new Error('Aguarde o trecho atual terminar.')
  if(signal?.aborted)throw cancelled()
  if(originalCanBeUsed(file,info,part))return {file,info}
  busy=true;const abort=()=>dispose();signal?.addEventListener('abort',abort,{once:true})
  try{
   if(!ready){onStatus('Carregando editor no aparelho…');const loaded=await loader();if(signal?.aborted){loaded.client.terminate();throw cancelled()}client=loaded.client;await client.load(loaded.options);if(signal?.aborted)throw cancelled();ready=true}
   if(source!==file){onStatus('Preparando o vídeo original…');if(source)await client.deleteFile('source');const bytes=new Uint8Array(await file.arrayBuffer());if(signal?.aborted)throw cancelled();await client.writeFile('source',bytes);source=file}
   currentProgress=event=>{if(!signal?.aborted&&Number.isFinite(event.time))onProgress(Math.min(.99,Math.max(0,event.time/1000000/part.duration)))}
   client.on('progress',currentProgress);onStatus('Gerando o trecho no aparelho…');onProgress(0)
   const code=await client.exec(clipArgs(part),-1,{signal});if(signal?.aborted)throw cancelled();if(code!==0)throw new Error('Não foi possível cortar este vídeo. Tente outro formato ou um trecho menor.')
   const bytes=await client.readFile('clip.mp4');await client.deleteFile('clip.mp4')
   if(signal?.aborted)throw cancelled()
   const name=(file.name||'video').replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}._-]/gu,'-').slice(0,75)
   const output=new File([bytes],`${name}-${part.start.toFixed(1)}-${part.end.toFixed(1)}.mp4`,{type:'video/mp4'})
   if(output.size>50000000)throw new Error('O trecho gerado ultrapassou 50 MB. Escolha uma parte menor e tente novamente.')
   const metadata=await inspect(output)
   if(signal?.aborted)throw cancelled()
   if(Math.abs(metadata.duration-part.duration)>.75)throw new Error('A duração do arquivo gerado não corresponde ao trecho escolhido.')
   onProgress(1);return {file:output,info:metadata}
  }catch(issue){dispose();if(signal?.aborted)throw cancelled();throw issue}
  finally{if(client&&currentProgress)client.off('progress',currentProgress);currentProgress=null;busy=false;signal?.removeEventListener('abort',abort)}
 }
 return {render,dispose}
}
