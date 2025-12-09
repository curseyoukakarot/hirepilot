import { supabase } from '../supabaseClient';

const API_BASE =
  (typeof window !== 'undefined' && (window as any).__HP_API_BASE__) ||
  (import.meta as any)?.env?.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'app.thehirepilot.com'
    ? 'https://api.thehirepilot.com'
    : '');

const apiUrl = (path: string) => `${API_BASE}${path}`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function listSourcingCampaigns() {
  const headers = await getAuthHeaders();
  const response = await fetch(apiUrl('/api/sourcing/campaigns'), {
    credentials: 'include',
    headers
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function createCampaignFromPersona(payload: { persona_id: string; name: string }) {
  const headers = { 'Content-Type': 'application/json', ...(await getAuthHeaders()) };
  const response = await fetch(apiUrl('/api/schedules/campaign-from-persona'), {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}


