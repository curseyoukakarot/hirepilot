import { supabaseAdmin } from '../lib/supabaseAdmin';
import { log } from '../utils/logger';

type EmailEventRow = {
  sg_event_id: string;
  sg_message_id: string | null;
  message_id: string | null;          // resolvedMessageId
  event_timestamp: string | null;
  user_id: string | null;
  campaign_id: string | null;
  lead_id: string | null;
  metadata: any | null;               // { email, ip, user_agent, raw }
};

const BATCH_SIZE = parseInt(process.env.WORKER_ATTRIB_BATCH_SIZE || '500', 10);
const MAX_RUNTIME_MS = parseInt(process.env.WORKER_ATTRIB_MAX_RUNTIME_MS || '240000', 10);

function nowMs() { return Date.now(); }

/**
 * Fetch a page of email_events that are missing attribution.
 * Optional cursor strategy by event_timestamp + sg_event_id for stable paging.
 */
export async function fetchUnattributedEventsPage(afterTs?: string | null): Promise<EmailEventRow[]> {
  let query = supabaseAdmin
    .from('email_events')
    .select('sg_event_id, sg_message_id, message_id, event_timestamp, user_id, campaign_id, lead_id, metadata')
    .is('user_id', null)
    .order('event_timestamp', { ascending: false })
    .limit(BATCH_SIZE);

  // For cron, we usually just take most recent "head" — no cursor needed.
  // For backfill, caller will handle looping until none remain.

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/** Perform attribution for a single event row. */
export async function attributeEvent(ev: EmailEventRow): Promise<boolean> {
  try {
    let { sg_message_id, message_id, metadata } = ev;
    let email: string | undefined = metadata?.email;
    let user_id: string | null = ev.user_id;
    let campaign_id: string | null = ev.campaign_id;
    let lead_id: string | null = ev.lead_id;

    // Step 1: Extract from metadata.raw (primary source)
    if (metadata?.raw) {
      user_id = user_id || metadata.raw.user_id || metadata.raw.hp_user_id || null;
      campaign_id = campaign_id || metadata.raw.campaign_id || metadata.raw.hp_campaign_id || null;
      lead_id = lead_id || metadata.raw.lead_id || metadata.raw.hp_lead_id || null;
      
      // Also extract email if not already present
      email = email || metadata.raw.email || null;
    }

    // Step 2A: Fallback - match by recipient email if still missing data
    if ((!user_id || !campaign_id || !lead_id) && email) {
      const { data: msg, error: e1 } = await supabaseAdmin
        .from('messages')
        .select('user_id,campaign_id,lead_id')
        .eq('to_email', email)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (e1) throw e1;
      if (msg) {
        user_id = user_id || msg.user_id || null;
        campaign_id = campaign_id || msg.campaign_id || null;
        lead_id = lead_id || msg.lead_id || null;
      }
    }

    // Step 2B: Fallback - match by provider message identifiers when available
    if ((!user_id || !campaign_id || !lead_id) && (sg_message_id || message_id)) {
      // Some DBs may not have sg_message_id column. Try message_id_header first (safe), then best-effort message_id.
      try {
        const { data: msgByHeader } = await supabaseAdmin
          .from('messages')
          .select('user_id,campaign_id,lead_id')
          .eq('message_id_header', message_id || '')
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (msgByHeader) {
          user_id = user_id || (msgByHeader as any).user_id || null;
          campaign_id = campaign_id || (msgByHeader as any).campaign_id || null;
          lead_id = lead_id || (msgByHeader as any).lead_id || null;
        }
      } catch {}
      if (!user_id || !campaign_id || !lead_id) {
        try {
          // Only attempt sg_message_id where the column exists; if not, the error is caught and ignored
          const { data: msgBySg } = await (supabaseAdmin as any)
            .from('messages')
            .select('user_id,campaign_id,lead_id')
            .eq('sg_message_id', sg_message_id || '')
            .order('sent_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (msgBySg) {
            user_id = user_id || (msgBySg as any).user_id || null;
            campaign_id = campaign_id || (msgBySg as any).campaign_id || null;
            lead_id = lead_id || (msgBySg as any).lead_id || null;
          }
        } catch {}
      }
    }

    // Step 2C: Fallback - resolve via leads table by recipient email
    if ((!user_id || !campaign_id || !lead_id) && email) {
      try {
        const { data: leadRow } = await supabaseAdmin
          .from('leads')
          .select('id,user_id,campaign_id')
          .eq('email', email)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (leadRow) {
          user_id = user_id || (leadRow as any).user_id || null;
          lead_id = lead_id || (leadRow as any).id || null;
          campaign_id = campaign_id || (leadRow as any).campaign_id || null;
        }
      } catch {}
    }

    // Step 3: Update if we found anything
    if (user_id || campaign_id || lead_id) {
      // Validate campaign_id exists before updating to avoid FK constraint errors
      if (campaign_id) {
        const { data: campaignExists } = await supabaseAdmin
          .from('campaigns')
          .select('id')
          .eq('id', campaign_id)
          .maybeSingle();
        
        if (!campaignExists) {
          log.warn('Campaign not found, setting to null', { campaign_id, sg_event_id: ev.sg_event_id });
          campaign_id = null;
        }
      }

      // If lead_id does not exist (stale), avoid FK violation by dropping it
      let finalLeadId: string | null = lead_id;
      if (lead_id) {
        try {
          const { data: leadExists } = await supabaseAdmin
            .from('leads')
            .select('id')
            .eq('id', lead_id)
            .maybeSingle();
          if (!leadExists) finalLeadId = null;
        } catch { finalLeadId = null; }
      }
      const { error: updErr } = await supabaseAdmin
        .from('email_events')
        .update({ user_id, campaign_id, lead_id: finalLeadId })
        .eq('sg_event_id', ev.sg_event_id);
      if (updErr) throw updErr;
      return true;
    }

    return false;
  } catch (err: any) {
    log.error('attributeEvent error', { err: err?.message, sg_event_id: ev.sg_event_id });
    return false;
  }
}

/** Process a batch with a soft time budget (for cron). */
export async function processBatchSoftTimed(): Promise<{ scanned: number; updated: number; }> {
  const start = nowMs();
  const rows = await fetchUnattributedEventsPage(null);
  let updated = 0;

  for (const ev of rows) {
    const ok = await attributeEvent(ev);
    if (ok) updated++;
    if (nowMs() - start > MAX_RUNTIME_MS) {
      log.warn('Soft time budget reached; exiting early', { scanned: rows.length, updated });
      break;
    }
  }

  return { scanned: rows.length, updated };
}

/** Backfill loop: iterate until none remain (big batches). */
export async function runFullBackfillLoop(): Promise<void> {
  let pass = 0;
  while (true) {
    pass++;
    const start = nowMs();
    const rows = await fetchUnattributedEventsPage(null);
    if (!rows.length) {
      log.info('Backfill complete — no more unattributed rows.');
      break;
    }
    let updated = 0;
    for (const ev of rows) {
      const ok = await attributeEvent(ev);
      if (ok) updated++;
    }
    log.info('Backfill pass done', { pass, scanned: rows.length, updated, ms: nowMs() - start });
    // Small breath to avoid hammering DB
    await sleep(300);
  }
}

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

function escapeOrVal(v: string) {
  // very light-touch sanitation for OR builder values
  return v.replace(/,/g, '\\,');
}
