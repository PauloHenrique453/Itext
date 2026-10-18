import { createContext,useContext } from 'react'
export const ProfileNavigation=createContext(null)
export function ProfileName({id,children}){const open=useContext(ProfileNavigation);return open&&id?<button className="profile-name-link" onClick={event=>{event.stopPropagation();open(id)}}>{children}</button>:<strong>{children}</strong>}
