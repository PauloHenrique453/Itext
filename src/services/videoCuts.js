export const MAX_SOURCE_BYTES=200000000
export const MAX_PARTS=100
export function validateSource(file,info){
 if(!file?.type?.startsWith('video/'))throw new Error('Escolha um arquivo de vídeo.')
 if(!Number.isFinite(file.size)||file.size<=0||file.size>MAX_SOURCE_BYTES)throw new Error('Para editar neste aparelho, escolha um vídeo de até 200 MB.')
 if(!Number.isFinite(info?.duration)||info.duration<=0||!Number.isFinite(info.width)||info.width<=0||!Number.isFinite(info.height)||info.height<=0)throw new Error('Não foi possível ler este vídeo. Tente MP4 com H.264/AAC.')
 return {duration:info.duration,width:info.width,height:info.height}
}
export function cutPlan(duration,start,end,mode='trim',seconds=600){
 if(![duration,start,end,seconds].every(Number.isFinite)||duration<=0||start<0||end>duration+.00001||end<=start)throw new Error('Escolha um início e fim válidos.')
 if(!['trim','parts'].includes(mode))throw new Error('Escolha trecho ou divisão em partes.')
 if(seconds<=0||seconds>600)throw new Error('Cada parte pode ter até 10 minutos.')
 if(mode==='trim'&&end-start>600+.00001)throw new Error('O trecho tem mais de 10 minutos. Reduza a seleção ou escolha Dividir em partes.')
 const length=mode==='trim'?end-start:seconds,parts=[]
 for(let position=start;position<end-.00001;){const stop=Math.min(end,position+length);parts.push({key:`${position.toFixed(3)}-${stop.toFixed(3)}`,start:position,end:stop,duration:stop-position});position=stop;if(parts.length>MAX_PARTS)throw new Error('Selecione até 100 partes por vez ou aumente a duração de cada parte.')}
 return parts
}
export function clipArgs(part,input='source',output='clip.mp4'){
 if(!Number.isFinite(part.start)||part.start<0||!Number.isFinite(part.duration)||part.duration<=0||part.duration>600+.00001)throw new Error('Trecho inválido.')
 const bitrate=Math.max(180000,Math.min(2500000,Math.floor(45000000*8/part.duration)-96000))
 return ['-ss',part.start.toFixed(3),'-i',input,'-t',part.duration.toFixed(3),'-map','0:v:0','-map','0:a:0?','-vf',"scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",'-c:v','libx264','-preset','ultrafast','-b:v',String(bitrate),'-maxrate',String(bitrate),'-bufsize',String(bitrate*2),'-pix_fmt','yuv420p','-r','30','-fps_mode','cfr','-c:a','aac','-b:a','96000','-ar','48000','-map_metadata','-1','-movflags','+faststart',output]
}
export function originalCanBeUsed(file,info,part){return file.size<=50000000&&info.duration<=600&&part.start===0&&Math.abs(part.end-info.duration)<.00001}
