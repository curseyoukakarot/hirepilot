import { supabaseAdmin } from '../lib/supabaseAdmin';

async function backfill() {
  // Map messages/email_events to sourcing_leads stages where possible
  // 1) From messages: mark sent on matching leads
  const { data: msgs } = await supabaseAdmin
    .from('messages')
    .select('id,campaign_id,lead_id,status,created_at')
    .eq('status','sent')
    .order('created_at', { ascending: true })
    .limit(5000);
  for (const m of msgs || []) {
    if (!m.lead_id) continue;
    await supabaseAdmin
      .from('sourcing_leads')
      .update({ outreach_stage: 'sent' })
      .eq('id', m.lead_id)
      .catch(()=>{});
  }

  // 2) From email_events: mark replied
  const { data: evs } = await supabaseAdmin
    .from('email_events')
    .select('id,campaign_id,lead_id,event_type,created_at')
    .eq('event_type','reply')
    .order('created_at', { ascending: true })
    .limit(5000);
  for (const e of evs || []) {
    if (!e.lead_id) continue;
    await supabaseAdmin
      .from('sourcing_leads')
      .update({ reply_status: 'replied' })
      .eq('id', e.lead_id)
      .catch(()=>{});
  }
  console.log('[campaignStatsBackfill] completed');
}

backfill().catch((e)=>{
  console.error('[campaignStatsBackfill] error', e?.message || e);
  process.exit(1);
});


