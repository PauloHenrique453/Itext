import { useContext,useEffect, useState } from 'react'
import { itextApi } from '../services/itextApi.js'

import { PhotoNavigation } from '../components/ProfileNavigation.jsx'
export default function ProfilePhotos({profileId}) {
  const [data,setData]=useState({rows:[],hasMore:false,cursor:null})
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const openPhoto=useContext(PhotoNavigation)
  useEffect(()=>{let active=true;setLoading(true);void itextApi.profilePhotos(profileId).then(rows=>{if(active)setData(rows)}).catch(issue=>{if(active)setError(issue.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[profileId])
  async function more(){setLoading(true);try{const next=await itextApi.profilePhotos(profileId,data.cursor);setData(current=>({...next,rows:[...current.rows,...next.rows]}));setError('')}catch(issue){setError(issue.message)}finally{setLoading(false)}}
  return <section className="profile-photo-section"><h3>Fotos publicadas</h3>{error?<p role="alert" className="chat-error">{error}</p>:null}<div className="profile-photo-grid">{data.rows.flatMap(row=>row.media.map((item,i)=>item.url?<button key={`${row.post_id}-${i}`} onClick={()=>openPhoto?.({postId:row.post_id,index:i})} aria-label="Abrir foto publicada"><img src={item.url} alt="Foto publicada no perfil" loading="lazy"/></button>:null))}</div>{loading?<p role="status">Carregando fotos…</p>:!data.rows.length?<p className="empty-inline">Nenhuma foto publicada.</p>:null}{data.hasMore?<button className="secondary-button" disabled={loading} onClick={more}>Carregar mais fotos</button>:null}</section>
}
