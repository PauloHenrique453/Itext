import { Bot, Code2, Compass, Palette, Sparkles, UsersRound, Video } from 'lucide-react'
import { useState } from 'react'
import Modal from '../components/Modal.jsx'

const interests = [
  { id: 'programação', label: 'Programação', description: 'Código, produto e carreira dev', icon: Code2 },
  { id: 'design', label: 'Design', description: 'UI, UX, marcas e criatividade', icon: Palette },
  { id: 'comunidades', label: 'Comunidades', description: 'Pessoas, grupos e colaboração', icon: UsersRound },
  { id: 'inteligência artificial', label: 'Inteligência artificial', description: 'IA prática e automação', icon: Bot },
  { id: 'criatividade', label: 'Criatividade', description: 'Vídeo, foto e narrativas', icon: Video },
]

export default function Onboarding({ user, onComplete }) {
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState(() => new Set(user.interests || []))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function toggleInterest(id) {
    setSelected((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function finish() {
    if (!selected.size) return
    setBusy(true)
    try {
      await onComplete([...selected])
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Vamos personalizar o Itext" onClose={() => {}} size="lg">
      <div className="onboarding">{error ? <p role="alert">{error}</p> : null}
        <div className="onboarding__progress" aria-label={`Etapa ${step + 1} de 3`}><span className={step >= 0 ? 'is-active' : ''} /><span className={step >= 1 ? 'is-active' : ''} /><span className={step >= 2 ? 'is-active' : ''} /></div>
        {step === 0 ? (
          <section className="onboarding__intro">
            <span className="onboarding__symbol"><Compass size={30} /></span>
            <h2>Seu feed começa com você.</h2>
            <p>Escolha o que quer descobrir. Você poderá mudar isso, ver como o ranking funciona e trocar para ordem cronológica a qualquer momento.</p>
            <button className="primary-button" onClick={() => setStep(1)}>Escolher interesses</button>
          </section>
        ) : null}
        {step === 1 ? (
          <section>
            <h2>O que desperta sua curiosidade?</h2>
            <p className="onboarding__subtitle">Selecione pelo menos um assunto para configurar seu feed inicial.</p>
            <div className="interest-grid">
              {interests.map(({ id, label, description, icon: Icon }) => (
                <button key={id} className={selected.has(id) ? 'is-selected' : ''} onClick={() => toggleInterest(id)}>
                  <span><Icon size={21} /></span><div><strong>{label}</strong><small>{description}</small></div>
                </button>
              ))}
            </div>
            <div className="form-actions"><button className="secondary-button" onClick={() => setStep(0)}>Voltar</button><button className="primary-button" disabled={!selected.size} onClick={() => setStep(2)}>Continuar</button></div>
          </section>
        ) : null}
        {step === 2 ? (
          <section className="onboarding__wellbeing">
            <span className="onboarding__symbol"><Sparkles size={28} /></span>
            <h2>Um feed interessante, no seu ritmo.</h2>
            <p>Seu feed usa os interesses escolhidos e as suas interações. Você pode trocar para a ordem cronológica nas configurações. Os vídeos só tocam quando você aperta o play.</p>

            <div className="form-actions"><button className="secondary-button" onClick={() => setStep(1)}>Voltar</button><button className="primary-button" disabled={busy} onClick={finish}>{busy ? 'Salvando…' : 'Entrar no Itext'}</button></div>
          </section>
        ) : null}
      </div>
    </Modal>
  )
}
