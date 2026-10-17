import { useEffect, useRef, useState } from 'react'
import { initializeAuth, supabase } from '../services/auth.js'
import { loginErrorMessage } from '../services/loginOptions.js'
import { lockChatSession } from '../services/chatSession.js'
import WelcomeView from './WelcomeView.jsx'

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const activeUser = useRef(null)

  useEffect(() => {
    let active = true
    // Keep the callback synchronous: awaiting Supabase operations inside it can deadlock.
    const subscription = supabase?.auth.onAuthStateChange((_event, next) => {
      if (active) {
        if (_event === 'SIGNED_OUT' || (activeUser.current && activeUser.current !== next?.user?.id)) lockChatSession()
        activeUser.current = next?.user?.id || null
        setSession(next)
      }
    }).data.subscription
    void initializeAuth().then((current) => {
      if (active) { setSession(current); setReady(true) }
    }).catch((issue) => {
      if (active) { setError(loginErrorMessage(issue)); setReady(true) }
    })
    return () => { active = false; subscription?.unsubscribe() }
  }, [])

  if (!ready) return <div className="entry-loading" role="status"><span className="entry-spinner" aria-hidden="true" /><p>Abrindo o Itext…</p></div>
  if (!session?.user) return <WelcomeView initialError={error} />
  return children
}
