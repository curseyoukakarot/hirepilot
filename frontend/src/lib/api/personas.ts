const API_BASE = (typeof window !== 'undefined' && (window as any).__HP_API_BASE__) || (import.meta as any)?.env?.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.hostname === 'app.thehirepilot.com' ? 'https://api.thehirepilot.com' : '');
const apiUrl = (p: string) => `${API_BASE}${p}`;

export async function listPersonas() {
  const r = await fetch(apiUrl('/api/personas'), { credentials: 'include' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createPersona(body: any) {
  const r = await fetch(apiUrl('/api/personas'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updatePersona(id: string, body: any) {
  const r = await fetch(apiUrl(`/api/personas/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deletePersona(id: string) {
  const r = await fetch(apiUrl(`/api/personas/${id}`), { method: 'DELETE', credentials: 'include' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}


