import { CheckCircle2, Plus, UsersRound } from 'lucide-react'
import { useState } from 'react'
import ViewHeader from '../components/ViewHeader.jsx'
import Avatar from '../components/Avatar.jsx'
import Modal from '../components/Modal.jsx'

export default function PagesView({ pages = [], onCreatePage, onToggleFollow, onNotify }) {
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Tecnologia')
  const [description, setDescription] = useState('')

  async function createPage(event) {
    event.preventDefault()
    if (!name.trim()) return
    try {
      await onCreatePage({ name: name.trim(), category, description: description.trim() })
      setShowCreate(false); setName(''); setDescription('')
      onNotify('Página pública criada. Só você poderá publicar nela.')
    } catch (error) { onNotify(error.message) }
  }
  async function toggleFollow(page) {
    try { const result = await onToggleFollow(page.id); onNotify(result.followed ? `Você segue ${page.name}.` : `Você deixou de seguir ${page.name}.`) } catch (error) { onNotify(error.message) }
  }

  return <main className="feature-view">
    <ViewHeader title="Páginas" subtitle="Uma voz pública para notícias, projetos, marcas e criadores." action={<button className="primary-button" onClick={() => setShowCreate(true)}><Plus size={17} /> Criar página</button>} />
    <div className="feature-content pages-content">

      <div className="section-heading"><div><h2>Páginas para acompanhar</h2><p>Conteúdo público de pessoas e projetos que combinam com você.</p></div></div>
      <div className="pages-list">{!pages.length ? <p className="empty-inline">Ainda não há páginas. Crie a primeira.</p> : null}{pages.map((page) => <article className="page-row" key={page.id}><Avatar src={page.avatar} alt={page.name} size="lg" /><div><h3>{page.name}{page.verified ? <CheckCircle2 size={16} fill="currentColor" /> : null}</h3><p>{page.category}{page.description ? ` · ${page.description}` : ''}</p><small><UsersRound size={14} /> {page.followers} seguidores</small></div>{page.isOwner ? <span>Sua página</span> : <button className={page.followed ? 'secondary-button is-followed' : 'secondary-button'} onClick={() => toggleFollow(page)}>{page.followed ? 'Seguindo' : 'Seguir'}</button>}</article>)}</div>
    </div>
    {showCreate ? <Modal title="Criar uma página" onClose={() => setShowCreate(false)}><form className="stack-form" onSubmit={createPage}><label>Nome da página<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Web sem mistério" /></label><label>Categoria<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Tecnologia</option><option>Notícias</option><option>Design e cultura</option><option>Educação</option><option>Entretenimento</option><option>Negócios</option></select></label><label>Descrição<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Que tipo de conteúdo sua página publica?" /></label><div className="ai-context-note"><span>✦</span><p><strong>Publicação por proprietário</strong>Todos podem seguir, curtir e comentar. Somente você poderá publicar nesta página.</p></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Cancelar</button><button className="primary-button">Criar página</button></div></form></Modal> : null}

  </main>
}
