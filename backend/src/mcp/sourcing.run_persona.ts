import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { buildSourcingQuery } from '../lib/personaMapper';
import { searchAndEnrichPeople } from '../../utils/apolloApi';
import { addLeads, sendSequenceForLeads } from '../services/sourcing';

export const sourcingRunPersonaTool = {
  name: 'sourcing.run_persona',
  description: 'Run an end-to-end sourcing flow for a persona',
  parameters: z.object({
    userId: z.string(),
    persona_id: z.string(),
    batch_size: z.number().int().positive().max(500).optional(),
    campaign_id: z.string().optional(),
    auto_send: z.boolean().optional(),
    credit_mode: z.enum(['base','enhanced']).optional(),
    auto_outreach_enabled: z.boolean().optional(),
    linked_campaign_id: z.string().optional(),
    linked_persona_id: z.string().optional(),
    schedule_id: z.string().optional(),
    leads_per_run: z.number().int().positive().max(500).optional(),
    send_delay_minutes: z.number().int().nonnegative().optional(),
    daily_send_cap: z.number().int().positive().optional()
  }),
  handler: async (args: any) => {
    const userId: string = args.userId;
    const personaId: string = args.persona_id;
    const leadsPerRun: number = Math.max(1, Math.min(Number(args.leads_per_run ?? args.batch_size ?? 50), 500));
    const campaignId: string | undefined = args.linked_campaign_id || args.campaign_id;
    const autoSendInput: boolean = Boolean(args.auto_send);
    const autoOutreachEnabled: boolean = Boolean(args.auto_outreach_enabled ?? autoSendInput);
    const creditMode: string = args.credit_mode || 'base';
    const sendDelayMinutes: number = typeof args.send_delay_minutes === 'number' ? Math.max(0, args.send_delay_minutes) : 0;
    const dailySendCap: number | null = typeof args.daily_send_cap === 'number' ? Math.max(1, args.daily_send_cap) : null;
    const scheduleId: string | null = args.schedule_id || null;

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
      per_page: Math.min(Math.max(leadsPerRun || 25, 1), 100)
    } as any);

    const mappedLeads = (apolloLeads || []).map((l: any) => ({
      name: [l.firstName, l.lastName].filter(Boolean).join(' ').trim() || undefined,
      title: l.title || undefined,
      company: l.company || undefined,
      linkedin_url: l.linkedinUrl || undefined,
      email: l.email || undefined
    }));
    const leadsToInsert = mappedLeads.slice(0, leadsPerRun);

    // 6) Insert into sourcing_leads and handle credits
    const mirrorMetadata = scheduleId
      ? { lead_source: `schedule:${scheduleId}`, tags: [`auto:schedule:${scheduleId}`] }
      : undefined;
    const addResult = await addLeads(effectiveCampaignId!, leadsToInsert, { source: 'apollo', userId, mirrorMetadata });

    let outreachSummary: { scheduled: number; skipped: number } | null = null;
    if (autoOutreachEnabled && effectiveCampaignId && Array.isArray(addResult.leads)) {
      const newLeadIds = (addResult.leads as any[]).map((l: any) => l?.id).filter(Boolean);
      if (!newLeadIds.length) {
        console.warn('[sourcing.run_persona] auto-outreach enabled but no new leads inserted', { campaignId: effectiveCampaignId, personaId, scheduleId });
      } else {
        try {
          outreachSummary = await sendSequenceForLeads({
            campaignId: effectiveCampaignId,
            leadIds: newLeadIds,
            sendDelayMinutes,
            dailySendCap
          });
        } catch (err: any) {
          console.warn('[sourcing.run_persona] auto-outreach failed', { campaignId: effectiveCampaignId, personaId, scheduleId, error: err?.message || err });
        }
      }
    } else if (autoOutreachEnabled && !effectiveCampaignId) {
      console.warn('[sourcing.run_persona] auto-outreach requested without campaign', { personaId, scheduleId });
    }

    const summary = {
      added_count: Number((addResult as any)?.inserted || leadsToInsert.length),
      skipped_duplicates: 0,
      campaign_id: effectiveCampaignId,
      auto_send: autoOutreachEnabled,
      credit_mode: creditMode,
      auto_outreach: outreachSummary
    };
    console.log(JSON.stringify({ event: 'persona_run', user_id: userId, persona_id: personaId, batch_size: leadsPerRun, ...summary, ts: new Date().toISOString() }));
    return { content: [{ type: 'text', text: JSON.stringify(summary) }] } as any;
  }
};


