import ViewHeader from '../components/ViewHeader.jsx'
import Avatar from '../components/Avatar.jsx'

export default function ShortsView({ posts = [] }) {
  const videos = posts.flatMap((post) => (post.media || []).filter((media) => media.type === 'video').map((media) => ({ ...media, post })))
  return <main className="feature-view"><ViewHeader title="Ishort" subtitle="Vídeos publicados por pessoas no Itext." /><div className="feature-content">{videos.length ? videos.map(({ url, post }) => <article className="post-card" key={url}><Avatar src={post.avatar} alt={post.author} /><div className="post-card__body"><strong>{post.author}</strong><p>{post.text}</p><video className="post-card__media" src={url} controls preload="metadata" /></div></article>) : <div className="profile-empty"><h2>Ainda não há vídeos neste feed.</h2><p>Publique um vídeo no início para compartilhar no Ishort.</p></div>}</div></main>
}
