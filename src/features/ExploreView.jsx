import { ArrowUpRight, Code2, Hash, Search, Sparkles, UsersRound } from 'lucide-react'
import { useContext,useMemo, useState } from 'react'
import ViewHeader from '../components/ViewHeader.jsx'
import Avatar from '../components/Avatar.jsx'
import {Hashtag,HashtagContext} from '../components/Hashtags.jsx'
import {normalizeTag} from '../services/hashtags.js'

const topics = [
  { icon: Code2, name: 'Programação', query: 'programação', description: 'React, CSS, APIs e carreira', color: '#1683ff' },
  { icon: Sparkles, name: 'Design', query: 'design', description: 'Produto, marca e experiência', color: '#ff5c7a' },
  { icon: UsersRound, name: 'Comunidades', query: 'comunidades', description: 'Encontre gente que soma', color: '#9b7cff' },
  { icon: Hash, name: 'Notícias', query: 'notícias', description: 'Atualizações públicas e recentes', color: '#2dd4bf' },
]

const includes = (value, query) => String(value || '').toLocaleLowerCase().includes(query)

export default function ExploreView({ initialQuery = '', onNavigate, posts = [], profiles = [], communities = [], pages = [], user, onFindPeople }) {
  const [query, setQuery] = useState(initialQuery)
  const normalized = query.trim().toLocaleLowerCase()
  const results = useMemo(() => {
    const matchingPeople = profiles.filter((person) => !normalized || includes(`${person.name} ${person.handle} ${person.bio} ${(person.interests || []).join(' ')}`, normalized))
    const matchingPosts = posts.filter((post) => !normalized || includes(`${post.text} ${(post.tags || []).join(' ')} ${(post.categories || []).join(' ')} ${post.context?.name || ''}`, normalized))
    const matchingGroups = communities.filter((group) => !normalized || includes(`${group.name} ${group.description}`, normalized))
    const matchingPages = pages.filter((page) => !normalized || includes(`${page.name} ${page.category} ${page.description}`, normalized))
    return { matchingPeople, matchingPosts, matchingGroups, matchingPages }
  }, [normalized, posts, profiles, communities, pages])

  const news = pages.filter((page) => includes(page.category, 'notícia')).slice(0, 4)
  const headlinePosts = posts.filter((post) => post.context?.type === 'page' || (post.categories || []).some((category) => user?.interests?.includes(category))).slice(0, 4)
  const {trends:ranked,open:openTag}=useContext(HashtagContext)
  const trends=ranked.slice(0,6)

  return <main className="feature-view">
    <ViewHeader title="Explorar" subtitle="Perfis, grupos e publicações separados pelo que combina com você." action={<button className="secondary-button" onClick={onFindPeople}><UsersRound size={17}/>Encontrar pessoas</button>} />
    <div className="feature-content explore-content">
      <label className="explore-search"><Search size={21} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&query.startsWith('#')&&normalizeTag(query))openTag?.(normalizeTag(query))}} placeholder="Busque pessoas, assuntos, páginas e grupos" /></label>
      {normalized.startsWith('#')&&normalizeTag(normalized)?<button className="secondary-button" onClick={()=>openTag?.(normalizeTag(normalized))}>Explorar {normalizeTag(normalized)} em todas as publicações</button>:null}
      {normalized ? <div className="explore-results">
        <section className="search-results"><div className="section-heading"><div><h2>Perfis</h2><p>Ordenados por interesses em comum.</p></div></div>{results.matchingPeople.length ? results.matchingPeople.map((person) => <div className="person-result" key={person.id}><Avatar userId={person.id} src={person.avatar} alt={person.name} /><span><strong>{person.name}</strong><small>{person.handle}{person.score ? ` · ${person.score} interesses em comum` : ''}</small></span></div>) : <p className="empty-inline">Nenhum perfil encontrado.</p>}</section>
        <section className="search-results"><div className="section-heading"><div><h2>Publicações</h2><p>Conteúdos que correspondem à busca.</p></div></div>{results.matchingPosts.length ? results.matchingPosts.map((post) => <button className="explore-post-result" key={post.id} onClick={() => onNavigate('home')}><Avatar userId={post.authorId} src={post.avatar} alt={post.author} /><span><strong>{post.author}</strong><p>{post.text || 'Mídia publicada no Itext'}</p><small>{post.reason}</small></span><ArrowUpRight size={17} /></button>) : <p className="empty-inline">Nenhuma publicação encontrada.</p>}</section>
        <section className="search-results"><div className="section-heading"><div><h2>Páginas e grupos</h2><p>Espaços que podem interessar você.</p></div></div>{[...results.matchingPages.map((page) => ({ ...page, type: 'Página' })), ...results.matchingGroups.map((group) => ({ ...group, type: 'Grupo' }))].map((item) => <button className="search-topic-result" key={`${item.type}-${item.id}`} onClick={() => onNavigate(item.type === 'Página' ? 'pages' : 'communities')}><span>{item.type === 'Página' ? <Sparkles size={21} /> : <UsersRound size={21} />}</span><div><strong>{item.name}</strong><small>{item.type} · {item.category || item.description}</small></div><ArrowUpRight size={19} /></button>)}</section>
      </div> : <>
        <section><div className="section-heading"><div><h2>Seu mapa de interesses</h2><p>A ordem usa escolhas iniciais, páginas seguidas e interações com publicações.</p></div></div><div className="topic-list">{topics.map(({ icon: Icon, name, query: topicQuery, description, color }) => <button key={name} className="topic-row" style={{ '--topic-color': color }} onClick={() => setQuery(topicQuery)}><span><Icon size={22} /></span><div><strong>{name}</strong><small>{description}</small></div><ArrowUpRight size={19} /></button>)}</div></section>
        <section><div className="section-heading"><div><h2>Publicações recomendadas</h2><p>O algoritmo combina interesse, afinidade, conexões e recência.</p></div></div><div className="explore-post-grid">{headlinePosts.map((post) => <button className="explore-post-result" key={post.id} onClick={() => onNavigate('home')}><Avatar userId={post.authorId} src={post.avatar} alt={post.author} /><span><strong>{post.author}</strong><p>{post.text || 'Mídia publicada no Itext'}</p><small>{post.reason}</small></span><ArrowUpRight size={17} /></button>)}</div></section>

        {news.length ? <section><div className="section-heading"><div><h2>Notícias e páginas públicas</h2><p>Atualizações de páginas que você pode seguir.</p></div></div><div className="page-mini-list">{news.map((page) => <button className="search-topic-result" key={page.id} onClick={() => onNavigate('pages')}><span><Sparkles size={21} /></span><div><strong>{page.name}</strong><small>{page.description || page.category}</small></div><ArrowUpRight size={19} /></button>)}</div></section> : null}
        {trends.length ? <section><div className="section-heading"><div><h2>Assuntos nas publicações</h2><p>Hashtags em conversas recentes.</p></div></div><div className="trend-strip">{trends.map((row, index) => <button key={row.tag} onClick={() => openTag?.(row.tag)}><span>0{index + 1}</span><strong className={row.is_trending?'hashtag hashtag--trending':'hashtag'}>{row.tag}</strong><small>{row.uses} publicações em 24 horas</small></button>)}</div></section> : null}
      </>}
    </div>
  </main>
}
