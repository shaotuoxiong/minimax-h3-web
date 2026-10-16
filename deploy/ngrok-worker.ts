/// <reference lib="webworker" />

export {}

declare const self: ServiceWorkerGlobalScope
const worker = self
const backend = new URL(
  new URL(worker.location.href).searchParams.get('backend') ?? ''
)

worker.addEventListener('install', (event) => {
  event.waitUntil(worker.skipWaiting())
})

worker.addEventListener('activate', (event) => {
  event.waitUntil(worker.clients.claim())
})

worker.addEventListener('fetch', (event) => {
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
