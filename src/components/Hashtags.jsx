import {createContext,useContext,useEffect,useMemo,useState} from 'react'
import {itextApi} from '../services/itextApi.js'
import {extractHashtags,hashtagParts,normalizeTag} from '../services/hashtags.js'
export const HashtagContext=createContext({trends:[],loading:false,error:'',open:null})
export function HashtagProvider({children,onOpen,userId,revision}){
 const [state,setState]=useState({trends:[],loading:true,error:''})
 useEffect(()=>{let current=true;setState(previous=>({...previous,loading:previous.trends.length===0,error:''}));const load=()=>{if(document.hidden)return;void itextApi.hashtagTrends().then(trends=>{if(current)setState({trends,loading:false,error:''})}).catch(error=>{if(current)setState({trends:[],loading:false,error:error.message})})};load();const timer=setInterval(load,60000);document.addEventListener('visibilitychange',load);return()=>{current=false;clearInterval(timer);document.removeEventListener('visibilitychange',load)}},[userId,revision])
 const value=useMemo(()=>({...state,open:onOpen}),[state,onOpen])
 return <HashtagContext.Provider value={value}>{children}</HashtagContext.Provider>
}
export function Hashtag({tag,children,onClick,interactive=true}){
 const {trends,open}=useContext(HashtagContext),canonical=normalizeTag(tag),hot=trends.some(row=>row.tag===canonical&&row.is_trending),className=`hashtag${hot?' hashtag--trending':''}`,title=hot?'Em alta nas últimas 24 horas':'Explorar hashtag'
 const action=interactive&&(onClick||open)
 return action&&canonical?<button type="button" className={className} title={title} onClick={event=>{event.stopPropagation();action(canonical)}}>{children||tag}{hot?<span className="sr-only"> — em alta</span>:null}</button>:<span className={className} title={title}>{children||tag}</span>
}
export function HashtagText({text=''}){return hashtagParts(text).map((part,index)=>part.tag?<Hashtag key={index} tag={part.tag}>{part.text}</Hashtag>:part.text)}
export function HashtagDraft({text=''}){const tags=extractHashtags(text);return tags.length?<div className="hashtag-draft" aria-label="Hashtags da publicação"><small>Hashtags</small>{tags.map(tag=><Hashtag key={tag} tag={tag} interactive={false}/>)}</div>:null}
