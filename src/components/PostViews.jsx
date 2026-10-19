import {useEffect,useRef,useState} from 'react'
import {Eye} from 'lucide-react'
import {itextApi} from '../services/itextApi.js'
import {createViewRecorder} from '../services/viewRecording.js'
import useVisibleEvent from '../hooks/useVisibleEvent.js'
const record=createViewRecorder(id=>itextApi.recordPostView(id))
export function usePostViews(ref,post,user,enabled=true,hydrate=true){
 const [count,setCount]=useState(post.views??null),[error,setError]=useState(''),current=useRef(true)
 useEffect(()=>{current.current=true;setCount(post.views??null);setError('');if(hydrate&&post.views===undefined)void itextApi.postViewCounts([post.id]).then(rows=>{if(current.current)setCount(Number(rows.find(row=>row.id===post.id)?.views||0))}).catch(issue=>{if(current.current)setError(issue.message)});return()=>{current.current=false}},[post.id,post.views,hydrate])
 useEffect(()=>{const update=event=>{if(event.detail.id===post.id)setCount(event.detail.views)};window.addEventListener('itext:post-view',update);return()=>window.removeEventListener('itext:post-view',update)},[post.id])
 useVisibleEvent(ref,user.id+':'+post.id,enabled&&user.authenticated&&post.authorId!==user.id,async()=>{const views=Number(await record(user.id,post.id));if(current.current){setCount(views);setError('');window.dispatchEvent(new CustomEvent('itext:post-view',{detail:{id:post.id,views}}))}})
 return {count,error}
}
export default function PostViews({value}){return <span className="post-view-count" title={value.error?'Contagem indisponível':'Contas que visualizaram esta publicação'} aria-label={value.count===null?'Carregando visualizações':`${value.count} visualizações`}><Eye size={17}/><span>{value.count===null?'—':value.count.toLocaleString('pt-BR')}</span></span>}
