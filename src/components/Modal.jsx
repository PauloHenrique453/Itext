import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

const dialogs=[]
export default function Modal({title,children,onClose,size='md'}) {
  const root=useRef(null)
  const close=useRef(onClose)
  close.current=onClose
  useEffect(()=>{
    const dialog=root.current
    const previous=document.activeElement
    dialogs.push(dialog)
    document.body.classList.add('has-modal')
    const focusable=()=>[...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]')].filter(element=>element.getClientRects().length)
    focusable()[0]?.focus()
    function handleKey(event){
      if(dialogs.at(-1)!==dialog)return
      if(event.key==='Escape'){event.stopPropagation();close.current()}
      if(event.key==='Tab'){
        const elements=focusable(),first=elements[0],last=elements.at(-1)
        if(!first){event.preventDefault();dialog.focus()}
        else if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus()}
        else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus()}
      }
    }
    document.addEventListener('keydown',handleKey)
    return()=>{
      document.removeEventListener('keydown',handleKey)
      const index=dialogs.indexOf(dialog);if(index>=0)dialogs.splice(index,1)
      if(!dialogs.length)document.body.classList.remove('has-modal')
      if(previous?.isConnected)previous.focus()
    }
  },[])
  return <div className="modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&dialogs.at(-1)===root.current)onClose()}}><section ref={root} className={`modal modal--${size}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}><header><h2>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20}/></button></header>{children}</section></div>
}
