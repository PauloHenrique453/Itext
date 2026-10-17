import { lazy, Suspense } from 'react'
import AuthGate from './features/AuthGate.jsx'

const SocialApp = lazy(() => import('./SocialApp.jsx'))

export default function App() {
  return <AuthGate><Suspense fallback={<div className="entry-loading" role="status"><span className="entry-spinner" aria-hidden="true" /><p>Carregando sua comunidade…</p></div>}><SocialApp /></Suspense></AuthGate>
}
