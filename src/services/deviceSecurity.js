// Device-only convenience and screen lock. Google authentication and database RLS remain mandatory.
// Secrets are encrypted in IndexedDB; localStorage carries only cross-tab lock notifications.
const text=new TextEncoder(), decoder=new TextDecoder()
const iterations=600000
const marker='itext-device-v1'
function aad(userId,mode){return text.encode(`${marker}:${userId}:${mode}`)}
function valid(record,userId){
 if(!record||record.userId!==userId||record.version!==1||!['password','trusted'].includes(record.mode)||!(record.iv instanceof Uint8Array)||!(record.data instanceof ArrayBuffer))throw new Error('Não foi possível ler a proteção deste aparelho.')
}
async function passwordKey(password,salt){
 const raw=await crypto.subtle.importKey('raw',text.encode(password),'PBKDF2',false,['deriveKey'])
 return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',iterations,salt},raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])
}
async function seal(userId,mode,key,payload,salt){
 const iv=crypto.getRandomValues(new Uint8Array(12))
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(userId,mode)},key,text.encode(JSON.stringify({marker,...payload})))
 return {userId,version:1,mode,iv,data,hasRecovery:!!payload.code,...(mode==='password'?{salt}:{key})}
}
async function open(userId,record,key){
 valid(record,userId)
 try{
  const payload=JSON.parse(decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:record.iv,additionalData:aad(userId,record.mode)},key,record.data)))
  if(payload.marker!==marker||!!payload.code!==record.hasRecovery)throw new Error('Invalid payload')
  return payload
 }catch{throw new Error(record.mode==='password'?'Senha incorreta ou dados locais indisponíveis.':'Não foi possível abrir os dados salvos neste aparelho. Use seu código de recuperação.')}
}
export function createDeviceSecurity(store){
 let session=null,generation=0
 function check(token){if(token!==generation)throw new Error('A operação foi cancelada ao bloquear o aparelho. Tente novamente.')}
 async function recordFor(id){const row=await store.get(id);if(row)valid(row,id);return row}
 async function access(id,password){
  const token=generation
  const record=await recordFor(id)
  check(token)
  if(!record){session={id,key:null,payload:{},mode:null};return session}
  if(record.mode==='password'&&typeof password!=='string'){
   if(session?.id===id&&session.mode==='password')return session
   throw new Error('Desbloqueie o Itext com a senha deste aparelho.')
  }
  const key=record.mode==='password'?await passwordKey(password,record.salt):record.key
  const payload=await open(id,record,key)
  check(token)
  session={id,key,payload,mode:record.mode,salt:record.salt}
  return session
 }
 async function write(id,next){await store.set(id,next);store.changed?.(id)}
 return {
  clear(){session=null;generation+=1},
  async status(id){const record=await recordFor(id);return {passwordEnabled:record?.mode==='password',remembered:!!record?.hasRecovery,locked:record?.mode==='password'&&!(session?.id===id&&session.mode==='password')}},
  async unlock(id,password){await access(id,password)},
  async setPassword(id,password,currentPassword){
   const token=generation
   if(typeof password!=='string'||password.length>256||!(/^\d{8,}$/.test(password)||password.length>=12))throw new Error('Use um PIN de pelo menos 8 números ou uma senha de pelo menos 12 caracteres.')
   const current=await recordFor(id)
   const previous=await access(id,current?.mode==='password'?currentPassword:undefined)
   if(current?.mode==='password'&&typeof currentPassword!=='string')throw new Error('Confirme a senha atual.')
   const salt=crypto.getRandomValues(new Uint8Array(16)),key=await passwordKey(password,salt)
   const next=await seal(id,'password',key,previous.payload,salt)
   check(token);await write(id,next);check(token);session={id,key,payload:previous.payload,mode:'password',salt}
  },
  async resetPassword(id,password){
   const token=generation
   if(typeof password!=='string'||password.length>256||!(/^\d{8,}$/.test(password)||password.length>=12))throw new Error('Use um PIN de pelo menos 8 números ou uma senha de pelo menos 12 caracteres.')
   const salt=crypto.getRandomValues(new Uint8Array(16)),key=await passwordKey(password,salt)
   const next=await seal(id,'password',key,{},salt)
   check(token);await write(id,next);check(token);session={id,key,payload:{},mode:'password',salt}
  },
  async removePassword(id,password){
   const token=generation
   if(typeof password!=='string')throw new Error('Confirme a senha atual.')
   const previous=await access(id,password)
   if(previous.mode!=='password')return
   if(previous.payload.code){
    const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt'])
    const next=await seal(id,'trusted',key,previous.payload)
    check(token);await write(id,next);check(token);session={id,key,payload:previous.payload,mode:'trusted'}
   }else{await store.remove(id);store.changed?.(id);session=null}
  },
  async remember(id,code,fingerprint){
   const token=generation
   const previous=await access(id)
   const key=previous.key||await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt'])
   const mode=previous.mode||'trusted',payload={code,fingerprint}
   const next=await seal(id,mode,key,payload,previous.salt)
   check(token);await write(id,next);check(token);session={...previous,id,key,mode,payload}
  },
  async recovery(id,fingerprint){
   const state=await access(id)
   return state.payload.fingerprint===fingerprint?state.payload.code||null:null
  },
  async forget(id){
   const previous=await access(id)
   if(previous.mode==='password'){
    await write(id,await seal(id,'password',previous.key,{},previous.salt));session={...previous,payload:{}}
   }else{await store.remove(id);store.changed?.(id);session=null}
  },
 }
}
let database
function db(){
 if(!database)database=new Promise((resolve,reject)=>{
  const request=indexedDB.open('itext-device-security',1)
  request.onupgradeneeded=()=>request.result.createObjectStore('accounts',{keyPath:'userId'})
  request.onsuccess=()=>{const value=request.result;value.onversionchange=()=>{value.close();database=null};resolve(value)}
  request.onerror=()=>{database=null;reject(new Error('O armazenamento deste aparelho está indisponível. Permita o armazenamento e tente novamente.'))}
  request.onblocked=()=>reject(new Error('Feche outras abas do Itext e tente novamente.'))
 })
 return database
}
async function transaction(mode,operation){
 const database=await db()
 return new Promise((resolve,reject)=>{
  const tx=database.transaction('accounts',mode),request=operation(tx.objectStore('accounts'))
  let result
  request.onsuccess=()=>{result=request.result}
  tx.oncomplete=()=>resolve(result)
  tx.onerror=tx.onabort=()=>reject(new Error('Não foi possível salvar a proteção neste aparelho.'))
 })
}
export const deviceSecurity=createDeviceSecurity({
 get:id=>transaction('readonly',store=>store.get(id)),
 set:(_id,row)=>transaction('readwrite',store=>store.put(row)),
 remove:id=>transaction('readwrite',store=>store.delete(id)),
 changed:id=>{
  window.dispatchEvent(new CustomEvent('itext-device-changed',{detail:{id}}))
  try{localStorage.setItem('itext-device-event',JSON.stringify({id,nonce:crypto.randomUUID()}))}catch{/* Lock remains available within this tab. */}
 },
})

export function lockDeviceEverywhere(userId){
 window.dispatchEvent(new Event('itext-lock-device'))
 try{localStorage.setItem('itext-device-event',JSON.stringify({id:userId,nonce:crypto.randomUUID()}))}catch{/* This tab was still locked. */}
}
