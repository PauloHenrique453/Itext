import { ArrowUpRight, Check, Copy, Lock, Plus, Search, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import ViewHeader from '../components/ViewHeader.jsx'
import Modal from '../components/Modal.jsx'
import Avatar from '../components/Avatar.jsx'

const visibilityLabel = { public: 'Público', private: 'Privado', unlisted: 'Não listado' }

export default function CommunitiesView({ communities = [], onCreateCommunity, onOpenGroup, onJoinGroup, onApproveMember, onNotify }) {
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [opened, setOpened] = useState(null)
  const [inviteCode, setInviteCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [joinPolicy, setJoinPolicy] = useState('request')
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => communities.filter((group) => `${group.name} ${group.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [communities, query])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const groupId = params.get('grupo')
    const invite = params.get('convite')
    if (groupId && invite) openGroup(groupId, invite)
  }, [])

  async function openGroup(groupId, invite = '') {
    setBusy(true)
    try {
      const detail = await onOpenGroup(groupId, invite)
      setOpened(detail)
      setInviteCode(invite)
    } catch (error) { onNotify(error.message) } finally { setBusy(false) }
  }

  async function join() {
    if (!opened) return
    setBusy(true)
    try {
      const result = await onJoinGroup(opened.group.id, inviteCode)
      onNotify(result.message || (result.status === 'pending' ? 'Solicitação enviada.' : 'Agora você participa do grupo.'))
      setOpened(await onOpenGroup(opened.group.id, inviteCode))
    } catch (error) { onNotify(error.message) } finally { setBusy(false) }
  }

  async function approve(memberId) {
    if (!opened) return
    try {
      await onApproveMember(opened.group.id, memberId)
      setOpened(await onOpenGroup(opened.group.id, inviteCode))
      onNotify('Pedido aprovado.')
    } catch (error) { onNotify(error.message) }
  }

  async function createCommunity(event) {
    event.preventDefault()
    if (!name.trim()) return
    try {
      const result = await onCreateCommunity({ name: name.trim(), description: description.trim(), visibility, joinPolicy })
      setShowCreate(false); setName(''); setDescription(''); setVisibility('public'); setJoinPolicy('request')
      onNotify(result.community.visibility === 'unlisted' ? 'Grupo não listado criado. Copie o link de convite na área do grupo.' : 'Grupo criado e sincronizado.')
    } catch (error) { onNotify(error.message) }
  }

  async function copyInvite() {
    if (!opened?.group.shareCode) return
    const url = `${window.location.origin}${window.location.pathname}?grupo=${encodeURIComponent(opened.group.id)}&convite=${encodeURIComponent(opened.group.shareCode)}`
    try { await navigator.clipboard.writeText(url); onNotify('Link de convite copiado.') } catch { onNotify(`Compartilhe este link: ${url}`) }
  }

  return <main className="feature-view">
    <ViewHeader title="Grupos" subtitle="Espaços para conversar, criar e se reunir com as pessoas certas." action={<button className="primary-button" onClick={() => setShowCreate(true)}><Plus size={17} /> Criar grupo</button>} />
    <div className="feature-content communities-content">
      <section className="community-hero"><div><span><UsersRound size={24} /></span><h2>Encontre o seu lugar.</h2><p>Grupos públicos, privados ou não listados — cada um com suas próprias regras de entrada.</p></div><label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar grupos" /></label></section>
      <div className="section-heading"><div><h2>Grupos para você</h2><p>Baseados nos seus interesses e no que você acompanha.</p></div></div>
      <div className="community-list">{filtered.map((community) => {
        const status = community.membershipStatus
        const joined = status === 'active'
        return <article className="community-row" key={community.id}><span className="community-row__icon" style={{ background: community.accent }}>{community.icon}</span><div><h3>{community.name} <small className="privacy-badge">{visibilityLabel[community.visibility] || 'Público'}</small></h3><p>{community.description}</p><small>{community.memberCount ?? community.members} membros{status === 'pending' ? ' · pedido enviado' : ''}</small></div>{joined ? <button className="secondary-button is-joined" onClick={() => openGroup(community.id)}><Check size={15} /> Participando</button> : <button className="secondary-button" disabled={community.visibility === 'private'} onClick={() => openGroup(community.id)}>{community.visibility === 'private' ? <Lock size={15} /> : <Plus size={15} />}{community.visibility === 'private' ? 'Privado' : status === 'pending' ? 'Pendente' : 'Ver grupo'}</button>}<button className="icon-button" onClick={() => openGroup(community.id)} aria-label={`Abrir ${community.name}`}><ArrowUpRight size={19} /></button></article>
      })}</div>
      {!filtered.length ? <p className="empty-inline">Nenhum grupo encontrado.</p> : null}
    </div>
    {showCreate ? <Modal title="Novo grupo" onClose={() => setShowCreate(false)}><form className="stack-form" onSubmit={createCommunity}><label>Nome<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Devs do Nordeste" /></label><label>Descrição<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="O que conecta as pessoas aqui?" /></label><label>Privacidade<select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="public">Público — aparece na busca</option><option value="private">Privado — somente o dono participa</option><option value="unlisted">Não listado — entrada apenas pelo link</option></select></label>{visibility === 'public' ? <label>Entrada<select value={joinPolicy} onChange={(event) => setJoinPolicy(event.target.value)}><option value="request">Pedir aprovação do dono/admin</option><option value="open">Entrar imediatamente</option></select></label> : null}<p className="form-note">Membros ativos podem publicar texto, foto, áudio, vídeo, código e jogos HTML dentro do grupo.</p><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowCreate(false)}>Cancelar</button><button className="primary-button">Criar grupo</button></div></form></Modal> : null}
    {opened ? <Modal title={opened.group.name} onClose={() => setOpened(null)} size="lg"><div className="group-detail"><div className="group-detail__hero"><span className="community-row__icon" style={{ background: opened.group.accent }}>{opened.group.icon}</span><div><div className="group-detail__title"><h2>{opened.group.name}</h2><span className="privacy-badge">{visibilityLabel[opened.group.visibility]}</span></div><p>{opened.group.description}</p><small>{opened.group.membershipStatus === 'active' ? 'Você participa deste grupo.' : opened.group.membershipStatus === 'pending' ? 'Seu pedido está aguardando aprovação.' : opened.group.visibility === 'unlisted' ? 'Você recebeu um convite para este grupo.' : 'Participe para publicar.'}</small></div></div>{opened.group.membershipStatus === 'none' && opened.group.visibility !== 'private' ? <button className="primary-button group-join-button" disabled={busy} onClick={join}>{opened.group.join_policy === 'request' && opened.group.visibility === 'public' ? 'Solicitar entrada' : 'Entrar no grupo'}</button> : null}{opened.group.isOwner && opened.group.shareCode ? <button className="secondary-button group-share-button" onClick={copyInvite}><Copy size={15} /> Copiar link de convite</button> : null}<section className="group-detail-section"><div className="section-heading"><div><h2>Membros</h2><p>{opened.members.length} pessoas visíveis neste grupo.</p></div></div><div className="group-members">{opened.members.map((member) => <div className="person-result" key={member.handle}><Avatar src={member.avatar} alt={member.name} /><span><strong>{member.name}</strong><small>{member.handle} · {member.role}</small></span></div>)}</div></section>{opened.group.canManage && opened.pending.length ? <section className="group-detail-section"><div className="section-heading"><div><h2>Pedidos de entrada</h2><p>Aprove quem quer participar.</p></div></div>{opened.pending.map((member) => <div className="pending-request" key={member.userId}><span><strong>{member.name}</strong><small>{member.handle}</small></span><button className="secondary-button" onClick={() => approve(member.userId)}>Aprovar</button></div>)}</section> : null}<section className="group-detail-section"><div className="section-heading"><div><h2>Publicações do grupo</h2><p>Visíveis apenas para membros quando o grupo não é público.</p></div></div>{opened.posts.length ? <div className="group-post-snippets">{opened.posts.map((post) => <article key={post.id}><strong>{post.author}</strong><p>{post.text}</p></article>)}</div> : <p className="empty-inline">Ainda não há publicações. Entre no grupo e seja a primeira pessoa a compartilhar.</p>}</section></div></Modal> : null}
  </main>
}
