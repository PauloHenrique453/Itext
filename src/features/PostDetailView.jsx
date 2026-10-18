import { useEffect,useState } from 'react'
import ViewHeader from '../components/ViewHeader.jsx'
import { itextApi } from '../services/itextApi.js'
import { PostCard } from './FeedView.jsx'
export default function PostDetailView({postId,commentId,user,onNotify,onChanged=()=>{}}){
 const [post,setPost]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 useEffect(()=>{let active=true;void itextApi.post(postId).then(row=>{if(active){setPost(row);setError('')}}).catch(issue=>{if(active){setPost(null);setError(issue.message)}});return()=>{active=false}},[postId,retry])
 async function run(action){try{await action();setRetry(value=>value+1);void onChanged()}catch(issue){onNotify(issue.message);throw issue}}
 return <main className="feature-view"><ViewHeader title="Publicação"/>{error?<p className="chat-error" role="alert">{error}</p>:post?<PostCard post={post} user={user} onNotify={onNotify} onToggleLike={()=>run(()=>itextApi.toggleLike(post.id))} onEditPost={(id,payload)=>run(()=>itextApi.editPost(id,payload))} onDeletePost={id=>run(()=>itextApi.deletePost(id))} onUploadMedia={itextApi.uploadMedia} onTag={()=>{}} onChanged={()=>setRetry(value=>value+1)} initialCommentId={commentId}/>:<p className="empty-inline">Carregando publicação…</p>}</main>
}
