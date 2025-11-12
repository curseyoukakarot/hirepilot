import { supabase } from '../supabaseClient';

const API_BASE = (import.meta as any).env?.VITE_BACKEND_URL || 'https://api.thehirepilot.com';

async function fetchJson<T>(path: string, init?: RequestInit & { requireAuth?: boolean }): Promise<T> {
  const requireAuth = init?.requireAuth !== false;
  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');
  if (requireAuth) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Missing session token');
    headers.set('Authorization', `Bearer ${token}`);
  }
  const resp = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers,
    // Use bearer token header; avoid cookie-based auth for cross-origin
    credentials: 'omit',
  });
  if (!resp.ok) {
    let detail = '';
    try { const j = await resp.json(); detail = j?.error || JSON.stringify(j); } catch { detail = await resp.text().catch(() => ''); }
    throw new Error(`${resp.status} ${resp.statusText}${detail ? `: ${detail}` : ''}`);
  }
  return resp.json() as Promise<T>;
}

// Types
export type ListFormsResponse = { items: any[]; total: number; page: number; pageSize: number };

export async function listForms(params: { q?: string; page?: number } = {}) {
  const q = new URLSearchParams();
  if (params.q) q.set('q', params.q);
  if (params.page) q.set('page', String(params.page));
  const qs = q.toString() ? `?${q.toString()}` : '';
  return fetchJson<ListFormsResponse>(`/forms${qs}`);
}

export async function createForm(payload: { title: string; description?: string; is_public?: boolean }) {
  return fetchJson<any>('/forms', { method: 'POST', body: JSON.stringify(payload) });
}

export async function getForm(id: string) {
  return fetchJson<any>(`/forms/${id}`);
}

export async function updateForm(id: string, patch: Record<string, any>) {
  return fetchJson<any>(`/forms/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function deleteForm(id: string) {
  return fetchJson<{ ok: boolean }>(`/forms/${id}`, { method: 'DELETE' });
}

export async function upsertFields(id: string, fields: any[]) {
  return fetchJson<{ fields: any[] }>(`/forms/${id}/fields`, { method: 'POST', body: JSON.stringify(fields) });
}

export async function publishForm(id: string, is_public: boolean) {
  return fetchJson<any>(`/forms/${id}/publish`, { method: 'POST', body: JSON.stringify({ is_public }) });
}

export async function listResponses(id: string, params: { page?: number } = {}) {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  const qs = q.toString() ? `?${q.toString()}` : '';
  return fetchJson<any>(`/forms/${id}/responses${qs}`);
}

export async function getResponse(id: string, responseId: string) {
  return fetchJson<any>(`/forms/${id}/responses/${responseId}`);
}

export async function getUploadUrl(params: { filename: string; contentType: string }) {
  return fetchJson<any>(`/forms/uploads`, { method: 'POST', body: JSON.stringify(params), requireAuth: false });
}

export async function submitPublic(slug: string, payload: any) {
  return fetchJson<any>(`/forms/${slug}/submit`, { method: 'POST', body: JSON.stringify(payload), requireAuth: false });
}

export async function getPublicFormBySlug(slug: string) {
  return fetchJson<any>(`/forms/by-slug/${slug}`, { requireAuth: false });
}

export async function listCustomTables() {
  return fetchJson<{ items: { id: string; name: string }[] }>(`/forms/options/custom-tables`);
}

export async function listJobReqs() {
  return fetchJson<{ items: { id: string; title: string; status?: string }[] }>(`/forms/options/job-reqs`);
}


