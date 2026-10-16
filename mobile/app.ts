import { z } from 'zod'
import template from './workflow.json'

const API = import.meta.env.VITE_API_BASE_URL
const JOB_KEY = 'h3-mobile-job'
const RESULT_KEY = 'h3-mobile-result'

function record(value: unknown) {
  return z.record(z.unknown()).parse(value)
}

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function save(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* Storage is optional in embedded browsers. */
  }
}

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('ngrok-skip-browser-warning', '1')
  if (typeof options.body === 'string')
    headers.set('Content-Type', 'application/json')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60000)
  try {
    const response = await fetch(API + path, {
      ...options,
      headers,
      signal: controller.signal
    })
    if (!response.ok)
      throw new Error(`服务请求失败（HTTP ${response.status}），请稍后重试。`)
    return response
  } finally {
    clearTimeout(timer)
  }
}

async function json(path: string, options: RequestInit = {}) {
  const response = await request(path, options)
  const payload: unknown = await response.json()
  return record(payload)
}

function required<T extends Element>(selector: string, type: { new (): T }): T {
  const value = document.querySelector(selector)
  if (!(value instanceof type))
    throw new Error('Missing page element: ' + selector)
  return value
}

function start() {
  const form = required('#generator', HTMLFormElement)
  const prompt = required('#prompt', HTMLTextAreaElement)
  const image = required('#image', HTMLInputElement)
  const reference = required('#reference', HTMLImageElement)
  const generate = required('#generate', HTMLButtonElement)
  const connection = required('#connection', HTMLElement)
  const status = required('#status', HTMLElement)
  const retry = required('#retry', HTMLButtonElement)
  const result = required('#result', HTMLElement)
  const video = required('#video', HTMLVideoElement)
  const download = required('#download', HTMLAnchorElement)
  let busy = false
  let connected = false
  let watching = false
  let videoUrl = ''
  let imageUrl = ''
  let pendingJob = stored(JOB_KEY)

  function setJob(id: string | null) {
    pendingJob = id
    save(JOB_KEY, id)
  }

  function message(text: string, error = false) {
    status.textContent = text
    status.className = error ? 'error' : ''
  }

  function updateButton() {
    generate.disabled = busy || !connected || Boolean(pendingJob)
    generate.textContent = busy
      ? '正在生成…'
      : pendingJob
        ? '请重新连接以查看任务'
        : '生成视频'
  }

  async function showVideo(output: unknown) {
    const file = record(output)
    const filename = z.string().parse(file.filename)
    const query = new URLSearchParams({
      filename,
      subfolder: z.string().parse(file.subfolder ?? ''),
      type: z.string().parse(file.type ?? 'output')
    })
    save(RESULT_KEY, JSON.stringify(file))
    message('视频已生成，正在下载预览…')
    const response = await request('/view?' + query.toString())
    const blob = await response.blob()
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    videoUrl = URL.createObjectURL(blob)
    video.src = videoUrl
    download.href = videoUrl
    download.download = filename
    download.textContent = '保存视频'
    result.hidden = false
    save(RESULT_KEY, JSON.stringify(file))
    message('生成完成，可以播放或保存视频。')
  }

  async function watch(id: string) {
    if (watching) return
    watching = true
    busy = true
    updateButton()
    message('正在生成短视频…可稍后重新打开此页面查看结果。')
    try {
      for (;;) {
        const history = await json('/api/history/' + encodeURIComponent(id))
        if (history[id]) {
          const job = record(history[id])
          const state = record(job.status)
          if (state.status_str === 'error') {
            setJob(null)
            throw new Error('本次生成失败，请检查本机 ComfyUI 日志后重试。')
          }
          if (state.completed) {
            if (state.status_str !== 'success') {
              setJob(null)
              throw new Error('本次生成失败，请检查本机 ComfyUI 日志后重试。')
            }
            const outputs = record(job.outputs)
            let found: unknown
            for (const value of Object.values(outputs)) {
              const images = record(value).images
              if (Array.isArray(images)) {
                found = images.find(
                  (item: unknown) =>
                    typeof record(item).filename === 'string' &&
                    String(record(item).filename).endsWith('.mp4')
                )
                if (found) break
              }
            }
            if (!found) throw new Error('任务完成，但未返回视频文件。')
            setJob(null)
            await showVideo(found)
            return
          }
        } else {
          const queue = await json('/api/queue')
          const entries = [
            ...z.array(z.unknown()).parse(queue.queue_running),
            ...z.array(z.unknown()).parse(queue.queue_pending)
          ]
          if (
            !entries.some((entry) => Array.isArray(entry) && entry[1] === id)
          ) {
            setJob(null)
            throw new Error('任务记录不存在，本机服务可能已重启，请重新生成。')
          }
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 2000))
      }
    } catch (error) {
      console.error(error)
      message(
        error instanceof Error
          ? error.message
          : '网络连接中断，请点击重新连接。',
        true
      )
    } finally {
      busy = false
      watching = false
      updateButton()
    }
  }

  async function connect() {
    retry.disabled = true
    connection.textContent = '正在连接本机模型…'
    try {
      await json('/api/system_stats')
      connected = true
      connection.textContent = '已连接 · MiniMax H3'
      updateButton()
      const pending = pendingJob
      if (pending) void watch(pending)
      else {
        const previous = stored(RESULT_KEY)
        if (previous && !videoUrl) await showVideo(JSON.parse(previous))
        else if (!busy) message('已连接，可以开始生成。')
      }
    } catch (error) {
      console.error(error)
      connected = false
      connection.textContent = '暂未连接，请确认本机服务已启动'
      message('页面已打开，模型暂时连接不上。请点击重新连接。', true)
      updateButton()
    } finally {
      retry.disabled = false
    }
  }

  image.addEventListener('change', () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    const file = image.files?.[0]
    reference.hidden = !file
    if (file) {
      imageUrl = URL.createObjectURL(file)
      reference.src = imageUrl
    }
  })

  retry.addEventListener('click', () => {
    void connect()
  })
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (busy || !connected) return
    void (async () => {
      busy = true
      updateButton()
      try {
        const file = image.files?.[0]
        let uploaded = ''
        if (file) {
          if (file.size > 10 * 1024 * 1024)
            throw new Error('请选择小于 10 MB 的照片。')
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
            throw new Error('请选择 JPG、PNG 或 WebP 照片。')
          message('正在上传参考照片…')
          const body = new FormData()
          body.append('image', file)
          body.append('type', 'input')
          const response = await json('/upload/image', { method: 'POST', body })
          const name = z.string().parse(response.name)
          uploaded = response.subfolder
            ? z.string().parse(response.subfolder) + '/' + name
            : name
        }
        const workflow = {
          ...template,
          '5': {
            ...template['5'],
            inputs: {
              ...template['5'].inputs,
              prompt: prompt.value.trim(),
              width: file ? 768 : 864,
              height: file ? 512 : 480,
              ...(file ? { first_frame: ['15', 0] } : {})
            }
          },
          '6': {
            ...template['6'],
            inputs: { noise_seed: Math.floor(Math.random() * 2147483647) }
          },
          '14': {
            ...template['14'],
            inputs: {
              ...template['14'].inputs,
              filename_prefix: file ? 'video/H3_Web_I2V' : 'video/H3_Web_T2V'
            }
          },
          ...(file
            ? { '15': { class_type: 'LoadImage', inputs: { image: uploaded } } }
            : {})
        }
        message('正在提交生成任务…')
        const submitted = await json('/api/prompt', {
          method: 'POST',
          body: JSON.stringify({ prompt: workflow })
        })
        const id = z.string().parse(submitted.prompt_id)
        setJob(id)
        busy = false
        await watch(id)
      } catch (error) {
        console.error(error)
        message(
          error instanceof Error ? error.message : '提交失败，请稍后重试。',
          true
        )
      } finally {
        busy = false
        updateButton()
      }
    })()
  })
  void connect()
}

start()
