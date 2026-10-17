import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function Modal({ title, children, onClose, size = 'md' }) {
  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    document.body.classList.add('has-modal')
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.classList.remove('has-modal')
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal modal--${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </header>
        {children}
      </section>
    </div>
  )
}
