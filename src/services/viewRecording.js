// Coalesce concurrent observations. Later observations fetch the current server count;
// the database's unique key prevents an account from adding a second view.
export function createViewRecorder(send){
 const attempts=new Map()
 return(userId,postId)=>{
  const key=userId+':'+postId
  if(!attempts.has(key)){
   const promise=Promise.resolve().then(()=>send(postId)).finally(()=>{if(attempts.get(key)===promise)attempts.delete(key)})
   attempts.set(key,promise)
  }
  return attempts.get(key)
 }
}
