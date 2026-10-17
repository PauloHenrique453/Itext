import { ArrowUpRight, CalendarDays, Code2, Edit3, FolderKanban, Image as ImageIcon, PanelsTopLeft, Palette, Settings, UsersRound } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import ViewHeader from '../components/ViewHeader.jsx'
import Avatar from '../components/Avatar.jsx'
import Modal from '../components/Modal.jsx'

function EmptyState({ icon: Icon, title, text, action, actionLabel }) {
  return <div className="profile-empty"><span><Icon size={24} /></span><h3>{title}</h3><p>{text}</p>{action ? <button className="primary-button" onClick={action}>{actionLabel}</button> : null}</div>
}

const themeOptions = [
  { value: 'blue', label: 'Azul', color: '#1683ff' },
  { value: 'violet', label: 'Violeta', color: '#8b5cf6' },
  { value: 'rose', label: 'Rosa', color: '#f43f72' },
  { value: 'emerald', label: 'Verde', color: '#10b981' },
]

function ProfileCustomization({ user, onClose, onSave, onUploadMedia, onNotify }) {
  const [name, setName] = useState(user.name)
  const [avatar, setAvatar] = useState(user.avatar)
  const [coverUrl, setCoverUrl] = useState(user.coverUrl || '')
  const [bio, setBio] = useState(user.bio || '')
  const [themeColor, setThemeColor] = useState(user.themeColor || 'blue')
  const [uploading, setUploading] = useState('')
  const [saving, setSaving] = useState(false)
  const avatarInput = useRef(null)
  const coverInput = useRef(null)

  async function upload(event, target) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(target)
    try {
      const result = await onUploadMedia(file)
      if (target === 'avatar') setAvatar(result.media.url)
      else setCoverUrl(result.media.url)
    } catch (error) { onNotify(error.message) } finally { setUploading('') }
  }

  async function submit(event) {
    event.preventDefault(); setSaving(true)
    try { await onSave({ name, avatar, coverUrl, bio, themeColor }); onNotify('Perfil e aparência atualizados.'); onClose() } catch (error) { onNotify(error.message) } finally { setSaving(false) }
  }

  return <Modal title="Personalizar perfil" onClose={onClose}><form className="stack-form profile-customization" onSubmit={submit}><input ref={avatarInput} className="sr-only" type="file" accept="image/*" onChange={(event) => upload(event, 'avatar')} /><input ref={coverInput} className="sr-only" type="file" accept="image/*" onChange={(event) => upload(event, 'cover')} /><div className="profile-customization__media"><div className="profile-customization__cover" style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}><button type="button" className="secondary-button" disabled={uploading === 'cover'} onClick={() => coverInput.current?.click()}><ImageIcon size={15} /> {uploading === 'cover' ? 'Enviando…' : 'Alterar fundo'}</button></div><div className="profile-customization__avatar"><Avatar src={avatar} alt={user.name} size="xl" /><button type="button" className="icon-button" disabled={uploading === 'avatar'} onClick={() => avatarInput.current?.click()} aria-label="Alterar foto de perfil"><ImageIcon size={16} /></button></div></div><label>Nome<input required value={name} maxLength="80" onChange={(event) => setName(event.target.value)} /></label><label>Biografia<textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength="280" placeholder="Conte um pouco sobre você." /></label><fieldset className="theme-picker"><legend><Palette size={15} /> Cor do sistema</legend><div>{themeOptions.map((theme) => <button type="button" key={theme.value} className={themeColor === theme.value ? 'is-selected' : ''} onClick={() => setThemeColor(theme.value)}><i style={{ background: theme.color }} /><span>{theme.label}</span></button>)}</div></fieldset><p className="form-note">As fotos são enviadas para seu perfil e a cor escolhida aparece em todos os seus dispositivos.</p><div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving || Boolean(uploading)}>{saving ? 'Salvando…' : 'Salvar perfil'}</button></div></form></Modal>
}

export default function ProfileView({ posts = [], user, communities = [], pages = [], onNavigate, onSaveProfile, onUploadMedia, onNotify }) {
  const [tab, setTab] = useState('posts')
  const [showCustomization, setShowCustomization] = useState(false)
  const ownPosts = useMemo(() => posts.filter((post) => post.authorId === user.id), [posts, user.id])
  const myGroups = useMemo(() => communities.filter((group) => group.membershipStatus === 'active' || group.isOwner), [communities])
  const myPages = useMemo(() => pages.filter((page) => page.isOwner), [pages])



  const counts = { posts: ownPosts.length, groups: myGroups.length, pages: myPages.length }

  return <main className="feature-view profile-view">
    <ViewHeader title="Meu perfil" subtitle="Sua atividade, espaços e preferências em um só lugar." action={<button className="secondary-button" onClick={() => onNavigate('settings')}><Settings size={16} /> Configurações</button>} />
    <div className={`profile-cover ${user.coverUrl ? 'has-image' : ''}`} style={user.coverUrl ? { backgroundImage: `url(${user.coverUrl})` } : undefined}><div className="profile-cover__pattern" /></div>
    <section className="profile-main">
      <div className="profile-main__top"><Avatar src={user.avatar} alt={user.name} size="xl" /><button className="secondary-button" disabled={!user.authenticated} onClick={() => setShowCustomization(true)}><Edit3 size={15} /> Personalizar perfil</button></div>
      <h1>{user.name}</h1><span>{user.handle}</span>
      <p>{user.bio || 'Adicione uma biografia para se apresentar.'}</p>
      {user.createdAt ? <div className="profile-meta"><span><CalendarDays size={15} /> Membro desde {new Date(user.createdAt).toLocaleDateString('pt-BR')}</span></div> : null}
      <div className="profile-counts"><span><strong>{user.following?.length || 0}</strong> seguindo</span><span><strong>{counts.groups}</strong> grupos</span><span><strong>{counts.pages}</strong> páginas criadas</span></div>
    </section>
    <div className="profile-tabs" role="tablist"><button className={tab === 'posts' ? 'is-active' : ''} onClick={() => setTab('posts')}><FolderKanban size={15} /> Publicações <span>{counts.posts}</span></button><button className={tab === 'groups' ? 'is-active' : ''} onClick={() => setTab('groups')}><UsersRound size={15} /> Meus grupos <span>{counts.groups}</span></button><button className={tab === 'pages' ? 'is-active' : ''} onClick={() => setTab('pages')}><PanelsTopLeft size={15} /> Minhas páginas <span>{counts.pages}</span></button></div>
    <div className="profile-posts">
      {tab === 'posts' ? (ownPosts.length ? <div className="profile-activity-list">{ownPosts.map((post) => <article key={post.id}><div><strong>{post.context ? `Em ${post.context.name}` : 'No seu perfil'}</strong><small>{post.time}</small></div><p>{post.text || 'Publicação de mídia no Itext'}</p><span>{post.kind === 'game' ? <><Code2 size={14} /> Código/jogo</> : `${post.likes} curtidas · ${post.comments} comentários`}</span></article>)}</div> : <EmptyState icon={Code2} title="Sua próxima publicação começa aqui." text="Compartilhe uma ideia, mídia ou um código executável." action={() => onNavigate('home')} actionLabel="Criar publicação" />) : null}
      {tab === 'groups' ? (myGroups.length ? <div className="profile-space-list">{myGroups.map((group) => <button key={group.id} onClick={() => onNavigate('communities')}><span className="profile-space-icon" style={{ background: group.accent }}>{group.icon}</span><span><strong>{group.name}</strong><small>{group.isOwner ? 'Você é proprietário' : group.membershipRole === 'admin' ? 'Você é administrador' : 'Você participa'} · {group.memberCount || group.members} membros</small></span><ArrowUpRight size={18} /></button>)}</div> : <EmptyState icon={UsersRound} title="Você ainda não participa de grupos." text="Entre em um grupo ou crie um espaço para sua comunidade." action={() => onNavigate('communities')} actionLabel="Ver grupos" />) : null}
      {tab === 'pages' ? (myPages.length ? <div className="profile-space-list">{myPages.map((page) => <button key={page.id} onClick={() => onNavigate('pages')}><Avatar src={page.avatar} alt={page.name} /><span><strong>{page.name}</strong><small>{page.category} · {page.followers} seguidores</small></span><ArrowUpRight size={18} /></button>)}</div> : <EmptyState icon={PanelsTopLeft} title="Crie sua primeira página pública." text="Publique notícias, projetos ou conteúdos com uma voz própria." action={() => onNavigate('pages')} actionLabel="Criar página" />) : null}
    </div>
    {showCustomization ? <ProfileCustomization user={user} onClose={() => setShowCustomization(false)} onSave={onSaveProfile} onUploadMedia={onUploadMedia} onNotify={onNotify} /> : null}
  </main>
}
