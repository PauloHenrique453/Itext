import { Check, Heart, Image as ImageIcon, MapPin, RefreshCw, ShieldCheck, SlidersHorizontal, Sparkles, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ViewHeader from '../components/ViewHeader.jsx'
import Avatar from '../components/Avatar.jsx'
import Modal from '../components/Modal.jsx'

const interestOptions = ['programação', 'design', 'comunidades', 'inteligência artificial', 'criatividade', 'música', 'cinema', 'esportes', 'gastronomia', 'viagem']

function DatingSetup({ user, initial, onClose, onSave, onUploadMedia, onNotify }) {
  const [birthDate, setBirthDate] = useState(initial?.birthDate || '')
  const [city, setCity] = useState(initial?.city || '')
  const [bio, setBio] = useState(initial?.bio || '')
  const [lookingFor, setLookingFor] = useState(initial?.lookingFor || 'Conhecer pessoas e conversar com calma')
  const [interests, setInterests] = useState(initial?.interests || user.interests || [])
  const [photos, setPhotos] = useState(initial?.photos?.length ? initial.photos : [user.avatar])
  const [coordinates, setCoordinates] = useState(() => initial?.latitude != null && initial?.longitude != null ? { latitude: initial.latitude, longitude: initial.longitude } : null)
  const [discoveryEnabled, setDiscoveryEnabled] = useState(initial?.discoveryEnabled !== false)
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef(null)

  function toggleInterest(interest) {
    setInterests((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest].slice(0, 8))
  }
  function locate() {
    if (!navigator.geolocation) { onNotify('Seu navegador não oferece localização. Você ainda pode usar a cidade.'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => { setCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setLocating(false); onNotify('Localização aproximada adicionada.'); },
      () => { setLocating(false); onNotify('Não foi possível obter sua localização. Você pode continuar usando a cidade.'); },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    )
  }
  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    try { const result = await onUploadMedia(file); setPhotos((current) => [...current, result.media.url].slice(-6)) } catch (error) { onNotify(error.message) } finally { setUploading(false) }
  }
  async function submit(event) {
    event.preventDefault(); setSaving(true)
    try {
      const result = await onSave({ birthDate, city, bio, lookingFor, interests, photos, discoveryEnabled, latitude: coordinates?.latitude, longitude: coordinates?.longitude })
      onNotify('Seu perfil de conexões foi atualizado.')
      onClose(result)
    } catch (error) { onNotify(error.message) } finally { setSaving(false) }
  }
  return <Modal title={initial ? 'Preferências de conexões' : 'Criar perfil de conexões'} onClose={() => onClose(null)} size="lg"><form className="stack-form dating-setup" onSubmit={submit}><div className="dating-safety-note"><ShieldCheck size={20} /><p><strong>Espaço para maiores de 18 anos.</strong> Sua data de nascimento não aparece para outras pessoas; mostramos apenas sua idade. Sua posição é arredondada antes de ser salva.</p></div><div className="dating-setup__grid"><label>Data de nascimento<input required type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} max={new Date().toISOString().slice(0, 10)} /></label><label>Cidade<input required value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ex.: São Paulo" /></label></div><label>Sobre você<textarea required value={bio} onChange={(event) => setBio(event.target.value)} maxLength="360" placeholder="Uma apresentação curta e verdadeira." /></label><label>O que procura<input value={lookingFor} onChange={(event) => setLookingFor(event.target.value)} maxLength="100" placeholder="Ex.: conhecer pessoas e conversar" /></label><fieldset className="dating-interest-picker"><legend>Interesses em comum</legend><div>{interestOptions.map((interest) => <button type="button" key={interest} className={interests.includes(interest) ? 'is-selected' : ''} onClick={() => toggleInterest(interest)}>{interest}</button>)}</div></fieldset><div className="dating-location"><div><MapPin size={18} /><span><strong>Localização aproximada</strong><small>{coordinates ? 'Usada apenas para ordenar por proximidade; o ponto exato não é exibido.' : 'Use sua cidade ou permita a localização para melhorar a ordem.'}</small></span></div><button type="button" className="secondary-button" disabled={locating} onClick={locate}>{locating ? 'Localizando…' : coordinates ? 'Atualizar' : 'Usar localização'}</button></div><div className="dating-photo-row"><div>{photos.map((photo) => <img key={photo} src={photo} alt="Foto do perfil de conexões" />)}</div><input ref={fileInput} className="sr-only" type="file" accept="image/*" onChange={upload} /><button type="button" className="secondary-button" disabled={uploading || photos.length >= 6} onClick={() => fileInput.current?.click()}><ImageIcon size={15} /> {uploading ? 'Enviando…' : 'Adicionar foto'}</button></div><label className="setting-toggle"><span><strong>Participar da descoberta</strong><small>Você pode pausar a qualquer momento. Seu perfil deixa de aparecer para outras pessoas.</small></span><input type="checkbox" checked={discoveryEnabled} onChange={(event) => setDiscoveryEnabled(event.target.checked)} /><i /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={() => onClose(null)}>Cancelar</button><button className="primary-button" disabled={saving || uploading}>{saving ? 'Salvando…' : initial ? 'Salvar preferências' : 'Entrar em conexões'}</button></div></form></Modal>
}

function MatchCard({ item }) {
  return <article className="dating-match"><Avatar src={item.avatar} alt={item.name} /><span><strong>{item.name}, {item.age}</strong><small>{item.distanceLabel}</small></span><Heart size={17} fill="currentColor" /></article>
}

export default function DatingView({ user, data, onLoad, onSave, onSwipe, onUploadMedia, onNotify }) {
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState('')
  const [showSetup, setShowSetup] = useState(false)
  const [localData, setLocalData] = useState(data)
  const activeData = localData || data

  async function load() {
    setLoading(true); setError('')
    try { setLocalData(await onLoad()) } catch (requestError) { setError(requestError.message) } finally { setLoading(false) }
  }
  useEffect(() => { if (!data) void load() }, [])
  if (loading && !activeData) return <main className="feature-view"><ViewHeader title="Conexões" subtitle="Preparando uma descoberta mais segura." /><div className="dating-loading"><RefreshCw size={23} /> Carregando conexões…</div></main>
  if (error) return <main className="feature-view"><ViewHeader title="Conexões" subtitle="Conheça pessoas de forma respeitosa e no seu ritmo." /><div className="dating-loading"><ShieldCheck size={25} /><strong>Entre para usar Conexões</strong><p>{error}</p></div></main>
  if (!activeData?.profile || showSetup) return <main className="feature-view"><ViewHeader title="Conexões" subtitle="Encontre pessoas por afinidades e proximidade aproximada." /><section className="dating-welcome"><span><Heart size={29} fill="currentColor" /></span><h2>Conheça pessoas no seu ritmo.</h2><p>Você controla se aparece, a cidade e a localização aproximada. Sem endereço público, sem localização em tempo real.</p><button className="primary-button" onClick={() => setShowSetup(true)}>Criar perfil de conexões</button></section>{showSetup ? <DatingSetup user={user} initial={activeData?.profile} onSave={onSave} onUploadMedia={onUploadMedia} onNotify={onNotify} onClose={(result) => { if (result) setLocalData(result); setShowSetup(false) }} /> : null}</main>
  const candidate = activeData.candidates?.[0]
  async function swipe(action) {
    if (!candidate) return
    try { const result = await onSwipe(candidate.id, action); setLocalData(result); onNotify(result.matched ? `Match! Você e ${candidate.name} demonstraram interesse.` : action === 'like' ? 'Interesse enviado.' : 'Tudo bem, vamos para a próxima pessoa.') } catch (requestError) { onNotify(requestError.message) }
  }
  return <main className="feature-view dating-view"><ViewHeader title="Conexões" subtitle="Pessoas ordenadas por proximidade aproximada e interesses em comum." action={<button className="secondary-button" onClick={() => setShowSetup(true)}><SlidersHorizontal size={16} /> Preferências</button>} /><div className="dating-layout"><section className="dating-discovery"><div className="dating-algorithm-note"><Sparkles size={17} /><span><strong>Por que esta ordem?</strong> Proximidade aproximada, interesses em comum e perfil ativo — sem usar localização exata.</span></div>{candidate ? <article className="dating-card"><img src={candidate.avatar} alt="" /><div className="dating-card__shade" /><div className="dating-card__copy"><div><h2>{candidate.name}, {candidate.age}</h2><span><MapPin size={15} /> {candidate.distanceLabel}</span></div><p>{candidate.bio}</p><div className="dating-tags">{candidate.sharedInterests.slice(0, 3).map((interest) => <span key={interest}>{interest}</span>)}</div></div><div className="dating-card__actions"><button className="dating-pass" onClick={() => swipe('pass')} aria-label="Pular perfil"><X size={23} /></button><button className="dating-like" onClick={() => swipe('like')} aria-label="Demonstrar interesse"><Heart size={24} /></button></div></article> : <div className="dating-empty"><UserRound size={28} /><h2>Você viu todas as sugestões por enquanto.</h2><p>Volte mais tarde ou ajuste suas preferências para conhecer novas pessoas.</p><button className="secondary-button" onClick={() => setShowSetup(true)}>Ajustar preferências</button></div>}</section><aside className="dating-side"><section><div className="section-heading"><div><h2>Seus matches</h2><p>Interesse recíproco.</p></div></div>{activeData.matches?.length ? <div className="dating-matches">{activeData.matches.map((item) => <MatchCard key={item.id} item={item} />)}</div> : <p className="empty-inline">Quando os dois demonstrarem interesse, o match aparece aqui.</p>}</section><section className="dating-privacy-card"><ShieldCheck size={19} /><div><strong>Você está no controle</strong><p>Pausar descoberta remove seu perfil das sugestões. A localização é aproximada e a distância aparece por faixa.</p></div></section></aside></div>{showSetup ? <DatingSetup user={user} initial={activeData.profile} onSave={onSave} onUploadMedia={onUploadMedia} onNotify={onNotify} onClose={(result) => { if (result) setLocalData(result); setShowSetup(false) }} /> : null}</main>
}
