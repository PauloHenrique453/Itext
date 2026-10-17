export function hasNewVersion(current, payload) {
  return current !== 'development' && typeof payload?.id === 'string' && /^[a-zA-Z0-9._-]{8,120}$/.test(payload.id) && payload.id !== current
}
export async function fetchAppVersion(fetcher = fetch) {
  const response = await fetcher(`/version.json?t=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error('Version unavailable')
  return response.json()
}
