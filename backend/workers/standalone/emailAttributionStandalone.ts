#!/usr/bin/env node
// @ts-nocheck
/**
 * Standalone Email Attribution Worker
 * Runs independently without requiring full backend build
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import cron from 'node-cron';

// Simple logger
const log = {
  info: (msg: string, meta?: any) => console.log(JSON.stringify({ level: 'info', msg, timestamp: new Date().toISOString(), ...meta })),
  warn: (msg: string, meta?: any) => console.warn(JSON.stringify({ level: 'warn', msg, timestamp: new Date().toISOString(), ...meta })),
  error: (msg: string, meta?: any) => console.error(JSON.stringify({ level: 'error', msg, timestamp: new Date().toISOString(), ...meta })),
};

// Supabase admin client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const BATCH_SIZE = parseInt(process.env.WORKER_ATTRIB_BATCH_SIZE || '500', 10);
const MAX_RUNTIME_MS = parseInt(process.env.WORKER_ATTRIB_MAX_RUNTIME_MS || '240000', 10);

type EmailEventRow = {
  sg_event_id: string;
  sg_message_id: string | null;
  message_id: string | null;
  event_timestamp: string | null;
  user_id: string | null;
  campaign_id: string | null;
  lead_id: string | null;
  metadata: any | null;
};

async function fetchUnattributedEvents(): Promise<EmailEventRow[]> {
  const { data, error } = await supabase
    .from('email_events')
    .select('sg_event_id, sg_message_id, message_id, event_timestamp, user_id, campaign_id, lead_id, metadata')
    .is('user_id', null)
    .order('event_timestamp', { ascending: false })
    .limit(BATCH_SIZE);

  if (error) throw error;
  return data || [];
}

async function attributeEvent(ev: EmailEventRow): Promise<boolean> {
  try {
    let { metadata } = ev;
    let email: string | undefined = metadata?.email;
    let user_id: string | null = ev.user_id;
    let campaign_id: string | null = ev.campaign_id;
    let lead_id: string | null = ev.lead_id;

    // Step 1: Extract from metadata.raw (primary source)
    if (metadata?.raw) {
      user_id = user_id || metadata.raw.user_id || metadata.raw.hp_user_id || null;
      campaign_id = campaign_id || metadata.raw.campaign_id || metadata.raw.hp_campaign_id || null;
      lead_id = lead_id || metadata.raw.lead_id || metadata.raw.hp_lead_id || null;
      email = email || metadata.raw.email || null;
    }

    // Step 2A: Fallback - match by recipient email in messages
    if ((!user_id || !campaign_id || !lead_id) && email) {
      try {
        const { data: msg } = await supabase
          .from('messages')
          .select('user_id,campaign_id,lead_id')
          .eq('to_email', email)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (msg) {
          user_id = user_id || (msg as any).user_id || null;
          campaign_id = campaign_id || (msg as any).campaign_id || null;
          lead_id = lead_id || (msg as any).lead_id || null;
        }
      } catch {}
    }

    // Step 2B: Fallback - message identifiers
    if ((!user_id || !campaign_id || !lead_id) && (ev.sg_message_id || ev.message_id)) {
      const strippedMsgHeader = ev.message_id ? String(ev.message_id).split('.')[0] : null;
      const strippedProviderId = ev.sg_message_id ? String(ev.sg_message_id).split('.')[0] : null;
      const attemptedKeys: string[] = [];
      try {
        if (strippedMsgHeader) {
          attemptedKeys.push('message_id_header');
          const { data: byHeader } = await supabase
            .from('messages')
            .select('user_id,campaign_id,lead_id')
            .eq('message_id_header', strippedMsgHeader)
            .order('sent_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (byHeader) {
            user_id = user_id || (byHeader as any).user_id || null;
            campaign_id = campaign_id || (byHeader as any).campaign_id || null;
            lead_id = lead_id || (byHeader as any).lead_id || null;
          }
        }
      } catch {}
      if (!user_id || !campaign_id || !lead_id) {
        const candidateIds = [strippedMsgHeader, strippedProviderId].filter(Boolean) as string[];
        for (const candidateId of candidateIds) {
          if (user_id && campaign_id && lead_id) break;
          try {
            attemptedKeys.push('message_id');
            const { data: byProviderId } = await supabase
              .from('messages')
              .select('user_id,campaign_id,lead_id')
              .eq('message_id', candidateId)
              .order('sent_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (byProviderId) {
              user_id = user_id || (byProviderId as any).user_id || null;
              campaign_id = campaign_id || (byProviderId as any).campaign_id || null;
              lead_id = lead_id || (byProviderId as any).lead_id || null;
            }
          } catch {}
        }
      }
      if ((!user_id || !campaign_id || !lead_id) && attemptedKeys.length) {
        log.warn('No messages match during attribution', {
          sg_event_id: ev.sg_event_id,
          attempted_keys: attemptedKeys,
          message_id_header: strippedMsgHeader || null,
          message_id: strippedProviderId || null
        });
      }
    }

    // Step 2C: Fallback - via leads by email
    if ((!user_id || !campaign_id || !lead_id) && email) {
      try {
        const { data: leadRow } = await supabase
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
      if (campaign_id) {
        try {
          const { data: campaignExists } = await supabase
            .from('campaigns')
            .select('id')
            .eq('id', campaign_id)
            .maybeSingle();
          if (!campaignExists) campaign_id = null;
        } catch { campaign_id = null; }
      }
      // Avoid FK violation for lead
      let finalLeadId: string | null = lead_id;
      if (lead_id) {
        try {
          const { data: leadExists } = await supabase
            .from('leads')
            .select('id')
            .eq('id', lead_id)
            .maybeSingle();
          if (!leadExists) finalLeadId = null;
        } catch { finalLeadId = null; }
      }
      const client: any = supabase as any;
      const fromAny: any = client.from.bind(client);
      const { error: updErr } = await fromAny('email_events')
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

async function processBatch(): Promise<{ scanned: number; updated: number; }> {
  const start = Date.now();
  const rows = await fetchUnattributedEvents();
  let updated = 0;

  for (const ev of rows) {
    const ok = await attributeEvent(ev);
    if (ok) updated++;
    if (Date.now() - start > MAX_RUNTIME_MS) {
      log.warn('Soft time budget reached; exiting early', { scanned: rows.length, updated });
      break;
    }
  }

  return { scanned: rows.length, updated };
}

async function tick() {
  try {
    const { scanned, updated } = await processBatch();
    log.info('Attribution cron tick complete', { scanned, updated });
  } catch (err: any) {
    log.error('Attribution cron tick error', { err: err?.message });
  }
}

// Run immediately on boot
tick();

// Schedule: every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  log.info('Attribution cron tick starting...');
  await tick();
});

log.info('Standalone email attribution worker started - running every 5 minutes');

// Keep process alive
process.on('SIGTERM', () => {
  log.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});
