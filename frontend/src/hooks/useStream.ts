export async function* streamFetch(url: string, body: any, init?: RequestInit) {
  const baseHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { ...(init?.headers as any || {}), ...baseHeaders },
    ...init,
  })
  const reader = res.body?.getReader()
  const decoder = new TextDecoder()
  if (!reader) return
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value)
    yield chunk
  }
}


