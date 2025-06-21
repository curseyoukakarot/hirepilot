import { supabase } from '../lib/supabase';

// Centralised backend URL (already used elsewhere in the app)
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

export async function getLeads() {
  try {
    // Grab current JWT from Supabase auth – required by the backend
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) throw new Error('Not authenticated');

    const res = await fetch(`${API_BASE_URL}/api/leads`, {
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
    console.log('✅ Leads loaded (via backend):', leads);
    return leads;
  } catch (error) {
    console.error('❌ Error fetching leads:', error.message || error);
    return [];
  }
}
