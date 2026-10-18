import { useCallback, useEffect, useState } from 'react'
import { Bell, Code2, Menu, MessageCircle, PanelsTopLeft, Send, UserPlus, UsersRound } from 'lucide-react'
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
import FeedView,{ Composer } from './features/FeedView.jsx'
import PublicProfileView from './features/PublicProfileView.jsx'
import PostDetailView from './features/PostDetailView.jsx'
import NotificationsView from './features/NotificationsView.jsx'
import PhotoViewer from './features/PhotoViewer.jsx'
import { appearance } from './services/mediaFormats.js'
import { PhotoNavigation,ProfileNavigation } from './components/ProfileNavigation.jsx'
import { usePresence,useNotificationCount } from './hooks/useActivity.js'
import Onboarding from './features/Onboarding.jsx'
import PagesView from './features/PagesView.jsx'
import ProfileView from './features/ProfileView.jsx'
import SettingsView from './features/SettingsView.jsx'
import PeopleView from './features/PeopleView.jsx'
import useUnreadCount from './hooks/useUnreadCount.js'
import { navItems } from './components/Sidebar.jsx'
import MessagesView from './features/MessagesView.jsx'
import { independent, signOut } from './services/auth.js'
import ShortsView from './features/ShortsView.jsx'
import { useItextBackend } from './hooks/useItextBackend.js'

const wideViews = new Set(['messages', 'shorts', 'settings', 'dating'])

function QuickCreate({onClose,onPublish,onNavigate,onNotify,user,communities,pages,onUploadMedia}) {
 const [busy,setBusy]=useState(false)
 async function publish(payload){setBusy(true);try{await onPublish(payload);onNotify('Publicação salva.');onClose();onNavigate('home')}catch(issue){onNotify(issue.message);throw issue}finally{setBusy(false)}}
 return <Modal title="Criar publicação" onClose={()=>{if(!busy)onClose()}} size="lg"><Composer user={user} communities={communities} pages={pages} onUploadMedia={onUploadMedia} onPublish={publish} isPublishing={busy}/></Modal>
}

function LoadingScreen() {
  return <div className="app-loading"><Brand /><span>Conectando ao Itext…</span></div>
}

export default function SocialApp() {
  const [activeView, setActiveView] = useState(() => new URLSearchParams(window.location.search).has('ishort')?'shorts':new URLSearchParams(window.location.search).has('perfil')?'member-profile':new URLSearchParams(window.location.search).has('post')?'post':new URLSearchParams(window.location.search).has('grupo') ? 'communities' : 'home')
  const [profileTarget,setProfileTarget]=useState(()=>new URLSearchParams(window.location.search).get('perfil'))
  const [postTarget,setPostTarget]=useState(()=>({id:new URLSearchParams(window.location.search).get('post'),commentId:null}))
  const [photoTarget,setPhotoTarget]=useState(()=>{const p=new URLSearchParams(window.location.search);return p.has('foto')?{postId:p.get('foto'),index:Math.max(0,Number(p.get('indice'))||0)}:null})
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [toast, setToast] = useState('')
  const [conversationTarget, setConversationTarget] = useState(null)
  const [showMenu, setShowMenu] = useState(false)
  const [peopleFilter, setPeopleFilter] = useState('all')
  const [sidebarCollapsed,setSidebarCollapsed]=useState(()=>{try{return window.localStorage.getItem('itext:sidebar:v1')==='collapsed'}catch{return false}})
  function toggleSidebar(){const next=!sidebarCollapsed;setSidebarCollapsed(next);try{window.localStorage.setItem('itext:sidebar:v1',next?'collapsed':'expanded')}catch{/* The layout still works when storage is unavailable. */}}
  const backend = useItextBackend()
  usePresence(backend.user?.authenticated?backend.user.id:null)
  const notificationCount=useNotificationCount(backend.user?.authenticated?backend.user.id:null)
  const unread = useUnreadCount(backend.user?.authenticated ? backend.user.id : null)

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

  useEffect(()=>{document.documentElement.dataset.appearance=appearance(backend.user?.settings.appearance)},[backend.user?.settings.appearance])

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

  function closePhoto(){setPhotoTarget(null);const url=new URL(window.location.href);url.searchParams.delete('foto');url.searchParams.delete('indice');window.history.replaceState(null,'',url)}
  function openPhoto(target){setPhotoTarget(target)}
  function openProfile(id){closePhoto();setShowCreate(false);setShowMenu(false);setProfileTarget(id);setActiveView(id===backend.user?.id?'profile':'member-profile');const url=new URL(window.location.href);url.searchParams.delete('post');url.searchParams.delete('grupo');url.searchParams.delete('convite');url.searchParams.set('perfil',id);url.searchParams.delete('ishort');window.history.replaceState(null,'',url);window.scrollTo({top:0})}
  function openPost(id,commentId=null){setPostTarget({id,commentId});setActiveView('post');const url=new URL(window.location.href);url.searchParams.delete('perfil');url.searchParams.delete('grupo');url.searchParams.delete('convite');url.searchParams.set('post',id);url.searchParams.delete('ishort');window.history.replaceState(null,'',url);window.scrollTo({top:0})}
  function navigate(view) {
    closePhoto()
    const url=new URL(window.location.href);url.searchParams.delete('ishort');url.searchParams.delete('perfil');url.searchParams.delete('post');url.searchParams.delete('grupo');url.searchParams.delete('convite');window.history.replaceState(null,'',url)
    if (view === 'messages') setConversationTarget(null)
    if (view === 'people') setPeopleFilter('all')
    setShowMenu(false)
    setActiveView(view)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openPeople(filter='all') {
    setPeopleFilter(filter); setActiveView('people'); setShowMenu(false)
  }

  function startConversation(person) {
    closePhoto()
    const url=new URL(window.location.href);url.searchParams.delete('ishort');url.searchParams.delete('perfil');url.searchParams.delete('post');url.searchParams.delete('grupo');url.searchParams.delete('convite');window.history.replaceState(null,'',url)
    setConversationTarget(person); setActiveView('messages'); setShowMenu(false)
  }

  function search(query) {
    setSearchQuery(query)
    navigate('explore')
  }

  async function completeOnboarding(interests) {
    await backend.savePreferences(interests, true)
    notify('Seu feed personalizado está pronto.')
  }

  function toggleLike(postId,desired) { return backend.toggleLike(postId,desired) }

  async function addComment(postId, text) {
    try { await backend.addComment(postId, text) } catch (error) { notify(error.message); throw error }
  }

  if (backend.loading && !backend.user) return <LoadingScreen />
  if (!backend.user) return <main className="app-loading"><Brand /><p role="alert">{backend.error || 'Não foi possível conectar ao Itext.'}</p><button className="primary-button" onClick={backend.refresh}>Tentar novamente</button></main>

  let view
  const viewId=activeView==='member-profile'&&profileTarget===backend.user.id?'profile':activeView
  switch (viewId) {
    case 'member-profile': view=<PublicProfileView key={profileTarget} profileId={profileTarget} user={backend.user} onNotify={notify} onMessage={startConversation} onFollow={backend.toggleProfileFollow} onChanged={backend.refresh}/>;break
    case 'post':view=<PostDetailView key={postTarget.id+':'+postTarget.commentId} postId={postTarget.id} commentId={postTarget.commentId} user={backend.user} onNotify={notify} onChanged={backend.refresh}/>;break
    case 'notifications':view=<NotificationsView user={backend.user} onNotify={notify} onOpenPost={openPost} onMessage={startConversation} onNavigate={navigate} onProfile={openProfile}/>;break
    case 'explore': view = <ExploreView key={searchQuery} initialQuery={searchQuery} onNavigate={navigate} onFindPeople={() => navigate('people')} posts={backend.posts} profiles={backend.profiles} communities={backend.communities} pages={backend.pages} user={backend.user} />; break
    case 'people': view = <PeopleView key={peopleFilter} initialFilter={peopleFilter} user={backend.user} onFollow={backend.toggleProfileFollow} onMessage={startConversation} onNotify={notify} />; break
    case 'messages': view = <MessagesView onSocialChange={backend.refresh} user={backend.user} onNotify={notify} initialPerson={conversationTarget} onConfigureSecurity={() => navigate('settings')} onFindPeople={() => navigate('people')} />; break
    case 'shorts': view = <ShortsView user={backend.user} onNotify={notify} onChanged={backend.refresh} />; break
    case 'dating': view = <DatingView user={backend.user} data={backend.dating} onLoad={backend.getDating} onSave={backend.saveDatingProfile} onSwipe={backend.swipeDatingProfile} onUploadMedia={backend.uploadMedia} onNotify={notify} />; break
    case 'communities': view = <CommunitiesView communities={backend.communities} categories={[...backend.communities,...backend.pages].map(space=>space.category).filter(Boolean)} onSaveSpace={backend.saveSpace} onUploadMedia={backend.uploadMedia} onCreateCommunity={backend.createCommunity} onOpenGroup={backend.openGroup} onJoinGroup={backend.joinGroup} onApproveMember={backend.approveGroupMember} onNotify={notify} />; break
    case 'pages': view = <PagesView pages={backend.pages} categories={[...backend.communities,...backend.pages].map(space=>space.category).filter(Boolean)} onSaveSpace={backend.saveSpace} onUploadMedia={backend.uploadMedia} onCreatePage={backend.createPage} onToggleFollow={backend.togglePageFollow} onNotify={notify} />; break
    case 'profile': view = <ProfileView onPeople={() => openPeople('followers')} posts={backend.ownPosts} user={backend.user} communities={backend.communities} pages={backend.pages} onNavigate={navigate} onSaveProfile={backend.saveProfile} onUploadMedia={backend.uploadMedia} onNotify={notify} onEditPost={backend.editPost} onDeletePost={backend.deletePost} onMessage={startConversation} />; break
    case 'settings': view = <SettingsView user={backend.user} onSave={backend.saveSettings} onSaveInterests={backend.savePreferences} onNotify={notify} />; break
    default: view = <FeedView posts={backend.posts} user={backend.user} communities={backend.communities} pages={backend.pages} feedMode={backend.feedMode} setFeedMode={backend.setFeedMode} onPublish={backend.publishPost} onUploadMedia={backend.uploadMedia} onToggleLike={toggleLike} onAddComment={addComment} onChanged={backend.refresh} onNotify={notify} onSearch={search} onEditPost={backend.editPost} onDeletePost={backend.deletePost} onMessage={startConversation} />
  }

  const hideRightRail = wideViews.has(viewId)

  return (
    <ProfileNavigation.Provider value={openProfile}><PhotoNavigation.Provider value={openPhoto}><div className={`app-shell ${hideRightRail ? 'app-shell--wide' : ''}${sidebarCollapsed?' app-shell--collapsed':' app-shell--expanded'}`}>
      <Sidebar collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} activeView={viewId} onNavigate={navigate} onCreate={() => setShowCreate(true)} user={backend.user} unread={unread} notifications={notificationCount} />
      <header className="mobile-header"><button onClick={() => navigate('home')}><Brand /></button><div className="mobile-header__actions"><button onClick={() => navigate('people')} aria-label="Encontrar pessoas"><UserPlus size={20}/></button><button onClick={() => navigate('messages')} aria-label={`Mensagens${unread ? `, ${unread} não lidas` : ''}`} className="unread-icon"><MessageCircle size={20}/>{unread ? <b>{unread > 99 ? '99+' : unread}</b> : null}</button><button className="unread-icon" onClick={()=>navigate('notifications')} aria-label={`Notificações${notificationCount?`, ${notificationCount} não lidas`:''}`}><Bell size={20}/>{notificationCount?<b>{notificationCount>99?'99+':notificationCount}</b>:null}</button><button onClick={() => setShowMenu(true)} aria-label="Abrir menu"><Menu size={20}/></button><button className="mobile-profile-button" onClick={() => navigate('profile')} aria-label="Abrir meu perfil"><Avatar userId={backend.user.id} src={backend.user.avatar} alt="" size="xs" /></button></div></header>
      <div className="app-main">{independent && backend.user.authenticated ? <div className="signin-banner"><span>{backend.user.name}</span><button className="secondary-button" onClick={() => signOut().catch((error) => notify(error.message))}>Sair</button></div> : null}{view}</div>
      {hideRightRail ? null : <RightRail onSearch={search} posts={backend.posts} profiles={backend.profiles} user={backend.user} onFollow={backend.toggleProfileFollow} onNotify={notify} />}
      <MobileNav activeView={viewId} onNavigate={navigate} onCreate={() => setShowCreate(true)} unread={unread} />
      {showMenu ? <Modal title="Navegar no Itext" onClose={() => setShowMenu(false)}><nav className="mobile-menu-grid" aria-label="Todas as páginas">{navItems.map(({id,label,icon:Icon}) => <button key={id} onClick={() => navigate(id)}><Icon size={22}/>{label}</button>)}</nav></Modal> : null}
      {showCreate ? <QuickCreate user={backend.user} communities={backend.communities} pages={backend.pages} onUploadMedia={backend.uploadMedia} onClose={() => setShowCreate(false)} onPublish={backend.publishPost} onNavigate={navigate} onNotify={notify} /> : null}
      {backend.user.authenticated && !backend.user.onboardingComplete ? <Onboarding user={backend.user} onComplete={completeOnboarding} /> : null}
      {photoTarget?<PhotoViewer key={photoTarget.postId} target={photoTarget} user={backend.user} onClose={closePhoto} onNotify={notify}/>:null}
      <Toast message={toast} />
    </div></PhotoNavigation.Provider></ProfileNavigation.Provider>
  )
}
