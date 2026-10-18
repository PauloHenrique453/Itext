import { CheckCircle2, Plus, UsersRound } from 'lucide-react'
import { useState } from 'react'
import ViewHeader from '../components/ViewHeader.jsx'
import Avatar from '../components/Avatar.jsx'
import SpaceEditor from './SpaceEditor.jsx'

export default function PagesView({ pages = [], onCreatePage, onToggleFollow, onNotify, onUploadMedia, onSaveSpace, categories=[] }) {
  const [showCreate, setShowCreate] = useState(false)
  const [editing,setEditing]=useState(null)
  async function toggleFollow(page) {
    try { const result = await onToggleFollow(page.id); onNotify(result.followed ? `Você segue ${page.name}.` : `Você deixou de seguir ${page.name}.`) } catch (error) { onNotify(error.message) }
  }

  return <main className="feature-view">
    <ViewHeader title="Páginas" subtitle="Uma voz pública para notícias, projetos, marcas e criadores." action={<button className="primary-button" onClick={() => setShowCreate(true)}><Plus size={17} /> Criar página</button>} />
    <div className="feature-content pages-content">

      <div className="section-heading"><div><h2>Páginas para acompanhar</h2><p>Conteúdo público de pessoas e projetos que combinam com você.</p></div></div>
      <div className="pages-list">{!pages.length ? <p className="empty-inline">Ainda não há páginas. Crie a primeira.</p> : null}{pages.map((page) => <article className="page-row" key={page.id}>{page.coverUrl?<img className="page-cover-thumb" src={page.coverUrl} alt="Capa da página"/>:null}<Avatar src={page.avatar} alt={page.name} size="lg" /><div><h3>{page.name}{page.verified ? <CheckCircle2 size={16} fill="currentColor" /> : null}</h3><p>{page.category}{page.description ? ` · ${page.description}` : ''}</p><small><UsersRound size={14} /> {page.followers} seguidores</small></div>{page.isOwner ? <button className="secondary-button" onClick={()=>setEditing(page)}>Editar página</button> : <button className={page.followed ? 'secondary-button is-followed' : 'secondary-button'} onClick={() => toggleFollow(page)}>{page.followed ? 'Seguindo' : 'Seguir'}</button>}</article>)}</div>
    </div>
    {showCreate?<SpaceEditor kind="page" categories={categories} onClose={()=>setShowCreate(false)} onUploadMedia={onUploadMedia} onSave={async payload=>{await onCreatePage(payload);onNotify('Página criada.')}}/>:null}
    {editing?<SpaceEditor kind="page" space={editing} categories={categories} onClose={()=>setEditing(null)} onUploadMedia={onUploadMedia} onSave={async payload=>{await onSaveSpace('page',editing.id,payload);onNotify('Página atualizada.')}}/>:null}


  </main>
}
