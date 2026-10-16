import { describe, expect, it, vi } from 'vitest'

import { fetchBackendFile } from './backendFileFetch'

describe('backend file transport', () => {
  it.for<[string, boolean]>([
    ['https://example.ngrok-free.dev/h3/templates/workflow.json', true],
    ['https://example.ngrok-free.dev/h3/internal/files/input', true],
    ['https://example.ngrok-free.dev/other/templates.json', false],
    ['https://other.example/h3/templates/workflow.json', false]
  ])('scopes tunnel headers for %s', async ([url, tunnelHeader]) => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://example.ngrok-free.dev/h3')
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', transport)
    const controller = new AbortController()
    await fetchBackendFile(url, {
      signal: controller.signal,
      headers: { 'Comfy-User': 'local-user' }
    })
    const [, options] = transport.mock.calls[0]
    const headers = new Headers(options?.headers)
    expect(headers.get('ngrok-skip-browser-warning')).toBe(
      tunnelHeader ? '1' : null
    )
    expect(headers.get('Comfy-User')).toBe('local-user')
    expect(options?.signal).toBe(controller.signal)
  })

  it('preserves ordinary local requests', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', transport)
    await fetchBackendFile('/templates/workflow.json')
    expect(transport).toHaveBeenCalledWith('/templates/workflow.json', {})
  })
})
