export default function Avatar({ src, alt = '', size = 'md', online = false }) {
  return (
    <span className={`avatar avatar--${size}`}>
      <img src={src || '/avatar.svg'} alt={alt} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/avatar.svg' }} />
      {online ? <span className="avatar__online" aria-label="Online" /> : null}
    </span>
  )
}
