window.dispatchEvent(
  new CustomEvent('h3-startup-stage', {
    detail: '入口脚本已运行，正在准备媒体连接'
  })
)

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

window.dispatchEvent(
  new CustomEvent('h3-startup-stage', { detail: '正在启动完整编辑器与工作流' })
)
await import('./bootstrap')

if (backendAddress) {
  const viewKey = 'h3-original-canvas-view-v2'
  async function fitInitialView() {
    try {
      if (localStorage.getItem(viewKey)) return
    } catch (error) {
      console.warn('Canvas view preference is unavailable', error)
    }
    const [{ app }, { useLitegraphService }] = await Promise.all([
      import('./scripts/app'),
      import('./services/litegraphService')
    ])
    if (
      !app.rootGraph.nodes.some((node) => node.type === 'MiniMaxH3ImageToVideo')
    )
      return
    const originalPositions = [
      [0, 0],
      [0, 220],
      [0, 450],
      [0, 650],
      [400, 0],
      [800, 0],
      [800, 170],
      [800, 340],
      [800, 490],
      [1200, 0],
      [1500, 0],
      [1500, 350],
      [1850, 0],
      [2200, 0]
    ]
    const matchesOriginalLayout = originalPositions.every(([x, y], index) => {
      const node = app.rootGraph.nodes.find(
        (item) => String(item.id) === String(index + 1)
      )
      return node?.pos[0] === x && node.pos[1] === y
    })
    if (matchesOriginalLayout) {
      const [{ default: workflow }, { setNodePosition, setNodeSize }] =
        await Promise.all([
          import('./assets/workflows/H3-T2V-lowvram.json'),
          import('./renderer/core/layout/operations/graphLayoutAttachment')
        ])
      for (const geometry of workflow.nodes) {
        const node = app.rootGraph.nodes.find(
          (item) => String(item.id) === String(geometry.id)
        )
        if (!node) continue
        setNodePosition(node, [geometry.pos[0], geometry.pos[1]])
        setNodeSize(node, [geometry.size[0], geometry.size[1]])
      }
    }
    useLitegraphService().fitView()
    try {
      localStorage.setItem(viewKey, 'done')
    } catch (error) {
      console.warn('Canvas view preference is unavailable', error)
    }
  }
  function onEditorReady() {
    if (document.getElementById('splash-loader')) return
    observer.disconnect()
    requestAnimationFrame(() => {
      void fitInitialView().catch((error: unknown) =>
        console.warn('Unable to fit initial workflow view', error)
      )
    })
  }
  const observer = new MutationObserver(onEditorReady)
  observer.observe(document.body, { childList: true, subtree: true })
  onEditorReady()
}

export {}
