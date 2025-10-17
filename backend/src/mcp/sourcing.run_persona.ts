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

    // 3) Generate mock leads or integrate with existing sourcing pipeline (V1 stub: no external API)
    const leadsBatch = Array.from({ length: batchSize }).map((_, idx) => ({
      name: `Lead ${idx+1}`,
      email: `lead_${Date.now()}_${idx}@example.com`,
      title: targeting.title_query[0] || 'Prospect',
      company: 'DemoCo',
      linkedin_url: `https://linkedin.com/in/demo_${Date.now()}_${idx}`
    }));

    // 4) Dedupe against user context
    const deduped = await dedupeLeadsForUser(userId, leadsBatch);
    const skipped = leadsBatch.length - deduped.length;

    // 5) Insert into sourcing_leads (for sourcing flows) and mirror to leads if needed
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

    if (deduped.length > 0) {
      await supabaseAdmin.from('sourcing_leads').insert(
        deduped.map((l) => ({
          campaign_id: effectiveCampaignId,
          name: l.name,
          title: l.title,
          company: l.company,
          email: l.email,
          linkedin_url: l.linkedin_url,
          enriched: !!l.email
        }))
      );
    }

    // 6) Optionally auto-send (V1: just log stub)
    let sendStatus: string | undefined;
    if (autoSend) {
      sendStatus = 'scheduled';
    }

    const summary = {
      added_count: deduped.length,
      skipped_duplicates: skipped,
      campaign_id: effectiveCampaignId,
      auto_send: autoSend,
      credit_mode: creditMode
    };
    console.log(JSON.stringify({ event: 'persona_run', user_id: userId, persona_id: personaId, batch_size: batchSize, ...summary, ts: new Date().toISOString() }));
    return { content: [{ type: 'text', text: JSON.stringify(summary) }] } as any;
  }
};


