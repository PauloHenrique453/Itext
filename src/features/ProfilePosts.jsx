import { useEffect,useState } from 'react'
import { itextApi } from '../services/itextApi.js'
import { PostCard } from './FeedView.jsx'
export default function ProfilePosts({profileId,user,onNotify,onChanged=()=>{}}){
 const [data,setData]=useState({posts:[],hasMore:false,cursor:null}),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0)
 useEffect(()=>{let active=true;setLoading(true);void itextApi.authorFeed(profileId).then(next=>{if(active){setData(next);setError('')}}).catch(issue=>{if(active)setError(issue.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[profileId,retry])
 async function run(action){try{await action();setRetry(value=>value+1);void onChanged()}catch(issue){onNotify(issue.message);throw issue}}
 async function more(){setLoading(true);try{const next=await itextApi.authorFeed(profileId,data.cursor);setData(previous=>({...next,posts:[...previous.posts,...next.posts]}))}catch(issue){setError(issue.message)}finally{setLoading(false)}}
 return <section className="profile-post-stream">{error?<p className="chat-error" role="alert">{error}<button className="text-button" onClick={()=>setRetry(value=>value+1)}>Tentar novamente</button></p>:null}{data.posts.map(post=><PostCard key={post.id} post={post} user={user} onNotify={onNotify} onToggleLike={()=>run(()=>itextApi.toggleLike(post.id))} onEditPost={(id,payload)=>run(()=>itextApi.editPost(id,payload))} onDeletePost={id=>run(()=>itextApi.deletePost(id))} onUploadMedia={itextApi.uploadMedia} onChanged={()=>setRetry(value=>value+1)} onTag={()=>{}}/>)}{loading?<p role="status">Carregando publicações…</p>:!data.posts.length?<p className="empty-inline">Nenhuma publicação disponível para sua conta.</p>:null}{data.hasMore?<button className="secondary-button" disabled={loading} onClick={more}>Carregar mais publicações</button>:null}</section>
}
