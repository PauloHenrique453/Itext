export function standardMessage(sender,recipient,body,id){
 const text=body.trim()
 if(!sender||!recipient||sender===recipient||!text||text.length>4000)throw new Error('Mensagem inválida.')
 return {id,sender_id:sender,recipient_id:recipient,body:text,encryption_version:0,owner_id:null}
}
export function chatMode({loaded,enabled,keyReady,partnerReady,creatorReady,standardAccepted}){
 if(!loaded)return 'loading'
 if(!enabled||standardAccepted)return 'standard'
 return keyReady&&partnerReady&&creatorReady?'protected':'needs-setup'
}
export function messageSession(id,isOwner,cryptoSession){
 return {id,isOwner,async decrypt(rows){
  const encrypted=rows.filter(row=>row.encryption_version===1)
  const decrypted=cryptoSession&&encrypted.length?await cryptoSession.decrypt(encrypted):[]
  const byId=new Map(decrypted.map(row=>[row.id,row]))
  return rows.map(row=>{
   if(row.encryption_version===0)return {...row,plaintext:row.body,legacy:false}
   if(row.encryption_version===1)return byId.get(row.id)||{...row,plaintext:'Mensagem com proteção adicional. Para ler, recupere o acesso nas Configurações.',locked:true}
   return {...row,plaintext:'Formato de mensagem desconhecido.',invalid:true}
  })
 }}
}
