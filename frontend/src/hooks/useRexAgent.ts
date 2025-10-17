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
  const sendMessageToRex = async (message: string): Promise<RexReply> => {
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
      if (persona?.id) body.personaId = persona.id;
      const resp = await fetch('/api/agent/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      return { message: data?.message || '', actions: data?.actions || undefined };
    } catch (e: any) {
      return { message: e?.message || 'Something went wrong. Please try again.' };
    }
  };

  const triggerAction = async (value: string, args?: any): Promise<RexReply> => {
    try {
      const resp = await fetch('/api/agent/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: value, personaId: persona?.id, args: args || {} })
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


