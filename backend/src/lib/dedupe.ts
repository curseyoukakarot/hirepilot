import { supabaseAdmin } from './supabaseAdmin';

// ── Types for cross-campaign deduplication ──

export interface CrossCampaignDuplicateDetail {
  email: string;
  linkedin_url?: string;
  existing_campaign_id: string;
  existing_campaign_title: string;
  outreach_stage: string;
}

export interface CrossCampaignDedupeResult {
  duplicateEmails: Set<string>;
  duplicateLinkedinUrls: Set<string>;
  details: CrossCampaignDuplicateDetail[];
}

/**
 * Check if leads (by email / linkedin_url) already exist in OTHER active
 * sourcing campaigns for the same user.  Returns the set of duplicate
 * identifiers so callers can filter them out before insertion.
 *
 * Only campaigns with status IN ('running','active') are considered —
 * completed, paused, and draft campaigns do not block.
 */
export async function dedupeLeadsAcrossCampaigns(
  userId: string,
  leads: Array<{ email?: string; linkedin_url?: string; [key: string]: any }>,
  excludeCampaignId?: string
): Promise<CrossCampaignDedupeResult> {
  const empty: CrossCampaignDedupeResult = {
    duplicateEmails: new Set(),
    duplicateLinkedinUrls: new Set(),
    details: []
  };

  if (!userId || !leads?.length) return empty;

  // 1. Collect unique identifiers
  const emails = Array.from(new Set(
    leads.map(l => (l.email || '').trim().toLowerCase()).filter(Boolean)
  ));
  const urls = Array.from(new Set(
    leads.map(l => (l.linkedin_url || '').trim().toLowerCase()).filter(Boolean)
  ));

  if (!emails.length && !urls.length) return empty;

  // 2. Get active campaign IDs for this user (excluding the target campaign)
  let campaignQuery = supabaseAdmin
    .from('sourcing_campaigns')
    .select('id, title')
    .eq('created_by', userId)
    .in('status', ['running', 'active']);

  if (excludeCampaignId) {
    campaignQuery = campaignQuery.neq('id', excludeCampaignId);
  }

  const { data: activeCampaigns } = await campaignQuery;
  if (!activeCampaigns?.length) return empty;

  const campaignIds = activeCampaigns.map((c: any) => c.id);
  const titleMap = new Map(activeCampaigns.map((c: any) => [c.id, c.title || 'Untitled']));

  // 3. Query sourcing_leads for matching emails (batched in groups of 100)
  const duplicateEmails = new Set<string>();
  const duplicateLinkedinUrls = new Set<string>();
  const details: CrossCampaignDuplicateDetail[] = [];

  // Helper: batch an array into chunks
  const batch = <T>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  };

  // 3a. Email-based dedup
  if (emails.length) {
    for (const emailBatch of batch(emails, 100)) {
      const { data: matches } = await supabaseAdmin
        .from('sourcing_leads')
        .select('email, linkedin_url, campaign_id, outreach_stage')
        .in('campaign_id', campaignIds)
        .in('email', emailBatch);

      for (const m of (matches || []) as any[]) {
        const e = String(m.email || '').toLowerCase();
        if (!e) continue;
        duplicateEmails.add(e);
        details.push({
          email: e,
          linkedin_url: m.linkedin_url || undefined,
          existing_campaign_id: m.campaign_id,
          existing_campaign_title: titleMap.get(m.campaign_id) || 'Untitled',
          outreach_stage: m.outreach_stage || 'queued'
        });
      }
    }
  }

  // 3b. LinkedIn URL-based dedup (for leads without email)
  if (urls.length) {
    for (const urlBatch of batch(urls, 100)) {
      const { data: matches } = await supabaseAdmin
        .from('sourcing_leads')
        .select('email, linkedin_url, campaign_id, outreach_stage')
        .in('campaign_id', campaignIds)
        .in('linkedin_url', urlBatch);

      for (const m of (matches || []) as any[]) {
        const url = String(m.linkedin_url || '').toLowerCase();
        if (!url) continue;
        // Skip if already caught by email match
        const mEmail = String(m.email || '').toLowerCase();
        if (mEmail && duplicateEmails.has(mEmail)) continue;
        duplicateLinkedinUrls.add(url);
        details.push({
          email: mEmail || url,
          linkedin_url: url,
          existing_campaign_id: m.campaign_id,
          existing_campaign_title: titleMap.get(m.campaign_id) || 'Untitled',
          outreach_stage: m.outreach_stage || 'queued'
        });
      }
    }
  }

  return { duplicateEmails, duplicateLinkedinUrls, details };
}

export async function dedupeLeadsForUser(userId: string, leads: any[]): Promise<any[]> {
  if (!Array.isArray(leads) || leads.length === 0) return [];
  const emails = Array.from(new Set(leads.map((l) => (l.email || '').toLowerCase()).filter(Boolean)));
  const urls = Array.from(new Set(leads.map((l) => (l.linkedin_url || l.profile_url || '').toLowerCase()).filter(Boolean)));

  const existingEmails = new Set<string>();
  const existingUrls = new Set<string>();

  if (emails.length > 0) {
    const { data } = await supabaseAdmin
      .from('leads')
      .select('email')
      .eq('user_id', userId)
      .in('email', emails);
    (data || []).forEach((r: any) => existingEmails.add(String(r.email || '').toLowerCase()));
  }
  if (urls.length > 0) {
    const { data } = await supabaseAdmin
      .from('leads')
      .select('linkedin_url')
      .eq('user_id', userId)
      .in('linkedin_url', urls);
    (data || []).forEach((r: any) => existingUrls.add(String(r.linkedin_url || '').toLowerCase()));
  }

  const filtered: any[] = [];
  const seenEmails = new Set<string>();
  const seenUrls = new Set<string>();

  for (const l of leads) {
    const email = String(l.email || '').toLowerCase();
    const url = String(l.linkedin_url || l.profile_url || '').toLowerCase();
    if (email) {
      if (existingEmails.has(email) || seenEmails.has(email)) continue;
      seenEmails.add(email);
    } else if (url) {
      if (existingUrls.has(url) || seenUrls.has(url)) continue;
      seenUrls.add(url);
    }
    filtered.push(l);
  }

  return filtered;
}


