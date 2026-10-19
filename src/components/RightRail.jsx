import { useContext,useState } from 'react'
import { Flame, Search } from 'lucide-react'
import Avatar from './Avatar.jsx'
import {Hashtag,HashtagContext} from './Hashtags.jsx'

export default function RightRail({ onSearch, posts = [], profiles = [], user, onFollow, onNotify }) {
  const [busy,setBusy] = useState('')
  const {trends,loading,error}=useContext(HashtagContext)
  const tags=trends.slice(0,5)
  async function follow(id) { if (busy) return; setBusy(id); try { await onFollow(id) } catch (error) { onNotify(error.message) } finally { setBusy('') } }
  return <aside className="right-rail">
    <label className="search-box"><Search size={19} /><input placeholder="Buscar no Itext" aria-label="Buscar no Itext" onKeyDown={(event) => { if (event.key === 'Enter' && event.currentTarget.value.trim()) onSearch(event.currentTarget.value.trim()) }} /></label>
    <section className="rail-panel trends-panel"><h2><Flame size={19}/>Hashtags em movimento</h2><p className="hashtag-legend">Azul: hashtag · Verde: em alta nas últimas 24 horas</p>{tags.length?<ol>{tags.map((row,index)=><li key={row.tag}><span>{index+1}</span><div><Hashtag tag={row.tag}/><small>{row.uses} publicações · {row.authors} pessoas</small></div></li>)}</ol>:<p className="empty-inline">{loading?'Carregando hashtags…':error?'Não foi possível carregar as hashtags.':'As hashtags das publicações aparecerão aqui.'}</p>}</section>
    {profiles.length ? <section className="rail-panel suggestions-panel"><h2>Pessoas no Itext</h2><div className="suggestions-list">{profiles.slice(0, 5).map((person) => <div className="suggestion" key={person.id}><Avatar userId={person.id} src={person.avatar} alt={person.name} size="sm" /><span><strong>{person.name}</strong><small>{person.handle}</small></span>{user.authenticated ? <button disabled={!!busy} onClick={() => follow(person.id)}>{person.followed ? 'Seguindo' : 'Seguir'}</button> : null}</div>)}</div></section> : null}
    <footer className="rail-footer">© {new Date().getFullYear()} Itext</footer>
  </aside>
}
