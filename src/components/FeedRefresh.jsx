export default function FeedRefresh({phase='idle',onRefresh}){
 const label={idle:'Atualizar Início',pulling:'Puxe para atualizar',ready:'Solte para atualizar',refreshing:'Atualizando publicações…'}[phase]
 return <div className="feed-brand-row"><h1 className="sr-only">Início do Itext</h1><button type="button" className={`feed-brand-refresh is-${phase}`} aria-label={label} title={label} aria-busy={phase==='refreshing'} disabled={phase==='refreshing'} onClick={onRefresh}><span className="feed-brand-orbit" aria-hidden="true"/><img src="/favicon.svg" width="38" height="38" alt="" draggable="false"/></button><span className="sr-only" role="status">{phase==='idle'?'':label}</span></div>
}
