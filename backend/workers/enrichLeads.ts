import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { notifySlack, SlackMessages } from '../lib/slack';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH_SIZE = 10;

export async function enrichLeads() {
  // 🟡 1. grab rows that still need enrichment
  const { data: rawLeads } = await supabase
    .from('leads_raw')
    .select('*, campaigns(name)')
    .eq('enriched', false)        // correct flag column
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (!rawLeads?.length) {
    console.log('Nothing to enrich'); 
    return;
  }

  // 🟡 2. fetch Apollo token for that user
  const userId = rawLeads[0].user_id;
  const { data: integ } = await supabase
    .from('integrations')
    .select('access_token')
    .eq('provider', 'apollo')
    .eq('user_id', userId)
    .single();
  if (!integ) throw new Error('Apollo token missing');

  // 🟡 3. call Apollo enrichment
  let apolloData = null;
  try {
    const urls = rawLeads.map(r => r.linkedin_url);
    const { data } = await axios.post(
      'https://api.apollo.io/v1/people/match',
      { linkedin_urls: urls },
      { headers: { Authorization: `Bearer ${integ.access_token}` } }
    );
    apolloData = data;
  } catch (err: any) {
    console.error('Apollo enrichment failed for batch:', err.message);
    apolloData = null;
  }

  // 🟡 4. format leads for insertion (fallback if Apollo fails)
  const formattedLeads = rawLeads.map((r, i) => {
    let apolloPerson = apolloData?.people?.[i];
    return {
      campaign_id: r.campaign_id,
      leads_raw_id: r.id,
      first_name: r.first_name,
      last_name: r.last_name,
      title: r.headline, // use headline as title
      company: apolloPerson?.current_employer?.name ?? r.company,
      email: apolloPerson?.email_status === 'verified' ? apolloPerson.email : null,
      linkedin_url: r.linkedin_url
    };
  });

  // If Apollo returned nothing, fallback to basic data
  for (let i = 0; i < formattedLeads.length; i++) {
    if (!formattedLeads[i].email) {
      // fallback: insert basic data if enrichment failed
      formattedLeads[i].email = null; // or r.email if you have it
    }
  }

  // 🟡 5. insert into leads & mark as enriched
  await supabase.from('leads').insert(formattedLeads);
  await supabase
    .from('leads_raw')
    .update({ enriched: true })
    .in('id', rawLeads.map(l => l.id));

  // Send Slack notification
  const campaignName = rawLeads[0].campaigns[0]?.name ?? 'unknown-campaign';
  await notifySlack(SlackMessages.leadsEnriched(campaignName, formattedLeads.length));

  console.log(`✓ enriched (or inserted fallback) ${formattedLeads.length} leads`);
}

// Allow running directly
if (require.main === module) {
  enrichLeads().catch(err => { console.error(err); process.exit(1); });
} 