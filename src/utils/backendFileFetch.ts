import { getH3BackendUrl } from './h3BackendUrl'

export function fetchBackendFile(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  const backend = getH3BackendUrl()
  if (backend) {
    const target = new URL(url, location.href)
    const prefix = backend.pathname.replace(/\/$/, '')
    if (
      backend.hostname.endsWith('.ngrok-free.dev') &&
      target.origin === backend.origin &&
      (target.pathname === prefix || target.pathname.startsWith(prefix + '/'))
    ) {
      headers.set('ngrok-skip-browser-warning', '1')
      return fetch(url, {
        ...options,
        cache: options.cache === 'force-cache' ? 'reload' : options.cache,
        headers
      })
    }
  }
  return fetch(url, options)
}
