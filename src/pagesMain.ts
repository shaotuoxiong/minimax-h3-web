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
  if ('serviceWorker' in navigator) {
    try {
      const connect = async () => {
        await navigator.serviceWorker.register(workerUrl, {
          scope: import.meta.env.BASE_URL
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
      await Promise.race([
        connect(),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('Browser worker initialization timed out')),
            5000
          )
        })
      ])
    } catch (error) {
      console.warn(
        'Media transport unavailable; continuing with direct API requests',
        error
      )
    }
  }
}

await import('./bootstrap')

export {}
