export async function* streamFetch(url: string, body: any) {
  const res = await fetch(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
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


