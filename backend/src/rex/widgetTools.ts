import { supabase } from '../lib/supabase';
import { canonicalFlows, searchSupport, whitelistPages } from './knowledge.widget';
import { api } from './server';

export const widgetTools: Record<string, { handler: (args: any) => Promise<any> }> = {
  rex_widget_support_get_pricing_overview: {
    handler: async () => {
      const { data } = await supabase.from('system_settings').select('value').eq('key','pricing_tiers').maybeSingle();
      const tiers = (data?.value as any) || [];
      return { tiers, pricing_url: 'https://thehirepilot.com/pricing' };
    }
  },
  rex_widget_support_get_feature_overview: {
    handler: async () => ({ features:[
      { name:'Campaigns', description:'Outreach with follow-ups', link:'https://thehirepilot.com/' },
      { name:'Integrations', description:'SendGrid/Google/Outlook', link:'https://thehirepilot.com/' }
    ] })
  },
  rex_widget_support_get_flow_steps: {
    handler: async ({ flow }: { flow: keyof typeof canonicalFlows }) => {
      const item = canonicalFlows[flow];
      if (!item) throw new Error('flow not found');
      return item;
    }
  },
  rex_widget_support_get_support_article: {
    handler: async ({ slug }: { slug: string }) => {
      const p = whitelistPages.find(p => p.slug === slug);
      if (!p) throw new Error('slug not found');
      return { title: p.title, excerpt: p.excerpt, url: p.url };
    }
  },
  rex_widget_support_search_support: {
    handler: async ({ q, top_k }: { q:string; top_k?:number }) => ({ results: searchSupport(q, top_k || 5) })
  },
  rex_widget_support_get_account_readiness: {
    handler: async ({ user_id }: { user_id?:string }) => {
      if (!user_id) return { onboarding_complete:false, email_connected:false, has_campaigns:false };
      const { data: integ } = await supabase.from('integrations').select('provider,status').eq('user_id', user_id);
      const email_connected = Boolean((integ||[]).find(r => ['sendgrid','google','outlook'].includes(String(r.provider))));
      const { count } = await supabase.from('sourcing_campaigns').select('*', { count:'exact', head:true }).eq('created_by', user_id);
      return { onboarding_complete: email_connected && (count||0) > 0, email_connected, has_campaigns: (count||0) > 0 };
    }
  },
  rex_widget_support_create_lead: {
    handler: async (payload: any) => {
      const resp = await api('/api/rex_widget/leads', { method:'POST', body: JSON.stringify(payload) });
      return { id: resp.id, routed: { slack: true } };
    }
  },
  rex_widget_support_handoff_to_human: {
    handler: async ({ thread_id, reason }: { thread_id:string; reason?:string }) => {
      await api('/api/rex_widget/handoff', { method:'POST', body: JSON.stringify({ threadId: thread_id, reason }) });
      return { ok:true };
    }
  },
  rex_widget_support_get_ctas: {
    handler: async () => {
      const { data } = await supabase.from('system_settings').select('key,value').in('key',['rex_demo_url','rex_calendly_url']);
      const out:any = {}; (data||[]).forEach((r:any)=>{ out[r.key === 'rex_demo_url' ? 'demo_url' : 'calendly_url'] = r.value; });
      return out;
    }
  },
  // New tools for agent layer
  rex_widget_support_user_context: {
    handler: async ({ rb2b, pathname, user_id }: { rb2b?:any; pathname?:string; user_id?:string }) => {
      const mode = (pathname||'').startsWith('/app') ? 'support' : 'sales';
      return { mode, rb2b_company: rb2b?.company?.name || null, user_id: user_id || null, pathname: pathname || '/' };
    }
  },
  rex_widget_support_analytics_track: {
    handler: async ({ event, props }: { event:string; props?:any }) => {
      await supabase.from('rex_events').insert({ kind: event, payload: props || {} });
      return { ok:true };
    }
  },
  rex_widget_support_ticket_create: {
    handler: async ({ session_id, user_id, anon_id, summary, details }: { session_id:string; user_id?:string; anon_id?:string; summary:string; details?:string }) => {
      const { data, error } = await supabase.from('rex_tickets').insert({ session_id, user_id: user_id||null, anon_id: anon_id||null, summary, details: details||null }).select('id').single();
      if (error) throw error;
      return { id: data.id };
    }
  }
};


