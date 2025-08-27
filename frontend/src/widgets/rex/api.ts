export type ChatPayload = {
  threadId?: string;
  mode: 'sales' | 'support' | 'rex';
  messages: { role: 'user' | 'assistant' | 'system'; text: string }[];
  context: { url: string; pathname: string; rb2b?: any; userId?: string | null };
};

export type ChatResponse = {
  threadId: string;
  message: {
    text: string;
    sources?: { title: string; url: string }[];
    tutorial?: { title: string; steps: string[] };
  };
};

const BASE = '/api/rex_widget';

async function requestJson<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    let detail = '';
    try {
      const data = await resp.json();
      detail = typeof data === 'string' ? data : data?.error || JSON.stringify(data);
    } catch {
      try { detail = await resp.text(); } catch {}
    }
    throw new Error(`Request failed ${resp.status}: ${detail}`);
  }
  return (await resp.json()) as T;
}

export async function chat(payload: ChatPayload): Promise<ChatResponse> {
  return requestJson<ChatResponse>('/chat', payload);
}

export async function createLead(payload: {
  full_name: string;
  work_email: string;
  company?: string;
  interest?: string;
  notes?: string;
  rb2b?: any;
}): Promise<{ id: string }> {
  return requestJson<{ id: string }>('/leads', payload);
}

export async function handoff(payload: { threadId: string; reason?: string }): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>('/handoff', payload);
}


