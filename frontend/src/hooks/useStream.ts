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

// ---------------------------------------------------------------------------
// SSE event streaming (for POST-based SSE endpoints)
// ---------------------------------------------------------------------------

export type SseEvent = {
  event: string;
  data: any;
};

export async function* streamSse(
  url: string,
  body: any,
  init?: RequestInit
): AsyncGenerator<SseEvent> {
  const baseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { ...(init?.headers as any || {}), ...baseHeaders },
    ...init,
  });

  if (!res.ok) {
    throw new Error(`Stream request failed: ${res.status}`);
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) return;

  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by double newlines
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      if (!part.trim()) continue;

      let eventType = 'message';
      let dataStr = '';

      for (const line of part.split('\n')) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          dataStr += line.slice(6);
        } else if (line.startsWith(':')) {
          // Comment/heartbeat — skip
          continue;
        }
      }

      if (dataStr) {
        try {
          yield { event: eventType, data: JSON.parse(dataStr) };
        } catch {
          yield { event: eventType, data: dataStr };
        }
      }
    }
  }
}
