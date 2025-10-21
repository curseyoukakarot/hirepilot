export type RexAction = { label: string; value: string };
export type RexReply = { message: string; actions?: RexAction[] };

export type Persona = {
  id: string;
  name: string;
  titles?: string[];
  include_keywords?: string[];
  exclude_keywords?: string[];
  locations?: string[];
  channels?: string[];
};

function detectSlash(message: string): string | null {
  const t = (message || '').trim().toLowerCase();
  if (t.startsWith('/source')) return '/source';
  if (t.startsWith('/schedule')) return '/schedule';
  if (t.startsWith('/refine')) return '/refine';
  return null;
}

export function useRexAgent(persona?: Persona) {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const defaultBase = host === 'app.thehirepilot.com' ? 'https://api.thehirepilot.com' : '';
  const API_BASE = (typeof window !== 'undefined' && (window as any).__HP_API_BASE__) || defaultBase;
  const apiUrl = (path: string) => `${API_BASE}${path}`;
  const getAuthHeaders = async (): Promise<Record<string,string>> => {
    try {
      const { supabase } = await import('../lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  };
  const sendMessageToRex = async (message: string, personaIdOverride?: string): Promise<RexReply> => {
    try {
      // 1) Slash commands shortcut (front-end only hint)
      const slash = detectSlash(message);
      if (slash) {
        if (slash === '/source') {
          return {
            message: persona ? `Would you like me to start sourcing using your ${persona.name} persona?` : 'Would you like me to start sourcing using your active persona?',
            actions: [{ label: 'Run Now', value: 'run_now' }, { label: 'Adjust Persona', value: 'adjust_persona' }]
          };
        }
        if (slash === '/schedule') {
          return { message: 'I can schedule this. Daily or weekly?', actions: [{ label: 'Daily', value: 'schedule_daily' }, { label: 'Weekly', value: 'schedule_weekly' }] };
        }
        if (slash === '/refine') {
          return { message: 'What would you like to modify in your persona?', actions: [{ label: 'Titles', value: 'refine_titles' }, { label: 'Locations', value: 'refine_locations' }, { label: 'Filters', value: 'refine_filters' }] };
        }
      }

      // 2) Call backend chat endpoint (persona-aware)
      const body: any = { message };
      const effectivePersonaId = personaIdOverride || persona?.id;
      if (effectivePersonaId) body.personaId = effectivePersonaId;
      const headers = await getAuthHeaders();
      const resp = await fetch(apiUrl('/api/agent/send-message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        credentials: 'include'
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      return { message: data?.message || '', actions: data?.actions || undefined };
    } catch (e: any) {
      return { message: e?.message || 'Something went wrong. Please try again.' };
    }
  };

  const triggerAction = async (value: string, args?: any, personaIdOverride?: string): Promise<RexReply> => {
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(apiUrl('/api/agent/send-message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ action: value, personaId: personaIdOverride || persona?.id, args: args || {} }),
        credentials: 'include'
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      return { message: data?.message || '', actions: data?.actions || undefined };
    } catch (e: any) {
      return { message: e?.message || 'Action failed. Please try again.' };
    }
  };

  return { sendMessageToRex, triggerAction };
}


