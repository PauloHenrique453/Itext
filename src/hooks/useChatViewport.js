import { useLayoutEffect,useRef } from 'react'
import { watchChatViewport } from '../services/chatViewport.js'
export default function useChatViewport(root,opened,scrollArea,atBottom,textarea){
 const bottom=useRef(atBottom);bottom.current=atBottom
 useLayoutEffect(()=>watchChatViewport({root,opened,scrollArea,textarea,isAtBottom:()=>bottom.current}),[root,opened,scrollArea,textarea])
}
