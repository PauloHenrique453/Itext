// Only an Auth-verified email callback may create a short-lived local reset grant.
export const pinRecoveryStorageKey='itext-pin-identification'
export function validPinIdentification(pending,user,now=Date.now()){
 return !!pending&&typeof pending.requestedAt==='number'&&pending.requestedAt<=now&&now-pending.requestedAt<=15*60*1000&&pending.userId===user?.id&&typeof user?.email==='string'&&pending.email===user.email.toLowerCase()&&!!user.email_confirmed_at
}
export function emailMethodFromToken(accessToken,since){
 try{
  const part=accessToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')
  const claims=JSON.parse(atob(part))
  return Array.isArray(claims.amr)&&claims.amr.some(entry=>['otp','magiclink'].includes(entry.method)&&Number(entry.timestamp)*1000>=since-5000)
 }catch{return false}
}
export async function verifiedEmailIdentification(auth,response,pending,{emailHash=false,now=Date.now()}={}){
 const token=response?.data?.session?.access_token
 if(response?.error||!token)return false
 const {data,error}=await auth.getUser(token)
 return !error&&(emailHash||emailMethodFromToken(token,pending?.requestedAt))&&validPinIdentification(pending,data?.user,now)
}
