import { useState } from 'react'
import { Flame, Search } from 'lucide-react'
import Avatar from './Avatar.jsx'

export default function RightRail({ onSearch, posts = [], profiles = [], user, onFollow, onNotify }) {
  const [busy,setBusy] = useState('')
  const counts = new Map()
  for (const post of posts) for (const tag of new Set(post.tags || [])) counts.set(tag, (counts.get(tag) || 0) + 1)
  const tags = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5)
  async function follow(id) { if (busy) return; setBusy(id); try { await onFollow(id) } catch (error) { onNotify(error.message) } finally { setBusy('') } }
  return <aside className="right-rail">
    <label className="search-box"><Search size={19} /><input placeholder="Buscar no Itext" aria-label="Buscar no Itext" onKeyDown={(event) => { if (event.key === 'Enter' && event.currentTarget.value.trim()) onSearch(event.currentTarget.value.trim()) }} /></label>
    <section className="rail-panel trends-panel"><h2><Flame size={19} /> Assuntos nas publicações</h2>{tags.length ? <ol>{tags.map(([tag, count], index) => <li key={tag}><span>{index + 1}</span><button onClick={() => onSearch(tag)}><strong>{tag}</strong><small>{count} {count === 1 ? 'publicação' : 'publicações'} neste feed</small></button></li>)}</ol> : <p className="empty-inline">As hashtags das publicações aparecerão aqui.</p>}</section>
    {profiles.length ? <section className="rail-panel suggestions-panel"><h2>Pessoas no Itext</h2><div className="suggestions-list">{profiles.slice(0, 5).map((person) => <div className="suggestion" key={person.id}><Avatar userId={person.id} src={person.avatar} alt={person.name} size="sm" /><span><strong>{person.name}</strong><small>{person.handle}</small></span>{user.authenticated ? <button disabled={!!busy} onClick={() => follow(person.id)}>{person.followed ? 'Seguindo' : 'Seguir'}</button> : null}</div>)}</div></section> : null}
    <footer className="rail-footer">© {new Date().getFullYear()} Itext</footer>
  </aside>
}
