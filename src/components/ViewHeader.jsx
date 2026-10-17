import { ArrowLeft, Search } from 'lucide-react'

export default function ViewHeader({ title, subtitle, action, onBack, searchable = false }) {
  return (
    <header className="view-header">
      <div className="view-header__main">
        {onBack ? <button className="icon-button" onClick={onBack} aria-label="Voltar"><ArrowLeft size={20} /></button> : null}
        <div>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      <div className="view-header__actions">
        {searchable ? <button className="icon-button" aria-label="Buscar"><Search size={20} /></button> : null}
        {action}
      </div>
    </header>
  )
}
