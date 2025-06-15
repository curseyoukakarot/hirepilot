import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import csv from 'csv-parse/sync';
import { notifySlack, SlackMessages } from '../lib/slack';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
console.log('DEBUG env:', {
    url:  process.env.SUPABASE_URL,
    key:  process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0,20) + '…'
  });
  
async function main() {
  const runId = process.argv[2];          // allow manual back-fill
  const { data: runs } = await supabase
    .from('campaign_runs')
    .select('id, result_url, status, campaign_id, campaigns(name)')
    .in('status', ['finished'])         // only finished runs
    .order('created_at', { ascending: false });

  for (const run of runs ?? []) {
    // skip if already ingested
    const { count } = await supabase
      .from('leads_raw')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_run_id', run.id);
    if (count && count > 0) continue;

    // download CSV
    const res = await axios.get(run.result_url!, { responseType: 'text' });
    const records: any[] = csv.parse(res.data, { columns: true });

    // Limit to 25 leads
    const limitedRecords = records.slice(0, 25);

    // bulk insert with enriched=false
    const rows = limitedRecords.map(r => ({
      campaign_run_id: run.id,
      campaign_id: run.campaign_id,
      first_name: r.firstName,
      last_name: r.lastName,
      headline: r.headline,
      linkedin_url: r.profileUrl,
      company: r.companyName,
      enriched: false  // explicitly set to false
    }));
    await supabase.from('leads_raw').insert(rows);

    await supabase
      .from('campaign_runs')
      .update({ status: 'ingested' })
      .eq('id', run.id);

    // Send Slack notification with safe campaign name access
    const campaignName = run.campaigns[0]?.name ?? 'unknown-campaign';
    await notifySlack(SlackMessages.leadsScraped(campaignName, rows.length));

    console.log(`✓ ingested ${rows.length} rows for run ${run.id}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }); 