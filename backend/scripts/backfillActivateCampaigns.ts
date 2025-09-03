import 'dotenv/config';
import { supabase } from '../src/lib/supabase';

async function backfillLegacyCampaigns() {
  console.log('Backfilling legacy campaigns (table: campaigns)...');
  // Find campaigns in draft that have at least one lead
  const { data: draftCampaigns, error: fetchErr } = await supabase
    .from('campaigns')
    .select('id, status')
    .eq('status', 'draft');
  if (fetchErr) throw fetchErr;

  let activated = 0;
  for (const c of draftCampaigns || []) {
    const { count, error: cntErr } = await supabase
      .from('leads')
      .select('id', { count: 'exact' })
      .eq('campaign_id', c.id);
    if (cntErr) throw cntErr;
    if ((count || 0) > 0) {
      const { error: updErr } = await supabase
        .from('campaigns')
        .update({ status: 'active' })
        .eq('id', c.id);
      if (updErr) throw updErr;
      activated++;
    }
  }
  console.log(`Legacy campaigns activated: ${activated}`);
  return activated;
}

async function backfillSourcingCampaigns() {
  console.log('Backfilling sourcing campaigns (table: sourcing_campaigns)...');
  // Find sourcing campaigns in draft that have at least one sourcing_lead
  const { data: draftCampaigns, error: fetchErr } = await supabase
    .from('sourcing_campaigns')
    .select('id, status')
    .eq('status', 'draft');
  if (fetchErr) throw fetchErr;

  let running = 0;
  for (const c of draftCampaigns || []) {
    const { count, error: cntErr } = await supabase
      .from('sourcing_leads')
      .select('id', { count: 'exact' })
      .eq('campaign_id', c.id);
    if (cntErr) throw cntErr;
    if ((count || 0) > 0) {
      const { error: updErr } = await supabase
        .from('sourcing_campaigns')
        .update({ status: 'running' })
        .eq('id', c.id);
      if (updErr) throw updErr;
      running++;
    }
  }
  console.log(`Sourcing campaigns set to running: ${running}`);
  return running;
}

async function main() {
  try {
    const legacy = await backfillLegacyCampaigns();
    const sourcing = await backfillSourcingCampaigns();
    console.log(JSON.stringify({ legacyActivated: legacy, sourcingRunning: sourcing }));
    process.exit(0);
  } catch (e: any) {
    console.error('Backfill failed:', e?.message || e);
    process.exit(1);
  }
}

main();


