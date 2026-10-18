import { independent } from '../services/auth.js'
import {
  Bell,
  Compass,
  Heart,
  Home,
  MessageCircle,
  PanelsTopLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Sparkles,
  SquarePlay,
  UserRound,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import Avatar from './Avatar.jsx'
import Brand from './Brand.jsx'

export const navItems = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'people', label: 'Pessoas', icon: UserPlus },
  { id: 'explore', label: 'Explorar', icon: Compass },
  { id: 'shorts', label: 'Ishort', icon: SquarePlay },
  { id: 'dating', label: 'Conexões', icon: Heart },
  ...(independent ? [{ id: 'messages', label: 'Mensagens', icon: MessageCircle }] : []),
  { id: 'notifications', label: 'Notificações', icon: Bell },
  { id: 'communities', label: 'Comunidades', icon: UsersRound },
  { id: 'pages', label: 'Páginas', icon: PanelsTopLeft },
  { id: 'profile', label: 'Perfil', icon: UserRound },
  { id: 'settings', label: 'Configurações', icon: Settings },
]

export default function Sidebar({ activeView, onNavigate, onCreate, user, unread=0, notifications=0, collapsed=false, onToggleCollapsed }) {
  return (
    <aside className={`sidebar${collapsed?' sidebar--collapsed':''}`}>
      <div className="sidebar__top">
        <div className="sidebar__heading"><button className="brand-button" onClick={() => onNavigate('home')} aria-label="Ir para o início">
          <Brand />
        </button><button type="button" className="icon-button sidebar-collapse" onClick={onToggleCollapsed} aria-label={collapsed?'Expandir menu lateral':'Recolher menu lateral'} title={collapsed?'Expandir menu lateral':'Recolher menu lateral'} aria-expanded={!collapsed} aria-controls="itext-main-nav">{collapsed?<PanelLeftOpen size={22}/>:<PanelLeftClose size={22}/>}</button></div>
        <nav id="itext-main-nav" className="sidebar__nav" aria-label="Navegação principal">
          {navItems.map(({ id, label, icon: Icon, badge }) => (
            <button
              className={`nav-item ${activeView === id ? 'is-active' : ''}`}
              key={id}
              onClick={() => onNavigate(id)}
              aria-current={activeView === id ? 'page' : undefined}
              aria-label={label}
              title={label}
            >
              <Icon size={21} strokeWidth={activeView === id ? 2.4 : 1.8} />
              <span>{label}</span>
              {(id === 'messages' ? unread : id === 'notifications' ? notifications : badge) ? <span className="nav-item__badge">{(id === 'messages'?unread:notifications)>99?'99+':id === 'messages'?unread:notifications}</span> : null}
            </button>
          ))}
        </nav>
        <button className="create-button" onClick={onCreate} aria-label="Criar publicação" title="Criar publicação">
          <Plus size={20} />
          <span>Criar</span>
        </button>
      </div>

      <button className="user-menu" onClick={() => onNavigate('profile')} aria-label="Abrir meu perfil" title="Abrir meu perfil">
        <Avatar userId={user.id} src={user.avatar} alt={user.name} />
        <span className="user-menu__copy">
          <strong>{user.name}</strong>
          <small>{user.handle}</small>
        </span>
        <Sparkles size={18} />
      </button>
    </aside>
  )
}
