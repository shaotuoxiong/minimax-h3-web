;(function () {
  const panel = document.getElementById('startup-diagnostics')
  const status = document.getElementById('startup-status')
  const details = document.getElementById('startup-details')
  const reload = document.getElementById('startup-reload')
  if (!panel || !status || !details || !reload) return

  let failed = false
  function record(message: string) {
    if (details) details.textContent += message + '\n'
  }
  function fail(message: string) {
    failed = true
    if (status) status.textContent = message
    if (reload) reload.hidden = false
    const expansion = panel && panel.querySelector('details')
    if (expansion) expansion.open = true
    record(message)
  }
  function stage(event: Event) {
    if (event instanceof CustomEvent && typeof event.detail === 'string') {
      record(event.detail)
      if (!failed && status) status.textContent = event.detail
    }
  }
  function scriptError(event: Event) {
    if (event instanceof ErrorEvent) {
      fail('编辑器脚本出错：' + event.message)
      record(event.filename + ':' + event.lineno)
    } else if (event.target instanceof HTMLScriptElement) {
      fail('编辑器脚本加载失败，请检查网络或浏览器兼容性')
      record(event.target.src)
    } else if (event.target instanceof HTMLLinkElement) {
      fail('编辑器样式或资源加载失败')
      record(event.target.href)
    }
  }
  function rejected(event: PromiseRejectionEvent) {
    const reason: unknown = event.reason
    fail(
      '编辑器初始化失败：' +
        (reason instanceof Error ? reason.message : String(reason))
    )
  }
  reload.addEventListener('click', function () {
    location.reload()
  })
  window.addEventListener('error', scriptError, true)
  window.addEventListener('unhandledrejection', rejected)
  window.addEventListener('h3-startup-stage', stage)
  record('正在下载编辑器脚本；浏览器：' + navigator.userAgent)

  const timer = setTimeout(function () {
    fail('完整编辑器加载超时，请查看下方脚本和 API 连接详情')
  }, 30000)
  const observer = new MutationObserver(function () {
    if (!document.getElementById('splash-loader')) {
      clearTimeout(timer)
      observer.disconnect()
      window.removeEventListener('error', scriptError, true)
      window.removeEventListener('unhandledrejection', rejected)
      window.removeEventListener('h3-startup-stage', stage)
      panel.remove()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })

  const backend = panel.dataset.api
  if (backend) {
    const endpoint = backend.replace(/\/$/, '') + '/api/system_stats'
    const apiTimer = setTimeout(function () {
      fail('API 连接超时：请检查 Ubuntu 服务和公网隧道')
      record(endpoint)
    }, 15000)
    fetch(endpoint, {
      headers: { 'ngrok-skip-browser-warning': '1' },
      credentials: 'omit'
    })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status)
        if (
          !(response.headers.get('content-type') || '').includes(
            'application/json'
          )
        )
          throw new Error('返回的不是 JSON，可能被隧道提示页拦截')
        return response.json()
      })
      .then(function () {
        record('API 连接成功：' + endpoint)
      })
      .catch(function (error: unknown) {
        fail(
          'API 连接失败：' +
            (error instanceof Error ? error.message : String(error))
        )
        record(endpoint)
      })
      .finally(function () {
        clearTimeout(apiTimer)
      })
  }
})()
