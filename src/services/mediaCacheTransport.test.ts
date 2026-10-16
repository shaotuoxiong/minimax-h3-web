import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMediaCache } from './mediaCacheService'

beforeEach(() => {
  useMediaCache().clearCache()
})

describe('media cache through the public backend', () => {
  it('loads preview bytes with tunnel headers and refreshes stale browser responses', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://example.ngrok-free.dev/h3')
    const transport = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Blob(['preview'], { type: 'image/webp' }), {
        headers: { 'Content-Type': 'image/webp' }
      })
    )
    vi.stubGlobal('fetch', transport)
    const objectUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:test-preview')
    const cache = useMediaCache()
    const src = 'https://example.ngrok-free.dev/h3/templates/h3-1.webp'
    const preview = await cache.getCachedMedia(src)
    expect(preview.objectUrl).toBe('blob:test-preview')
    expect(preview.error).toBeUndefined()
    const [, options] = transport.mock.calls[0]
    expect(
      new Headers(options?.headers).get('ngrok-skip-browser-warning')
    ).toBe('1')
    expect(options?.cache).toBe('reload')
    expect(objectUrl).toHaveBeenCalledWith(expect.any(Blob))
    await cache.getCachedMedia(src)
    expect(transport).toHaveBeenCalledTimes(1)
  })

  it('does not turn an HTML tunnel page into a preview image', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response('<html>Tunnel notice</html>', {
          headers: { 'Content-Type': 'text/html' }
        })
      )
    )
    const objectUrl = vi.spyOn(URL, 'createObjectURL')
    const preview = await useMediaCache().getCachedMedia(
      '/templates/preview.webp'
    )
    expect(preview.error).toBe(true)
    expect(preview.objectUrl).toBeUndefined()
    expect(objectUrl).not.toHaveBeenCalled()
  })
})
