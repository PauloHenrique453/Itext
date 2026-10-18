import { useState } from 'react'
import ViewHeader from '../components/ViewHeader.jsx'
import DeviceSettings from './DeviceSettings.jsx'
import ChatAccessSettings from './ChatAccessSettings.jsx'
const topics = ['programação', 'design', 'comunidades', 'inteligência artificial', 'criatividade']
export default function SettingsView({ user, onSave, onSaveInterests, onNotify }) {
  const [mode, setMode] = useState(user.settings.feed.mode)
  const [interests, setInterests] = useState(user.interests || [])
  const [busy, setBusy] = useState(false)
  const [likesPublic,setLikesPublic]=useState(user.likesPublic===true)
  async function save(event) {
    event.preventDefault(); setBusy(true)
    try { await onSaveInterests(interests, true); await onSave({ feed: { mode },likesPublic }); onNotify('Preferências salvas.') } catch (error) { onNotify(error.message) } finally { setBusy(false) }
  }
  return <main className="feature-view"><ViewHeader title="Configurações" subtitle="Ajuste os interesses e a ordem do seu feed." /><div className="feature-content"><ChatAccessSettings userId={user.id} onNotify={onNotify}/><form className="stack-form settings-panel" onSubmit={save}><h2>Privacidade das curtidas</h2><label className="settings-check"><input type="checkbox" checked={likesPublic} onChange={event=>setLikesPublic(event.target.checked)}/>Mostrar no meu perfil as publicações que curti</label><p className="form-note">Desativado, outras pessoas não veem quais publicações você curtiu. O total de curtidas das publicações continua visível.</p><h2>Seu feed</h2><label>Ordem padrão<select value={mode} onChange={(event) => setMode(event.target.value)}><option value="personalized">Personalizado</option><option value="chronological">Mais recentes</option><option value="following">Pessoas que sigo</option></select></label><fieldset className="dating-interest-picker"><legend>Interesses</legend><div>{topics.map((topic) => <button type="button" className={interests.includes(topic) ? 'is-selected' : ''} key={topic} onClick={() => setInterests((current) => current.includes(topic) ? current.filter((item) => item !== topic) : [...current, topic])}>{topic}</button>)}</div></fieldset><p>O ranking considera interesses, temas, curtidas, comentários e recência.</p><button className="primary-button" disabled={busy || !user.authenticated}>{busy ? 'Salvando…' : 'Salvar preferências'}</button></form><DeviceSettings userId={user.id} onNotify={onNotify}/></div></main>
}
