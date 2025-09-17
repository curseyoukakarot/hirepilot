import { supabase } from '../lib/supabaseClient';

// Centralised backend URL (already used elsewhere in the app)
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

export async function getLeads(campaignId = null) {
  try {
    // Grab current JWT from Supabase auth – required by the backend
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) throw new Error('Not authenticated');

    // Build URL with optional campaign filter
    let url = `${API_BASE_URL}/api/leads`;
    if (campaignId && campaignId !== 'all') {
      url += `?campaignId=${encodeURIComponent(campaignId)}`;
    }

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      credentials: 'include'
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(errText || `HTTP ${res.status}`);
    }

    const payload = await res.json();
    // The backend returns an array (leads[]) – but it may also be wrapped in { leads }
    const leads = Array.isArray(payload) ? payload : (payload.leads || []);
    console.log('✅ Leads loaded (via backend):', leads.length, campaignId ? `for campaign: ${campaignId}` : '(all campaigns)');
    return leads;
  } catch (error) {
    console.error('❌ Error fetching leads:', error.message || error);
    return [];
  }
}
