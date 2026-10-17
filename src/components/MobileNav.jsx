import { independent } from '../services/auth.js'
import { navItems } from './Sidebar.jsx'
import { Plus } from 'lucide-react'

export default function MobileNav({ activeView, onNavigate, onCreate, unread=0 }) {
  const primary = navItems.filter((item) => ['home', 'people', 'explore', independent ? 'messages' : 'communities'].includes(item.id))
  return (
    <nav className="mobile-nav" aria-label="Navegação móvel">
      {primary.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={activeView === id ? 'is-active' : ''}
          onClick={() => onNavigate(id)}
          aria-label={id === 'messages' && unread ? `${label}, ${unread} não lidas` : label}
        >
          <Icon size={22} />{id === 'messages' && unread ? <b>{unread > 99 ? '99+' : unread}</b> : null}
        </button>
      ))}
      <button className="mobile-nav__create" onClick={onCreate} aria-label="Criar publicação">
        <Plus size={22} />
      </button>
    </nav>
  )
}
