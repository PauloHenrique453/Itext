export default function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="Itext">
      <span className="brand__mark" aria-hidden="true">
        <span />
        <span />
      </span>
      {compact ? null : <span className="brand__name">Itext</span>}
    </div>
  )
}
