import { assetItemSchema } from '@/platform/assets/schemas/assetSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { fetchBackendFile } from '@/utils/backendFileFetch'

export async function fetchH3OutputVideos(): Promise<AssetItem[] | undefined> {
  const response = await fetchBackendFile(api.apiURL('/h3/output-videos'), {
    cache: 'no-store'
  })
  if (!response.ok) {
    reportError(
      new Error(`Failed to load saved H3 videos: ${response.status}`),
      {
        errorType: 'error_loading_saved_h3_videos'
      }
    )
    return
  }
  return assetItemSchema
    .array()
    .parse(await response.json())
    .map((asset) => {
      const query = new URLSearchParams({
        filename: asset.name,
        subfolder: String(asset.user_metadata?.subfolder ?? ''),
        type: 'output'
      })
      const url = api.apiURL(`/view?${query}`)
      return { ...asset, preview_url: url, thumbnail_url: url }
    })
}

export function mergeH3OutputVideos(
  history: AssetItem[],
  saved: AssetItem[]
): AssetItem[] {
  const key = (asset: AssetItem) =>
    JSON.stringify([asset.user_metadata?.subfolder ?? '', asset.name])
  const existing = new Set(history.map(key))
  return [
    ...history,
    ...saved.filter((asset) => !existing.has(key(asset)))
  ].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
}
