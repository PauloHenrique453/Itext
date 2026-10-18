export function revealMessage(area,message){
 if(!area||!message||!area.contains(message))return
 const top=message.getBoundingClientRect().top-area.getBoundingClientRect().top+area.scrollTop
 area.scrollTo({top:Math.max(0,top-(area.clientHeight-message.offsetHeight)/2),behavior:'smooth'})
}
export function restoreChatScroll(area,anchor,atBottom){
 if(!area)return
 if(anchor)area.scrollTop=anchor.top+area.scrollHeight-anchor.height
 else if(atBottom)area.scrollTop=area.scrollHeight
}
