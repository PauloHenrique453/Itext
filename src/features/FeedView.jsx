import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2, Code2, Heart, Image as ImageIcon, MessageCircle,
  FileText, Link, Mic, Play, Send, Share2, Sparkles, Video, X,
} from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import Modal from '../components/Modal.jsx'
import PostManage from './PostManage.jsx'
import Stories from './Stories.jsx'
import PostMedia,{ PostLinks } from '../components/PostMedia.jsx'
import { ProfileName } from '../components/ProfileNavigation.jsx'
import { attachmentAccept,safeLink } from '../services/content.js'
import CommentsDialog from './CommentsDialog.jsx'

const starterCode = { html: '', css: '', js: '' }

export function Composer({ user, communities = [], pages = [], onPublish, onUploadMedia, isPublishing }) {
  const [mode, setMode] = useState('post')
  const [text, setText] = useState('')
  const [code, setCode] = useState(starterCode)
  const [media, setMedia] = useState([])
  const [destination, setDestination] = useState('profile')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [link,setLink]=useState('')
  const [showLink,setShowLink]=useState(false)
  const [accept,setAccept]=useState(attachmentAccept)
  const fileInput = useRef(null)
  const hasCode = Object.values(code).some((value) => value.trim())
  const detectsCode = useMemo(() => /codigo|código|react|css|html|javascript|programa/i.test(text), [text])
  const destinations = useMemo(() => [
    { value: 'profile', label: 'Meu perfil' },
    ...communities.filter((group) => group.canPost).map((group) => ({ value: `group:${group.id}`, label: `Grupo: ${group.name}` })),
    ...pages.filter((page) => page.isOwner).map((page) => ({ value: `page:${page.id}`, label: `Página: ${page.name}` })),
  ], [communities, pages])

  function chooseFiles(types){setAccept(types);if(fileInput.current){fileInput.current.accept=types;fileInput.current.click()}}
  function addLink(){const url=safeLink(link);if(!url){setUploadError('Use um link completo começando com https:// ou http://.');return}if((text+'\n'+url).length>10000){setUploadError('O texto ultrapassa 10.000 caracteres.');return}setText(value=>value?value+'\n'+url:url);setLink('');setShowLink(false);setUploadError('')}
  async function addFiles(event) {
    const files = [...(event.target.files || [])].slice(0, Math.max(0, 6 - media.length))
    if (!files.length || uploading) return
    setUploading(true)
    setUploadError('')
    try {
      for(const file of files){const uploaded=await onUploadMedia(file);setMedia(current=>[...current,uploaded.media])}
    } catch (error) {
      setUploadError(error.message || 'Não foi possível enviar a mídia.')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  async function publish() {
    if(uploading||isPublishing)return
    if (!text.trim() && !media.length && (mode !== 'code' || !hasCode)) return
    const [targetType, targetId] = destination.split(':')
    try {
      await onPublish({
        text: text.trim(),
        code: mode === 'code' ? code : undefined,
        media,
        groupId: targetType === 'group' ? targetId : undefined,
        pageId: targetType === 'page' ? targetId : undefined,
      })
      setText('')
      setMedia([])
      setDestination('profile')
      setMode('post')
      setCode(starterCode)
    } catch {
      // Preserve the draft and attachments if the request cannot be completed.
    }
  }

  return <section className="composer composer--modern" data-has-drafts={text.trim()||media.length||hasCode?'true':undefined}>
    <div className="composer__input-row">
      <Avatar userId={user.id} src={user.avatar} alt={user.name} />
      <textarea maxLength={10000} value={text} onChange={(event) => setText(event.target.value)} placeholder={mode === 'code' ? 'Conte o que você construiu…' : 'O que está acontecendo?'} aria-label="Texto da publicação" rows={1} />
    </div>
    {detectsCode && mode === 'post' ? <button className="ai-suggestion" onClick={() => setMode('code')}><Sparkles size={16} /> Parece conteúdo de programação. Quer publicar com código executável?<strong>Usar editor</strong></button> : null}
    {mode === 'code' ? <div className="composer-code-grid">
      <label>HTML<textarea value={code.html} onChange={(event) => setCode({ ...code, html: event.target.value })} /></label>
      <label>CSS<textarea value={code.css} onChange={(event) => setCode({ ...code, css: event.target.value })} /></label>
      <label>JS<textarea value={code.js} onChange={(event) => setCode({ ...code, js: event.target.value })} /></label>
    </div> : null}
    {media.length?<div className="composer-attachments">{media.map(item=><div key={item.storagePath} className="composer-attachment">{item.type==='image'?<img src={item.url} alt={item.name}/>:item.type==='video'?<Video size={26}/>:item.type==='audio'?<Mic size={26}/>:<FileText size={26}/>}<span>{item.name}<small>{(item.size/1000000).toFixed(1)} MB</small></span><button disabled={uploading} className="icon-button" aria-label="Remover anexo" onClick={()=>setMedia(current=>current.filter(row=>row.storagePath!==item.storagePath))}><X size={16}/></button></div>)}</div>:null}
    {showLink?<div className="composer-link-input"><input aria-label="Link da publicação" type="url" placeholder="https://…" value={link} onChange={event=>setLink(event.target.value)}/><button className="secondary-button" onClick={addLink}>Adicionar link</button><button className="icon-button" aria-label="Cancelar link" onClick={()=>setShowLink(false)}><X size={16}/></button></div>:null}
    <PostLinks text={text}/>
    {uploadError ? <p className="composer-upload-error">{uploadError}</p> : null}
    <div className="composer__toolbar">
      <div className="content-modes">
        <button className={mode === 'post' ? 'is-active' : ''} onClick={() => setMode('post')}><Send size={16} /> Post</button>
        <button className={mode === 'code' ? 'is-active' : ''} onClick={() => setMode('code')}><Code2 size={17} /> Jogo/código</button>
        <button disabled={uploading||media.length>=6} onClick={()=>chooseFiles('video/*')}><Video size={17}/>Vídeo</button>
      </div>
      <div className="composer__extras">
        <input ref={fileInput} className="sr-only" type="file" accept={accept} multiple onChange={addFiles} />
        <button className="icon-button" disabled={uploading||media.length>=6} aria-label="Adicionar fotos" onClick={()=>chooseFiles('image/*')}><ImageIcon size={18}/></button>
        <button className="icon-button" disabled={uploading||media.length>=6} aria-label="Adicionar áudio" onClick={()=>chooseFiles('audio/*')}><Mic size={18}/></button>
        <button className="icon-button" disabled={uploading||media.length>=6} aria-label="Adicionar arquivo" onClick={()=>chooseFiles(attachmentAccept)}><FileText size={18}/></button>
        <button className="icon-button" aria-label="Adicionar link" onClick={()=>setShowLink(value=>!value)}><Link size={18}/></button>
        <select className="composer-destination" value={destination} onChange={(event) => setDestination(event.target.value)} aria-label="Destino da publicação">{destinations.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <button className="primary-button" onClick={publish} disabled={!user.authenticated || isPublishing || uploading || (!text.trim() && !media.length && (mode !== 'code' || !hasCode))}>{uploading ? 'Enviando mídia…' : isPublishing ? 'Publicando…' : 'Publicar'}</button>
      </div>
    </div>
  <p className="composer-count">{text.length.toLocaleString('pt-BR')} / 10.000 · {media.length} / 6 anexos</p></section>
}

function CodePreview({ code, onRun }) {
  const [activeFile, setActiveFile] = useState('css')
  return <div className="code-post"><div className="code-post__toolbar"><div className="code-tabs" role="tablist">{['html', 'css', 'js'].map((file) => <button key={file} className={activeFile === file ? 'is-active' : ''} onClick={() => setActiveFile(file)}>{file.toUpperCase()}</button>)}</div><button className="run-button" onClick={() => onRun(code)}><Play size={14} fill="currentColor" /> Jogar/executar</button></div><pre><code>{code[activeFile] || ''}</code></pre><div className="code-post__status"><span /> Código pronto para executar</div></div>
}

export function PostCard({ post, user, onToggleLike, onRunCode, onTag, onNotify, onEditPost, onDeletePost, onUploadMedia, onChanged=()=>{}, initialCommentId=null }) {
  const [liking, setLiking] = useState(false)
  async function like() { if (liking) return; setLiking(true); try { await onToggleLike(post.id) } catch(issue){onNotify(issue.message)} finally { setLiking(false) } }
  const [showComments, setShowComments] = useState(!!initialCommentId)
  const [localCode,setLocalCode]=useState(null)
  async function share() {
    const url = new URL(window.location.href); url.search = ''; url.searchParams.set('post', post.id)
    try {
      if (navigator.share) await navigator.share({ title: 'Publicação no Itext', url: url.href })
      else { await navigator.clipboard.writeText(url.href); onNotify('Link da publicação copiado.') }
    } catch (error) { if (error.name !== 'AbortError') onNotify('Não foi possível compartilhar. Tente novamente.') }
  }
  return <article className="post-card" id={`post-${post.id}`}><Avatar userId={post.authorId} src={post.avatar} alt={post.author} /><div className="post-card__body">
    <header className="post-card__header"><div><ProfileName id={post.authorId}>{post.author}</ProfileName>{post.verified ? <CheckCircle2 className="verified" size={15} fill="currentColor" /> : null}<span>{post.handle} · {post.time}{post.editedAt?' · editado':''}</span></div>{post.authorId===user.id?<PostManage post={post} onEdit={onEditPost} onDelete={onDeletePost} onUploadMedia={onUploadMedia} onNotify={onNotify}/>:null}</header>
    {post.context ? <span className="post-context">{post.context.type === 'group' ? 'No grupo' : 'Na página'}: {post.context.name}</span> : null}
    {post.text ? <p className="post-card__text">{post.text}</p> : null}
    {post.reason ? <p className="feed-reason"><Sparkles size={12} /> Você vê isto porque {post.reason}.</p> : null}
    {post.tags?.length ? <div className="post-tags">{post.tags.map((tag) => <button key={tag} onClick={() => onTag(tag)}>{tag}</button>)}</div> : null}
    <PostLinks text={post.text}/><PostMedia media={post.media} image={post.image}/>
    {post.code ? <CodePreview code={post.code} onRun={onRunCode||setLocalCode} /> : null}
    <div className="post-actions"><button aria-label="Abrir comentários" onClick={() => setShowComments((value) => !value)} className={showComments ? 'is-active' : ''}><MessageCircle size={18} /><span>{post.comments}</span></button><button aria-label="Compartilhar publicação" onClick={share}><Share2 size={18} /></button><button disabled={!user.authenticated || liking} aria-pressed={post.liked} aria-label={post.liked ? 'Remover curtida' : 'Curtir publicação'} className={post.liked ? 'is-liked' : ''} onClick={like}><Heart size={19} fill={post.liked ? 'currentColor' : 'none'} /><span>{post.likes}</span></button></div>
    {showComments?<CommentsDialog postId={post.id} user={user} onClose={()=>setShowComments(false)} onChanged={onChanged} focusComment={initialCommentId}/>:null}
    {localCode?<Modal title="Executar código" onClose={()=>setLocalCode(null)} size="lg"><div className="preview-shell"><iframe title="Código da publicação" sandbox="allow-scripts" srcDoc={`<!doctype html><style>${localCode.css||''}</style>${localCode.html||''}<script>${localCode.js||''}</script>`}/></div></Modal>:null}
  </div></article>
}

export default function FeedView({ posts, user, communities, pages, feedMode, setFeedMode, onPublish, onUploadMedia, onToggleLike, onAddComment, onNotify, onSearch, onEditPost, onDeletePost, onMessage, onChanged }) {
  const [previewCode, setPreviewCode] = useState(null)
  const [isPublishing, setIsPublishing] = useState(false)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('post')
    if (id) document.getElementById(`post-${id}`)?.scrollIntoView({ block: 'center' })
  }, [posts])
  async function publish(payload) { setIsPublishing(true); try { const result = await onPublish(payload); onNotify(result?.classification?.hasCode ? 'Jogo ou código publicado.' : 'Publicação enviada para a rede.'); } catch (error) { onNotify(error.message); throw error } finally { setIsPublishing(false) } }
  const srcDoc = previewCode ? `<!doctype html><html><head><style>${previewCode.css}</style></head><body>${previewCode.html}<script>${previewCode.js}<\/script></body></html>` : ''
  return <main className="feed-view"><header className="feed-header"><h1>Seu mundo, em movimento.</h1><div className="feed-tabs" role="tablist"><button className={feedMode === 'personalized' ? 'is-active' : ''} onClick={() => setFeedMode('personalized')}>Para você</button><button className={feedMode === 'chronological' ? 'is-active' : ''} onClick={() => setFeedMode('chronological')}>Recentes</button><button className={feedMode === 'following' ? 'is-active' : ''} onClick={() => setFeedMode('following')}>Seguindo</button></div></header><div className="feed-content"><Stories user={user} onNotify={onNotify} onMessage={onMessage}/><Composer user={user} communities={communities} pages={pages} onPublish={publish} onUploadMedia={onUploadMedia} isPublishing={isPublishing} /><div className="posts-list">{posts.length ? posts.map((post) => <PostCard key={post.id} post={post} user={user} onToggleLike={onToggleLike} onAddComment={onAddComment} onChanged={onChanged} onRunCode={setPreviewCode} onTag={onSearch} onNotify={onNotify} onEditPost={onEditPost} onDeletePost={onDeletePost} onUploadMedia={onUploadMedia} />) : <div className="profile-empty"><h2>{feedMode === 'following' ? 'Ainda não há publicações de pessoas que você segue.' : 'Ainda não há publicações.'}</h2><p>{feedMode === 'following' ? 'Abra Pessoas para seguir perfis e acompanhar suas publicações.' : 'As publicações da comunidade aparecerão aqui.'}</p></div>}</div></div>{previewCode ? <Modal title="Preview do código" onClose={() => setPreviewCode(null)} size="lg"><div className="preview-shell"><div className="preview-shell__bar"><span /><span /><span /><small>Ambiente isolado do Itext</small></div><iframe title="Resultado do código" sandbox="allow-scripts" srcDoc={srcDoc} /></div></Modal> : null}</main>
}
