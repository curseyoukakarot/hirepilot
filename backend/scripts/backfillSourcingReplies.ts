import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

type EmailReplyRow = {
  id: string;
  user_id: string | null;
  from_email: string;
  reply_ts: string;
  subject: string | null;
  text_body: string | null;
  html_body: string | null;
  raw: any;
};

function reqEnv(name: string): string {
  const v = (process.env[name] || '').trim();
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function normalizeEmail(v: any): string {
  const raw = String(v || '').trim();
  const m = raw.match(/<([^>]+)>/);
  const addr = (m ? m[1] : raw).trim().replace(/^"+|"+$/g, '');
  return addr ? addr.toLowerCase() : '';
}

function looksLikeUuid(v: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(v);
}

function parseToForCampaignAndLead(toVal: any): { campaignId: string | null; sourcingLeadId: string | null } {
  const to = String(toVal || '');
  const m = to.match(/\.c_([0-9a-fA-F-]+)\.l_([0-9a-fA-F-]+|none)@/i);
  if (!m) return { campaignId: null, sourcingLeadId: null };
  const campaignId = m[1] || null;
  const lead = m[2] && m[2].toLowerCase() !== 'none' ? m[2] : null;
  return { campaignId, sourcingLeadId: lead };
}

async function main() {
  const campaignId = (process.argv[2] || '').trim();
  const days = Math.min(parseInt(process.argv[3] || '30', 10) || 30, 365);
  const limit = Math.min(parseInt(process.argv[4] || '1000', 10) || 1000, 5000);

  if (!campaignId) {
    console.error('Usage: ts-node scripts/backfillSourcingReplies.ts <campaignId> [days=30] [limit=1000]');
    process.exit(1);
  }

  const url = reqEnv('SUPABASE_URL');
  const key = reqEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: campaign, error: campErr } = await supabase
    .from('sourcing_campaigns')
    .select('id, created_by')
    .eq('id', campaignId)
    .maybeSingle();
  if (campErr) throw campErr;
  if (!campaign?.id) throw new Error('campaign_not_found');
  const ownerId = String((campaign as any).created_by || '');
  if (!ownerId) throw new Error('campaign_missing_created_by');

  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: replies, error: repErr } = await supabase
    .from('email_replies')
    .select('id,user_id,from_email,reply_ts,subject,text_body,html_body,raw')
    .eq('user_id', ownerId)
    .gte('reply_ts', sinceIso)
    .order('reply_ts', { ascending: false })
    .limit(limit);
  if (repErr) throw repErr;

  let scanned = 0;
  let inserted = 0;
  let skipped = 0;
  let matchedByTo = 0;
  let matchedByEmail = 0;
  let noLeadMatch = 0;

  for (const r of (replies || []) as EmailReplyRow[]) {
    scanned += 1;
    const raw = r.raw || {};
    const toRaw = raw?.to || raw?.envelope_to || raw?.to_raw || '';
    const parsed = parseToForCampaignAndLead(toRaw);

    const matchesByTo =
      !!parsed.campaignId && String(parsed.campaignId).toLowerCase() === String(campaignId).toLowerCase();

    let sourcingLeadId: string | null = null;

    if (matchesByTo && parsed.sourcingLeadId && looksLikeUuid(parsed.sourcingLeadId)) {
      sourcingLeadId = parsed.sourcingLeadId;
      matchedByTo += 1;
    }

    if (!sourcingLeadId) {
      const fromEmail = normalizeEmail(r.from_email);
      if (fromEmail) {
        const { data: sl } = await supabase
          .from('sourcing_leads')
          .select('id')
          .eq('campaign_id', campaignId)
          .ilike('email', fromEmail)
          .maybeSingle();
        if (sl?.id) {
          sourcingLeadId = sl.id;
          matchedByEmail += 1;
        }
      }
    }

    if (!sourcingLeadId) {
      noLeadMatch += 1;
      skipped += 1;
      continue;
    }

    const receivedAt = r.reply_ts || new Date().toISOString();

    // Dedupe
    const { data: existing } = await supabase
      .from('sourcing_replies')
      .select('id')
      .eq('campaign_id', campaignId)
      .eq('lead_id', sourcingLeadId)
      .eq('received_at', receivedAt)
      .limit(1);
    if (existing && existing.length > 0) {
      skipped += 1;
      continue;
    }

    const body = String(r.text_body || r.html_body || '');
    const { error: insErr } = await supabase.from('sourcing_replies').insert({
      campaign_id: campaignId,
      lead_id: sourcingLeadId,
      direction: 'inbound',
      subject: r.subject || null,
      body,
      email_from: r.from_email || null,
      email_to: toRaw || null,
      received_at: receivedAt,
    });
    if (insErr) {
      skipped += 1;
      continue;
    }
    inserted += 1;

    await supabase
      .from('sourcing_leads')
      .update({ outreach_stage: 'replied', reply_status: 'replied' })
      .eq('id', sourcingLeadId);
  }

  console.log(JSON.stringify({
    ok: true,
    campaignId,
    ownerId,
    since: sinceIso,
    scanned,
    inserted,
    skipped,
    matchedByTo,
    matchedByEmail,
    noLeadMatch,
  }, null, 2));
}

main().catch((e) => {
  console.error('[backfillSourcingReplies] failed:', e?.message || e);
  process.exit(1);
});

