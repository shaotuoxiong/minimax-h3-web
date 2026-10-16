export function fetchBackendFile(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  const configured = import.meta.env.VITE_API_BASE_URL
  if (configured) {
    const backend = new URL(configured)
    const target = new URL(url, location.href)
    const prefix = backend.pathname.replace(/\/$/, '')
    if (
      backend.hostname.endsWith('.ngrok-free.dev') &&
      target.origin === backend.origin &&
      (target.pathname === prefix || target.pathname.startsWith(prefix + '/'))
    ) {
      headers.set('ngrok-skip-browser-warning', '1')
      return fetch(url, { ...options, headers })
    }
  }
  return fetch(url, options)
}
