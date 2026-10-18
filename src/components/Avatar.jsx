import { useContext } from 'react'
import { ProfileNavigation } from './ProfileNavigation.jsx'
export default function Avatar({src,alt='',size='md',online=false,userId}) {
 const open=useContext(ProfileNavigation)
 const interactive=!!open&&!!userId
 function navigate(event){event.preventDefault();event.stopPropagation();open(userId)}
 return <span className={`avatar avatar--${size}${interactive?' avatar--link':''}`} data-profile-id={userId} role={interactive?'link':undefined} tabIndex={interactive?0:undefined} aria-label={interactive?`Abrir perfil${alt?' de '+alt:''}`:undefined} onClick={interactive?navigate:undefined} onKeyDown={interactive?event=>{if(['Enter',' '].includes(event.key))navigate(event)}:undefined}><img src={src||'/avatar.svg'} alt={alt} onError={event=>{event.currentTarget.onerror=null;event.currentTarget.src='/avatar.svg'}}/>{online?<span className="avatar__online" aria-label="Online"/>:null}</span>
}
