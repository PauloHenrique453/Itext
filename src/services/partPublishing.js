import { validateShort } from './shorts.js'
function stopped(){return new DOMException('Edição interrompida.','AbortError')}
export function createPartJob(file,info,text,parts){
 const id=crypto.randomUUID(),total=parts.length
 return {id,file,info,text:text.trim(),parts:parts.map((part,index)=>({...part,id:crypto.randomUUID(),number:part.number||index+1,total:part.total||total,status:'pending',generated:null,uploaded:null,postId:null}))}
}
export async function runPartJob(job,{render,upload,publish,signal,onUpdate=()=>{}}){
 const check=()=>{if(signal?.aborted)throw stopped()}
 // Newest-first feeds show part 1 first when the last part is published first.
 for(const part of [...job.parts].reverse()){
  if(part.postId)continue
  check()
  try{
   if(!part.uploaded){
    if(!part.generated){part.status='cutting';onUpdate(part);part.generated=await render(job.file,job.info,part);validateShort(part.generated.file,part.generated.info);part.size=part.generated.file.size}
    check();part.status='uploading';onUpdate(part)
    const saved=await upload(part.generated.file)
    part.uploaded={...saved.media,...part.generated.info,short:true,seriesId:job.id,partNumber:part.number,partsTotal:part.total};part.generated=null
   }
   check();part.status='publishing';onUpdate(part)
   const suffix=part.total>1?`\nParte ${part.number} de ${part.total}`:''
   const saved=await publish({id:part.id,text:job.text.slice(0,10000-suffix.length)+suffix,media:part.uploaded})
   part.postId=saved.id;part.status='published';onUpdate(part)
  }catch(issue){part.status=signal?.aborted?'stopped':'error';onUpdate(part);throw issue}
 }
 return job.parts.filter(part=>part.postId).map(part=>part.postId)
}

// Feed attachments are prepared in source order. No post is created until the author publishes.
export async function preparePartAttachments(job,{render,upload,signal,onUpdate=()=>{}}){
 const check=()=>{if(signal?.aborted)throw stopped()}
 for(const part of job.parts){
  check()
  if(part.uploaded){part.status='prepared';onUpdate(part);continue}
  try{
   if(!part.generated){part.status='cutting';onUpdate(part);part.generated=await render(job.file,job.info,part);validateShort(part.generated.file,part.generated.info);part.size=part.generated.file.size}
   check();part.status='uploading';onUpdate(part)
   const saved=await upload(part.generated.file)
   part.uploaded={...saved.media,...part.generated.info,short:false,seriesId:job.id,partNumber:part.number,partsTotal:part.total};part.generated=null
   check();part.status='prepared';onUpdate(part)
  }catch(issue){part.status=signal?.aborted?'stopped':'error';onUpdate(part);throw issue}
 }
 return job.parts.map(part=>part.uploaded)
}
