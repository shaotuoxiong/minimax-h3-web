import { describe, expect, it, vi } from 'vitest'

import { getH3BackendUrl } from './h3BackendUrl'

describe('H3 backend address', () => {
  it.for(['127.0.0.1', 'localhost'])(
    'connects the local workbench directly for %s',
    (host) => {
      vi.stubEnv('VITE_H3_ONLY', 'true')
      vi.stubEnv('VITE_API_BASE_URL', 'https://example.ngrok-free.dev/h3')
      expect(
        getH3BackendUrl(new URL(`http://${host}:8189/minimax-h3-web/`))?.href
      ).toBe(`http://${host}:8189/h3`)
    }
  )

  it('preserves the configured public API for GitHub Pages and development previews', () => {
    vi.stubEnv('VITE_H3_ONLY', 'true')
    vi.stubEnv('VITE_API_BASE_URL', 'https://example.ngrok-free.dev/h3')
    for (const url of [
      'https://shaotuoxiong.github.io/minimax-h3-web/',
      'http://127.0.0.1:4173/minimax-h3-web/'
    ]) {
      expect(getH3BackendUrl(new URL(url))?.href).toBe(
        'https://example.ngrok-free.dev/h3'
      )
    }
  })

  it('leaves an unconfigured ordinary ComfyUI installation unchanged', () => {
    vi.stubEnv('VITE_H3_ONLY', '')
    vi.stubEnv('VITE_API_BASE_URL', '')
    expect(getH3BackendUrl(new URL('http://127.0.0.1:8188/'))).toBeUndefined()
  })
})
