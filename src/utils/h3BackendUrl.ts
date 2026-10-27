export function getH3BackendUrl(
  current: Pick<Location, 'hostname' | 'port' | 'origin'> = location
): URL | undefined {
  if (
    import.meta.env.VITE_H3_ONLY === 'true' &&
    ['127.0.0.1', 'localhost'].includes(current.hostname) &&
    current.port === '8189'
  ) {
    return new URL('/h3', current.origin)
  }
  const configured = import.meta.env.VITE_API_BASE_URL
  return configured ? new URL(configured) : undefined
}
