const backendAddress = import.meta.env.VITE_API_BASE_URL
if (
  backendAddress &&
  new URL(backendAddress).hostname.endsWith('.ngrok-free.dev')
) {
  const workerUrl = new URL(
    `${import.meta.env.BASE_URL}ngrok-worker.js`,
    location.origin
  )
  workerUrl.searchParams.set('backend', backendAddress)
  await navigator.serviceWorker.register(workerUrl, {
    scope: import.meta.env.BASE_URL,
    type: 'module'
  })
  await navigator.serviceWorker.ready
  if (!navigator.serviceWorker.controller) {
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        () => resolve(),
        { once: true }
      )
    })
  }
}

await import('./bootstrap')

export {}
