import { supabaseAdmin } from '../lib/supabaseAdmin';

const INTERVAL_MS = Number(process.env.CAMPAIGN_STATS_INTERVAL_MS || 60000);

async function updateOne(campaignId: string) {
  // Recompute from sourcing_leads (same logic as getCampaignStats but persisted)
  const { data: leads } = await supabaseAdmin
    .from('sourcing_leads')
    .select('outreach_stage, reply_status')
    .eq('campaign_id', campaignId);
  const total = leads?.length || 0;
  const emailsSent = (leads || []).filter((l: any) => ['sent','scheduled','replied','bounced','unsubscribed'].includes(String(l.outreach_stage || '').toLowerCase())).length;
  const replied = (leads || []).filter((l: any) => String(l.reply_status || '').toLowerCase() === 'replied').length;
  await supabaseAdmin
    .from('sourcing_campaigns')
    .update({
      total_leads: total,
      emails_sent: emailsSent,
      replies_received: replied,
      updated_at: new Date().toISOString()
    })
    .eq('id', campaignId);
}

async function tick() {
  try {
    const { data } = await supabaseAdmin
      .from('sourcing_campaigns')
      .select('id')
      .in('status', ['running','draft','scheduled']);
    const ids = (data || []).map((r: any) => r.id);
    for (const id of ids) {
      try { await updateOne(id); } catch {}
    }
    if (ids.length) console.log(JSON.stringify({ event: 'campaign_stats_updated', count: ids.length }));
  } catch (e: any) {
    console.error('[campaignStatsWorker] error', e?.message || e);
  }
}

console.log('[campaignStatsWorker] starting with interval', INTERVAL_MS, 'ms');
setInterval(tick, INTERVAL_MS);
tick().catch(()=>{});


