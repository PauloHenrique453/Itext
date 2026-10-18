import { useEffect, useRef, useState } from 'react'
import { Check, MessageCircle, RefreshCw, Search, UserPlus, UsersRound } from 'lucide-react'
import ViewHeader from '../components/ViewHeader.jsx'
import Avatar from '../components/Avatar.jsx'
import Modal from '../components/Modal.jsx'
import LikedPosts from './LikedPosts.jsx'
import { itextApi } from '../services/itextApi.js'

export default function PeopleView({ user, onFollow, onMessage, onNotify, initialQuery='', initialFilter='all' }) {
  const [query,setQuery]=useState(initialQuery)
  const [people,setPeople]=useState([])
  const [hasMore,setHasMore]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState('')
  const [selected,setSelected]=useState(null)
  const [filter,setFilter]=useState(initialFilter)
  const [retry,setRetry]=useState(0)
  const [cursor,setCursor]=useState(null)
  const context=useRef('')
  context.current=JSON.stringify([query,filter])
  useEffect(()=>{
    let active=true
    setLoading(true);setError('');setPeople([])
    const timer=setTimeout(()=>{void itextApi.people({query,relation:filter}).then((data)=>{if(active){setPeople(data.people);setHasMore(data.hasMore);setCursor(data.cursor)}}).catch((issue)=>{if(active)setError(issue.message)}).finally(()=>{if(active)setLoading(false)})},200)
    return()=>{active=false;clearTimeout(timer)}
  },[query,filter,retry,user.id])
  async function more(){
    if(loading||!hasMore)return
    setLoading(true)
    const current=context.current
    try{const data=await itextApi.people({query,after:cursor,relation:filter});if(context.current===current){setPeople((rows)=>[...rows,...data.people]);setHasMore(data.hasMore);setCursor(data.cursor)}}catch(issue){if(context.current===current)setError(issue.message)}finally{if(context.current===current)setLoading(false)}
  }
  async function follow(person){
    if(busy)return
    setBusy(person.id)
    try{
      const followed=await onFollow(person.id)
      const next={...person,followed,followersCount:Math.max(0,person.followersCount+(followed?1:-1))}
      setPeople((rows)=>rows.map((entry)=>entry.id===person.id?next:entry));if(selected?.id===person.id)setSelected(next)
    }catch(issue){onNotify(issue.message)}finally{setBusy('')}
  }
  const visible=people.filter((person)=>filter==='following'?person.followed:filter==='followers'?person.followsYou:true)
  function actions(person){return <div className="person-actions"><button className="secondary-button" disabled={!!busy} onClick={()=>follow(person)} aria-label={person.followed?`Deixar de seguir ${person.name}`:`Seguir ${person.name}`}>{person.followed?<Check size={17}/>:<UserPlus size={17}/>}<span>{person.followed?'Seguindo':'Seguir'}</span></button><button className="icon-button" onClick={()=>onMessage(person)} aria-label={`Conversar com ${person.name}`}><MessageCircle size={19}/></button></div>}
  return <main className="feature-view"><ViewHeader title="Pessoas" subtitle="Encontre pessoas, siga perfis e comece uma conversa." action={<button className="secondary-button" disabled={loading} onClick={()=>setRetry((value)=>value+1)}><RefreshCw size={17}/>Atualizar lista</button>}/><div className="feature-content people-content"><label className="explore-search"><Search size={20}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Buscar pessoas pelo nome" aria-label="Buscar pessoas" maxLength={80}/></label><div className="people-tabs" role="group" aria-label="Filtrar pessoas">{[['all','Descobrir'],['following','Seguindo'],['followers','Seguem você']].map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div>{error?<p role="alert" className="chat-error">{error}<button className="text-button" onClick={()=>setRetry((value)=>value+1)}>Tentar novamente</button></p>:null}<div className="people-list">{visible.map((person)=><article className="people-card" key={person.id}><button className="people-identity" onClick={()=>setSelected(person)}><Avatar src={person.avatar} alt=""/><span><strong>{person.name}</strong><small>{person.followersCount} seguidores{person.followsYou?' · Segue você':''}</small>{person.bio?<p>{person.bio}</p>:null}</span></button>{actions(person)}</article>)}</div>{loading?<p role="status">Carregando pessoas…</p>:!visible.length?<div className="profile-empty"><UsersRound size={30}/><h2>Nenhuma pessoa nesta lista.</h2><p>Os perfis de pessoas cadastradas aparecerão aqui.</p></div>:null}{hasMore?<button className="secondary-button" disabled={loading} onClick={more}>Carregar mais pessoas</button>:null}</div>{selected?<Modal title="Perfil" onClose={()=>setSelected(null)}><div className="public-profile">{selected.coverUrl?<img className="public-profile-cover" src={selected.coverUrl} alt=""/>:null}<Avatar src={selected.avatar} alt={selected.name} size="xl"/><h2>{selected.name}</h2><p>{selected.bio||'Esta pessoa ainda não adicionou uma biografia.'}</p><p>{selected.followersCount} seguidores · {selected.followingCount} seguindo</p>{actions(selected)}<h3 className="liked-heading">Curtidas</h3><LikedPosts key={selected.id} profileId={selected.id}/></div></Modal>:null}</main>
}
