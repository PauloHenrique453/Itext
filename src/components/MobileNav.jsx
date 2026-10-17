import { independent } from '../services/auth.js'
import { navItems } from './Sidebar.jsx'
import { Plus } from 'lucide-react'

export default function MobileNav({ activeView, onNavigate, onCreate }) {
  const primary = navItems.filter((item) => ['home', 'explore', 'dating', independent ? 'messages' : 'communities'].includes(item.id))
  return (
    <nav className="mobile-nav" aria-label="Navegação móvel">
      {primary.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={activeView === id ? 'is-active' : ''}
          onClick={() => onNavigate(id)}
          aria-label={label}
        >
          <Icon size={22} />
        </button>
      ))}
      <button className="mobile-nav__create" onClick={onCreate} aria-label="Criar publicação">
        <Plus size={22} />
      </button>
    </nav>
  )
}
