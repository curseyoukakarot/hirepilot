import { supabase } from '../supabaseClient';

const API_BASE = (typeof window !== 'undefined' && (window as any).__HP_API_BASE__) || (import.meta as any)?.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.hostname === 'app.thehirepilot.com' ? 'https://api.thehirepilot.com' : '');
const apiUrl = (p: string) => `${API_BASE}${p}`;

async function getAuthHeaders(): Promise<Record<string,string>> {
  try { const { data: { session } } = await supabase.auth.getSession(); const t = session?.access_token; return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

export async function listSchedules() {
  const headers = await getAuthHeaders();
  const r = await fetch(apiUrl('/api/schedules'), { credentials: 'include', headers });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createSchedule(body: any) {
  const headers = { 'Content-Type': 'application/json', ...(await getAuthHeaders()) } as Record<string,string>;
  const r = await fetch(apiUrl('/api/schedules'), {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updateSchedule(id: string, body: any) {
  const headers = { 'Content-Type': 'application/json', ...(await getAuthHeaders()) } as Record<string,string>;
  const r = await fetch(apiUrl(`/api/schedules/${id}`), {
    method: 'PATCH',
    headers,
    credentials: 'include',
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deleteSchedule(id: string) {
  const headers = await getAuthHeaders();
  const r = await fetch(apiUrl(`/api/schedules/${id}`), { method: 'DELETE', credentials: 'include', headers });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}


