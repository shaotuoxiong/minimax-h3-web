import { describe, expect, it, vi } from 'vitest'

import { ComfyApi } from '@/scripts/api'

describe('remote ComfyUI backend', () => {
  it('sends node discovery to the configured backend under its path prefix', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://model.example/h3/')
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ MiniMaxH3ImageToVideo: {} }))
    vi.stubGlobal('fetch', fetch)
    const backend = new ComfyApi()

    await expect(backend.getNodeDefs()).resolves.toEqual({
      MiniMaxH3ImageToVideo: {}
    })
    expect(fetch).toHaveBeenCalledWith(
      'https://model.example/h3/api/object_info',
      expect.any(Object)
    )
  })

  it.for([
    {
      name: 'video',
      route: '/view?filename=output.mp4',
      expected: 'https://model.example/h3/view?filename=output.mp4'
    },
    {
      name: 'extension',
      route: '/extensions/example.js',
      expected: 'https://model.example/h3/extensions/example.js'
    }
  ])('loads $name from the backend', ({ route, expected }) => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://model.example/h3')
    expect(new ComfyApi().fileURL(route)).toBe(expected)
  })

  it('connects progress over WSS using the backend rather than the Pages host', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://model.example/h3')
    const socket = { addEventListener: vi.fn(), send: vi.fn(), binaryType: '' }
    const WebSocket = vi.fn(function () {
      return socket
    })
    vi.stubGlobal('WebSocket', WebSocket)

    await new ComfyApi().resetSocket()
    expect(WebSocket).toHaveBeenCalledWith(
      expect.stringMatching(/^wss:\/\/model\.example\/h3\/ws(?:\?|$)/)
    )
  })
})
