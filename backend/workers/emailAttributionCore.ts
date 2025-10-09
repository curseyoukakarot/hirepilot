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

    // Step 1: try message identifiers
    // Note: messages table doesn't have sg_message_id, but may have message_id column
    let msg: any = null;
    
    if (message_id) {
      // Try to find by our custom message_id first
      const { data: msgById, error: e1 } = await supabaseAdmin
        .from('messages')
        .select('user_id,campaign_id,lead_id')
        .eq('id', message_id)
        .maybeSingle();
      if (e1) throw e1;
      msg = msgById;
    }
    
    // If not found and we have sg_message_id, try to find by any message_id column that might exist
    if (!msg && sg_message_id) {
      const { data: msgBySg, error: e2 } = await supabaseAdmin
        .from('messages')
        .select('user_id,campaign_id,lead_id')
        .eq('message_id', sg_message_id)
        .maybeSingle();
      if (!e2) msg = msgBySg; // Ignore error if column doesn't exist
    }

    if (msg) {
      user_id = user_id || msg.user_id || null;
      campaign_id = campaign_id || msg.campaign_id || null;
      lead_id = lead_id || msg.lead_id || null;
    }

    // Step 2: fallback by recipient email (most recent send)
    if ((!user_id || !campaign_id) && email) {
      const { data: msg2, error: e2 } = await supabaseAdmin
        .from('messages')
        .select('user_id,campaign_id,lead_id')
        .eq('to_email', email)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (e2) throw e2;
      if (msg2) {
        user_id = user_id || msg2.user_id || null;
        campaign_id = campaign_id || msg2.campaign_id || null;
        lead_id = lead_id || msg2.lead_id || null;
      }
    }

    // Step 3: Update if we found anything
    if (user_id || campaign_id || lead_id) {
      const { error: updErr } = await supabaseAdmin
        .from('email_events')
        .update({ user_id, campaign_id, lead_id })
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
