import { createClient } from '@supabase/supabase-js';
import { getApolloToken, enrichLead } from '../lib/apollo';
import { sendNotify } from '../lib/notifications';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function enrichLeads() {
  try {
    // 1. grab batch of raw leads that lack email
    const { data: batch } = await supabase
      .from('leads_raw')
      .select(`
        *,
        campaign_runs (
          campaign_id,
          campaigns (
            user_id
          )
        )
      `)
      .eq('enriched', false)
      .limit(20);  // small chunk to respect rate-limit

    if (!batch?.length) return;

    // 2. enrich with Apollo
    const enrichedLeads = [];
    const rawUpdates = [];

    for (const raw of batch) {
      try {
        const userId = raw.campaign_runs.campaigns.user_id;
        const token = await getApolloToken(userId);

        const result = await enrichLead(token, {
          first_name: raw.first_name,
          last_name: raw.last_name,
          company_name: raw.company_name,
          linkedin_url: raw.linkedin_url
        });

        if (result?.contacts?.length) {
          const contact = result.contacts[0];
          enrichedLeads.push({
            campaign_id: raw.campaign_runs.campaign_id,
            first_name: raw.first_name,
            last_name: raw.last_name,
            title: raw.title,
            company_name: raw.company_name,
            email: contact.email,
            phone: contact.phone,
            linkedin_url: raw.linkedin_url,
            enrichment_source: 'apollo',
            confidence: contact.confidenceScore,
            source_payload: raw.raw_payload
          });
        }
      } catch (err) {
        if (err instanceof Error) {
          console.error('Apollo enrich error:', (err as any).response?.data || err.message);
        } else {
          console.error('Apollo enrich error:', err);
        }
      }

      // mark this raw row as processed regardless
      rawUpdates.push({ id: raw.id, enriched: true });
    }

    // 3. bulk write
    if (enrichedLeads.length) {
      await supabase.from('leads').insert(enrichedLeads);

      // Send notification for first batch
      const campaignId = batch[0].campaign_runs.campaign_id;
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('title, user_id')
        .eq('id', campaignId)
        .single();

      if (campaign) {
        await sendNotify('enrichment_progress', {
          campaign,
          lead_count: enrichedLeads.length
        });
      }
    }

    await supabase
      .from('leads_raw')
      .upsert(rawUpdates);

    // 4. Check if all leads are enriched
    const { count } = await supabase
      .from('leads_raw')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_run_id', batch[0].campaign_run_id)
      .eq('enriched', false);

    if (count === 0) {
      // All leads enriched, send final notification
      const campaignId = batch[0].campaign_runs.campaign_id;
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('title, user_id')
        .eq('id', campaignId)
        .single();

      if (campaign) {
        await sendNotify('enrichment_complete', {
          campaign,
          run_id: batch[0].campaign_run_id
        });
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('Enrichment error:', error.message);
    } else {
      console.error('Enrichment error:', error);
    }
  }
} 