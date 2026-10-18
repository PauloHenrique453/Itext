import { createContext,useContext } from 'react'
export const VideoNavigation=createContext(null)
export const PhotoNavigation=createContext(null)
export const ProfileNavigation=createContext(null)
export function ProfileName({id,children}){const open=useContext(ProfileNavigation);return open&&id?<button className="profile-name-link" onClick={event=>{event.stopPropagation();open(id)}}>{children}</button>:<strong>{children}</strong>}
