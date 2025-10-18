import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { buildSourcingQuery } from '../lib/personaMapper';
import { searchAndEnrichPeople } from '../../utils/apolloApi';
import { addLeads } from '../services/sourcing';

export const sourcingRunPersonaTool = {
  name: 'sourcing.run_persona',
  description: 'Run an end-to-end sourcing flow for a persona',
  parameters: z.object({
    userId: z.string(),
    persona_id: z.string(),
    batch_size: z.number().int().positive().max(500).optional(),
    campaign_id: z.string().optional(),
    auto_send: z.boolean().optional(),
    credit_mode: z.enum(['base','enhanced']).optional()
  }),
  handler: async (args: any) => {
    const userId: string = args.userId;
    const personaId: string = args.persona_id;
    const batchSize: number = Number(args.batch_size || 50);
    const campaignId: string | undefined = args.campaign_id;
    const autoSend: boolean = Boolean(args.auto_send);
    const creditMode: string = args.credit_mode || 'base';

    // 1) Load persona (ownership enforced by user_id check)
    const { data: persona, error: pErr } = await supabaseAdmin
      .from('personas')
      .select('*')
      .eq('id', personaId)
      .eq('user_id', userId)
      .single();
    if (pErr || !persona) throw new Error('Persona not found');

    // 2) Map to sourcing query (structural only in V1)
    const targeting = buildSourcingQuery({
      name: persona.name,
      titles: persona.titles || [],
      include_keywords: persona.include_keywords || [],
      exclude_keywords: persona.exclude_keywords || [],
      locations: persona.locations || [],
      channels: persona.channels || [],
      goal_total_leads: persona.goal_total_leads || 0
    } as any);

    // 3) Ensure sourcing campaign
    let effectiveCampaignId = campaignId;
    if (!effectiveCampaignId) {
      // Create a lightweight campaign shell for persona run
      const { data: campRow, error: cErr } = await supabaseAdmin
        .from('sourcing_campaigns')
        .insert({ title: `Persona • ${persona.name}`, created_by: userId, audience_tag: 'rex' })
        .select('id')
        .single();
      if (cErr) throw new Error(cErr.message);
      effectiveCampaignId = (campRow as any).id;
    }
    // 4) Resolve Apollo API key
    let apiKey: string | undefined = process.env.SUPER_ADMIN_APOLLO_API_KEY || undefined;
    if (!apiKey) {
      const { data: settings } = await supabaseAdmin
        .from('user_settings')
        .select('apollo_api_key')
        .eq('user_id', userId)
        .maybeSingle();
      apiKey = (settings as any)?.apollo_api_key || undefined;
    }
    if (!apiKey) {
      throw new Error('Apollo not configured for this workspace');
    }

    // 5) Search + enrich via Apollo
    const { leads: apolloLeads } = await searchAndEnrichPeople({
      api_key: apiKey,
      person_titles: (targeting.title_query || []).length ? [ (targeting.title_query || []).join(' OR ') ] : undefined,
      person_locations: (targeting.locations || []).length ? [ (targeting.locations || [])[0] ] : undefined,
      q_keywords: (targeting.keyword_includes || []).join(' ') || undefined,
      page: 1,
      per_page: Math.min(Math.max(batchSize || 25, 1), 100)
    } as any);

    const mappedLeads = (apolloLeads || []).map((l: any) => ({
      name: [l.firstName, l.lastName].filter(Boolean).join(' ').trim() || undefined,
      title: l.title || undefined,
      company: l.company || undefined,
      linkedin_url: l.linkedinUrl || undefined,
      email: l.email || undefined
    }));

    // 6) Insert into sourcing_leads and handle credits
    const addResult = await addLeads(effectiveCampaignId!, mappedLeads, { source: 'apollo', userId });

    // 6) Optionally auto-send (V1: just log stub)
    let sendStatus: string | undefined;
    if (autoSend) {
      sendStatus = 'scheduled';
    }

    const summary = {
      added_count: Number((addResult as any)?.inserted || mappedLeads.length),
      skipped_duplicates: 0,
      campaign_id: effectiveCampaignId,
      auto_send: autoSend,
      credit_mode: creditMode
    };
    console.log(JSON.stringify({ event: 'persona_run', user_id: userId, persona_id: personaId, batch_size: batchSize, ...summary, ts: new Date().toISOString() }));
    return { content: [{ type: 'text', text: JSON.stringify(summary) }] } as any;
  }
};


