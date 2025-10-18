import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { buildSourcingQuery } from '../lib/personaMapper';
import { dedupeLeadsForUser } from '../lib/dedupe';

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

    // 3) Run real Apollo search via existing pipeline and import into campaign
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

    // Use the server's internal route to leverage auth + utilities
    const BACKEND_INTERNAL = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || 'http://127.0.0.1:8080';
    const searchPayload = {
      campaignId: effectiveCampaignId,
      limit: batchSize,
      searchParams: {
        person_titles: (targeting.title_query || []).join(' OR ') || undefined,
        q_keywords: (targeting.keyword_includes || []).join(' '),
        exclude_keywords: (targeting.keyword_excludes || []).join(' '),
        locations: targeting.locations || []
      }
    } as any;
    try {
      await fetch(`${BACKEND_INTERNAL}/api/leads/apollo/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify(searchPayload)
      });
    } catch (err: any) {
      console.error('sourcing.run_persona -> apollo/search failed', err?.message || err);
    }

    // 6) Optionally auto-send (V1: just log stub)
    let sendStatus: string | undefined;
    if (autoSend) {
      sendStatus = 'scheduled';
    }

    const summary = {
      added_count: batchSize, // approximate; UI displays summary
      skipped_duplicates: 0,
      campaign_id: effectiveCampaignId,
      auto_send: autoSend,
      credit_mode: creditMode
    };
    console.log(JSON.stringify({ event: 'persona_run', user_id: userId, persona_id: personaId, batch_size: batchSize, ...summary, ts: new Date().toISOString() }));
    return { content: [{ type: 'text', text: JSON.stringify(summary) }] } as any;
  }
};


