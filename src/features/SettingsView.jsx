import { useState } from 'react'
import ViewHeader from '../components/ViewHeader.jsx'
const topics = ['programação', 'design', 'comunidades', 'inteligência artificial', 'criatividade']
export default function SettingsView({ user, onSave, onSaveInterests, onNotify }) {
  const [mode, setMode] = useState(user.settings.feed.mode)
  const [interests, setInterests] = useState(user.interests || [])
  const [busy, setBusy] = useState(false)
  async function save(event) {
    event.preventDefault(); setBusy(true)
    try { await onSaveInterests(interests, true); await onSave({ feed: { mode } }); onNotify('Preferências salvas.') } catch (error) { onNotify(error.message) } finally { setBusy(false) }
  }
  return <main className="feature-view"><ViewHeader title="Configurações" subtitle="Ajuste os interesses e a ordem do seu feed." /><div className="feature-content"><form className="stack-form settings-panel" onSubmit={save}><h2>Seu feed</h2><label>Ordem padrão<select value={mode} onChange={(event) => setMode(event.target.value)}><option value="personalized">Personalizado</option><option value="chronological">Mais recentes</option><option value="following">Pessoas que sigo</option></select></label><fieldset className="dating-interest-picker"><legend>Interesses</legend><div>{topics.map((topic) => <button type="button" className={interests.includes(topic) ? 'is-selected' : ''} key={topic} onClick={() => setInterests((current) => current.includes(topic) ? current.filter((item) => item !== topic) : [...current, topic])}>{topic}</button>)}</div></fieldset><p>O ranking considera interesses, temas, curtidas, comentários e recência.</p><button className="primary-button" disabled={busy || !interests.length || !user.authenticated}>{busy ? 'Salvando…' : 'Salvar preferências'}</button></form></div></main>
}
