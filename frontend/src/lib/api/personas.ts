import { supabase } from '../supabaseClient';

const API_BASE = (typeof window !== 'undefined' && (window as any).__HP_API_BASE__) || (typeof window !== 'undefined' && window.location.hostname === 'app.thehirepilot.com' ? 'https://api.thehirepilot.com' : '');
const apiUrl = (p: string) => `${API_BASE}${p}`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function listPersonas() {
  const headers = await getAuthHeaders();
  const r = await fetch(apiUrl('/api/personas'), { credentials: 'include', headers });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createPersona(body: any) {
  const headers = { 'Content-Type': 'application/json', ...(await getAuthHeaders()) } as Record<string, string>;
  const r = await fetch(apiUrl('/api/personas'), {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const t = await r.text().catch(()=> '');
    throw new Error(t || `HTTP ${r.status}`);
  }
  return r.json();
}

export async function updatePersona(id: string, body: any) {
  const headers = { 'Content-Type': 'application/json', ...(await getAuthHeaders()) } as Record<string, string>;
  const r = await fetch(apiUrl(`/api/personas/${id}`), {
    method: 'PATCH',
    headers,
    credentials: 'include',
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const t = await r.text().catch(()=> '');
    throw new Error(t || `HTTP ${r.status}`);
  }
  return r.json();
}

export async function deletePersona(id: string) {
  const headers = await getAuthHeaders();
  const r = await fetch(apiUrl(`/api/personas/${id}`), { method: 'DELETE', credentials: 'include', headers });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}


