/// <reference lib="webworker" />

const worker = self as typeof self & ServiceWorkerGlobalScope
const backend = new URL(
  new URL(worker.location.href).searchParams.get('backend') ?? ''
)

worker.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(worker.skipWaiting())
})

worker.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(worker.clients.claim())
})

worker.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url)
  if (
    url.origin !== backend.origin ||
    !(
      url.pathname === backend.pathname ||
      url.pathname.startsWith(backend.pathname + '/')
    )
  )
    return

  const headers = new Headers(event.request.headers)
  headers.set('ngrok-skip-browser-warning', '1')
  event.respondWith(
    fetch(
      new Request(event.request, {
        headers,
        mode: 'cors',
        credentials: 'omit'
      })
    )
  )
})
