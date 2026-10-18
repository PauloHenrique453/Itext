const fileExtensions=new Set(['pdf','txt','csv','json','zip','doc','docx','xls','xlsx','ppt','pptx','odt','ods','odp','rtf'])
export const attachmentAccept='image/*,video/*,audio/*,.pdf,.txt,.csv,.json,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf'
export function attachmentInfo(file) {
 const kind=file.type?.split('/')[0]
 const type=['image','video','audio'].includes(kind)?kind:'file'
 if(type==='file'&&!fileExtensions.has(file.name?.split('.').pop()?.toLowerCase()))throw new Error('Escolha uma mídia, PDF, documento, planilha, apresentação, texto ou ZIP.')
 const limit={image:8000000,video:50000000,audio:18000000,file:15000000}[type]
 if(file.size>limit)throw new Error(`O limite deste arquivo é ${Math.floor(limit/1000000)} MB.${type==='video'?' Para vídeos maiores, use Cortar vídeo no Início ou o editor do Ishort, ou publique um link do YouTube, TikTok ou Instagram.':''}`)
 return {type,limit}
}
export function safeLink(value) {
 try {const url=new URL(value.trim());return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null}catch{return null}
}
export function extractLinks(text='') {return [...new Set((text.match(/https?:\/\/[^\s<>]+/gi)||[]).map(value=>safeLink(value.replace(/[.,;!?)]+$/,''))).filter(Boolean))].slice(0,6)}
export function threadComments(rows) {
 const byId=new Map(rows.map(row=>[row.id,{...row,children:[]}]))
 const roots=[]
 for(const row of byId.values()){const parent=byId.get(row.parent_id);if(parent&&parent!==row)parent.children.push(row);else roots.push(row)}
 const output=[],visited=new Set(),stack=roots.slice().reverse().map(row=>({row,depth:0}))
 while(stack.length){const {row,depth}=stack.pop();if(visited.has(row.id))continue;visited.add(row.id);output.push({...row,depth});for(const child of row.children.slice().reverse())stack.push({row:child,depth:depth+1})}
 for(const row of byId.values())if(!visited.has(row.id))output.push({...row,depth:0})
 return output
}

const storyIdPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function storyIdFromSearch(search=''){const id=new URLSearchParams(search).get('story');return storyIdPattern.test(id||'')?id:null}
export function storyAddress(id,address){
 if(!storyIdPattern.test(id||''))throw new Error('Story inválido.')
 const url=new URL(address)
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Endereço do Itext inválido.')
 url.search='';url.hash='';url.searchParams.set('story',id)
 return url.href
}
