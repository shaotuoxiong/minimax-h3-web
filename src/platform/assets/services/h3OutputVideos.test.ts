import { describe, expect, it, vi } from 'vitest'

import { assetItemSchema } from '@/platform/assets/schemas/assetSchema'
import { fetchH3OutputVideos, mergeH3OutputVideos } from './h3OutputVideos'

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: { apiURL: (path: string) => `https://example.com/h3/api${path}` }
}))

const asset = (id: string, subfolder = 'video') =>
  assetItemSchema.parse({
    id,
    name: '婚礼.mp4',
    tags: ['output'],
    created_at: '2026-10-27T00:00:00Z',
    updated_at: '2026-10-27T00:00:00Z',
    user_metadata: { jobId: '', subfolder }
  })

describe('saved H3 videos', () => {
  it('keeps saved videos visible with empty task history and deduplicates by full path', () => {
    const saved = [asset('disk-1'), asset('disk-2', 'other')]
    expect(mergeH3OutputVideos([], saved)).toEqual(saved)
    const history = [asset('actual-job')]
    expect(mergeH3OutputVideos(history, saved)).toEqual([history[0], saved[1]])
  })

  it('creates playable backend URLs for saved files with unicode names', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json([asset('disk-1')]))
    )
    const result = await fetchH3OutputVideos()
    expect(result).toBeDefined()
    const video = result![0]
    const url = new URL(video.preview_url!)
    expect(url.pathname).toBe('/h3/api/view')
    expect(url.searchParams.get('filename')).toBe('婚礼.mp4')
    expect(url.searchParams.get('subfolder')).toBe('video')
    expect(url.searchParams.get('type')).toBe('output')
    expect(video.thumbnail_url).toBe(video.preview_url)
  })

  it('reports unavailable storage instead of treating it as an empty library', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 503 }))
    )
    await expect(fetchH3OutputVideos()).resolves.toBeUndefined()
  })
})
