import { useCallback, useEffect, useState } from 'react'
import { Code2, PanelsTopLeft, Send, UsersRound } from 'lucide-react'
import Brand from './components/Brand.jsx'
import Avatar from './components/Avatar.jsx'
import MobileNav from './components/MobileNav.jsx'
import Modal from './components/Modal.jsx'
import RightRail from './components/RightRail.jsx'
import Sidebar from './components/Sidebar.jsx'
import Toast from './components/Toast.jsx'
import CommunitiesView from './features/CommunitiesView.jsx'
import DatingView from './features/DatingView.jsx'
import ExploreView from './features/ExploreView.jsx'
import FeedView from './features/FeedView.jsx'
import Onboarding from './features/Onboarding.jsx'
import PagesView from './features/PagesView.jsx'
import ProfileView from './features/ProfileView.jsx'
import SettingsView from './features/SettingsView.jsx'
import MessagesView from './features/MessagesView.jsx'
import { independent, signInWithGoogle, signOut } from './services/auth.js'
import ShortsView from './features/ShortsView.jsx'
import { useItextBackend } from './hooks/useItextBackend.js'

const wideViews = new Set(['messages', 'shorts', 'settings', 'dating'])

function QuickCreate({ onClose, onPublish, onNavigate, onNotify }) {
  const [mode, setMode] = useState('post')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    try {
      await onPublish({ text: text.trim() })
      onNotify('Publicação salva.')
      onClose()
      onNavigate('home')
    } catch (error) {
      onNotify(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Criar no Itext" onClose={onClose}>
      <div className="quick-create-types">
        <button className={mode === 'post' ? 'is-active' : ''} onClick={() => setMode('post')}><Send size={19} /><span><strong>Publicação</strong><small>Compartilhe uma ideia</small></span></button>
        <button onClick={() => { onNavigate('home'); onClose() }}><Code2 size={19} /><span><strong>Código</strong><small>Abra o editor no feed</small></span></button>
        <button onClick={() => { onNavigate('communities'); onClose() }}><UsersRound size={19} /><span><strong>Comunidade</strong><small>Reúna pessoas</small></span></button>
        <button onClick={() => { onNavigate('pages'); onClose() }}><PanelsTopLeft size={19} /><span><strong>Página</strong><small>Publique com sua marca</small></span></button>
      </div>
      <form className="quick-create-form" onSubmit={submit}>
        <textarea autoFocus value={text} onChange={(event) => setText(event.target.value)} placeholder={mode === 'code' ? 'Descreva o experimento que quer compartilhar…' : 'O que está acontecendo?'} />
        <div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy || !text.trim()}>{busy ? 'Sincronizando…' : 'Publicar'}</button></div>
      </form>
    </Modal>
  )
}

function LoadingScreen() {
  return <div className="app-loading"><Brand /><span>Conectando ao Itext…</span></div>
}

export default function App() {
  const [activeView, setActiveView] = useState(() => new URLSearchParams(window.location.search).has('grupo') ? 'communities' : 'home')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [toast, setToast] = useState('')
  const backend = useItextBackend()

  const notify = useCallback((message) => setToast(message), [])

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!backend.error) return
    notify(backend.error)
    backend.clearError()
  }, [backend.error, backend.clearError, notify])

  useEffect(() => {
    document.documentElement.dataset.theme = backend.user?.themeColor || 'blue'
  }, [backend.user?.themeColor])

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setActiveView('explore')
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  function navigate(view) {
    setActiveView(view)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function search(query) {
    setSearchQuery(query)
    navigate('explore')
  }

  async function completeOnboarding(interests) {
    await backend.savePreferences(interests, true)
    notify('Seu feed personalizado está pronto.')
  }

  async function toggleLike(postId) {
    try { await backend.toggleLike(postId) } catch (error) { notify(error.message) }
  }

  async function addComment(postId, text) {
    try { await backend.addComment(postId, text) } catch (error) { notify(error.message); throw error }
  }

  if (backend.loading && !backend.user) return <LoadingScreen />
  if (!backend.user) return <main className="app-loading"><Brand /><p role="alert">{backend.error || 'Não foi possível conectar ao Itext.'}</p><button className="primary-button" onClick={backend.refresh}>Tentar novamente</button></main>

  let view
  switch (activeView) {
    case 'explore': view = <ExploreView key={searchQuery} initialQuery={searchQuery} onNavigate={navigate} posts={backend.posts} profiles={backend.profiles} communities={backend.communities} pages={backend.pages} user={backend.user} />; break
    case 'messages': view = <MessagesView user={backend.user} onNotify={notify} />; break
    case 'shorts': view = <ShortsView posts={backend.posts} />; break
    case 'dating': view = <DatingView user={backend.user} data={backend.dating} onLoad={backend.getDating} onSave={backend.saveDatingProfile} onSwipe={backend.swipeDatingProfile} onUploadMedia={backend.uploadMedia} onNotify={notify} />; break
    case 'communities': view = <CommunitiesView communities={backend.communities} onCreateCommunity={backend.createCommunity} onOpenGroup={backend.openGroup} onJoinGroup={backend.joinGroup} onApproveMember={backend.approveGroupMember} onNotify={notify} />; break
    case 'pages': view = <PagesView pages={backend.pages} onCreatePage={backend.createPage} onToggleFollow={backend.togglePageFollow} onNotify={notify} />; break
    case 'profile': view = <ProfileView posts={backend.ownPosts} user={backend.user} communities={backend.communities} pages={backend.pages} onNavigate={navigate} onSaveProfile={backend.saveProfile} onUploadMedia={backend.uploadMedia} onNotify={notify} />; break
    case 'settings': view = <SettingsView user={backend.user} onSave={backend.saveSettings} onSaveInterests={backend.savePreferences} onNotify={notify} />; break
    default: view = <FeedView posts={backend.posts} user={backend.user} communities={backend.communities} pages={backend.pages} feedMode={backend.feedMode} setFeedMode={backend.setFeedMode} onPublish={backend.publishPost} onUploadMedia={backend.uploadMedia} onToggleLike={toggleLike} onAddComment={addComment} onNotify={notify} onSearch={search} />
  }

  const hideRightRail = wideViews.has(activeView)

  return (
    <div className={`app-shell ${hideRightRail ? 'app-shell--wide' : ''}`}>
      <Sidebar activeView={activeView} onNavigate={navigate} onCreate={() => setShowCreate(true)} user={backend.user} />
      <header className="mobile-header"><button onClick={() => navigate('home')}><Brand /></button><div className="mobile-header__actions"><button className="mobile-profile-button" onClick={() => navigate('profile')} aria-label="Abrir meu perfil"><Avatar src={backend.user.avatar} alt="" size="xs" /></button></div></header>
      <div className="app-main">{independent && backend.user.authenticated ? <div className="signin-banner"><span>{backend.user.name}</span><button className="secondary-button" onClick={() => signOut().catch((error) => notify(error.message))}>Sair</button></div> : null}{!backend.user.authenticated ? <div className="signin-banner"><span>Entre para publicar, comentar e criar seu perfil.</span><button className="primary-button" onClick={() => signInWithGoogle().catch((error) => notify(error.message))}>Entrar com Google</button></div> : null}{view}</div>
      {hideRightRail ? null : <RightRail onSearch={search} posts={backend.posts} profiles={backend.profiles} user={backend.user} onFollow={backend.toggleProfileFollow} onNotify={notify} />}
      <MobileNav activeView={activeView} onNavigate={navigate} onCreate={() => setShowCreate(true)} />
      {showCreate ? <QuickCreate onClose={() => setShowCreate(false)} onPublish={backend.publishPost} onNavigate={navigate} onNotify={notify} /> : null}
      {backend.user.authenticated && !backend.user.onboardingComplete ? <Onboarding user={backend.user} onComplete={completeOnboarding} /> : null}
      <Toast message={toast} />
    </div>
  )
}
