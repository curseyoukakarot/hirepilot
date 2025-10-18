import { Router } from 'express';
import { DateTime } from 'luxon';
import { requireAuth } from '../middleware/authMiddleware';
import { ApiRequest } from '../types/api';
import { supabaseDb } from '../lib/supabase';
import { notifySlack } from '../lib/slack';
import { personalizeMessage } from '../utils/messageUtils';

const router = Router();

// Helpers -------------------------------------------------------------
function toUtcFromLocal(localIso: string, timezone: string): string {
  if (!localIso) return new Date().toISOString();
  const dt = DateTime.fromISO(localIso, { zone: timezone || 'America/Chicago' });
  return dt.toUTC().toISO();
}

function isBusinessDay(dt: DateTime): boolean {
  const weekday = dt.weekday; // 1=Mon..7=Sun
  return weekday >= 1 && weekday <= 5;
}

function applyBusinessDayRule(dt: DateTime, businessOnly: boolean): DateTime {
  if (!businessOnly) return dt;
  let cur = dt;
  while (!isBusinessDay(cur)) {
    cur = cur.plus({ days: 1 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
  }
  return cur;
}

function applyWindow(dtUtc: DateTime, windowStart?: string | null, windowEnd?: string | null, timezone = 'America/Chicago'): DateTime {
  if (!windowStart && !windowEnd) return dtUtc;
  const local = dtUtc.setZone(timezone);
  const [sH, sM] = (windowStart || '00:00').split(':').map(Number);
  const [eH, eM] = (windowEnd || '23:59').split(':').map(Number);
  const startLocal = local.set({ hour: sH, minute: sM, second: 0, millisecond: 0 });
  const endLocal = local.set({ hour: eH, minute: eM, second: 59, millisecond: 0 });
  let adjusted = local;
  if (local < startLocal) adjusted = startLocal;
  if (local > endLocal) adjusted = startLocal.plus({ days: 1 });
  return adjusted.toUTC();
}

function addBusinessDelay(base: DateTime, days: number, hours: number, businessOnly: boolean, timezone='America/Chicago'): DateTime {
  let dt = base.setZone(timezone).plus({ days, hours });
  if (!businessOnly) return dt.toUTC();
  // Move forward day-by-day skipping weekends if necessary
  while (!isBusinessDay(dt)) {
    dt = dt.plus({ days: 1 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
  }
  return dt.toUTC();
}

async function getSequenceWithSteps(sequenceId: string, userId: string) {
  const { data: sequence } = await supabaseDb
    .from('message_sequences')
    .select('*')
    .eq('id', sequenceId)
    .eq('owner_user_id', userId)
    .maybeSingle();
  if (!sequence) return null;
  const { data: steps } = await supabaseDb
    .from('message_sequence_steps')
    .select('*')
    .eq('sequence_id', sequenceId)
    .order('step_order', { ascending: true });
  return { sequence, steps: steps || [] };
}

// CRUD Sequences ------------------------------------------------------
router.post('/sequences', requireAuth, async (req: ApiRequest, res) => {
  try {
    const userId = req.user!.id;
    // Block for Free plan users
    try {
      const { data: sub } = await supabaseDb
        .from('subscriptions')
        .select('plan_tier')
        .eq('user_id', userId)
        .maybeSingle();
      const planTier = (sub?.plan_tier || '').toLowerCase();
      if (planTier === 'free') return res.status(403).json({ error: 'Sequences are available in paid plans.' });
    } catch {}
    const { name, description, stop_on_reply = true, send_window_start, send_window_end, throttle_per_hour, team_id, steps = [] } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { data: seq, error: seqErr } = await supabaseDb
      .from('message_sequences')
      .insert({ name, description, stop_on_reply, send_window_start, send_window_end, throttle_per_hour, team_id: team_id || null, owner_user_id: userId })
      .select('*')
      .single();
    if (seqErr) throw seqErr;

    if (Array.isArray(steps) && steps.length) {
      const stepRows = steps.map((s: any, idx: number) => ({
        sequence_id: seq.id,
        step_order: s.step_order ?? idx + 1,
        subject: s.subject || null,
        body: String(s.body || ''),
        delay_days: Number(s.delay_days || 0),
        delay_hours: Number(s.delay_hours || 0),
        send_only_business_days: Boolean(s.send_only_business_days || false)
      }));
      const { error: stepsErr } = await supabaseDb.from('message_sequence_steps').insert(stepRows);
      if (stepsErr) throw stepsErr;
    }

    const full = await getSequenceWithSteps(seq.id, userId);
    res.status(201).json(full);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to create sequence' });
  }
});

router.get('/sequences', requireAuth, async (req: ApiRequest, res) => {
  try {
    const userId = req.user!.id;
    // Hide sequences for Free plan users
    try {
      const { data: sub } = await supabaseDb
        .from('subscriptions')
        .select('plan_tier')
        .eq('user_id', userId)
        .maybeSingle();
      const planTier = (sub?.plan_tier || '').toLowerCase();
      if (planTier === 'free') return res.json([]);
    } catch {}
    const { team_id, include_steps } = req.query as any;
    let q = supabaseDb.from('message_sequences').select('*').eq('owner_user_id', userId).eq('is_archived', false);
    if (team_id) q = q.eq('team_id', team_id);
    const { data: sequences, error } = await q;
    if (error) throw error;
    if (!include_steps) return res.json(sequences || []);
    const ids = (sequences || []).map((s: any) => s.id);
    const { data: steps } = await supabaseDb
      .from('message_sequence_steps')
      .select('*')
      .in('sequence_id', ids);
    const grouped: Record<string, any[]> = {};
    for (const st of steps || []) {
      grouped[st.sequence_id] = grouped[st.sequence_id] || [];
      grouped[st.sequence_id].push(st);
    }
    const result = (sequences || []).map((s: any) => ({ ...s, steps: (grouped[s.id] || []).sort((a, b) => a.step_order - b.step_order) }));
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to list sequences' });
  }
});

router.get('/sequences/:id', requireAuth, async (req: ApiRequest, res) => {
  try {
    const userId = req.user!.id;
    const seq = await getSequenceWithSteps(req.params.id, userId);
    if (!seq) return res.status(404).json({ error: 'Not found' });
    res.json(seq);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to fetch sequence' });
  }
});
// Enrollments + metrics for a sequence detail page
router.get('/sequences/:id/enrollments', requireAuth, async (req: ApiRequest, res) => {
  try {
    const sequenceId = req.params.id;
    // Enrollments
    const { data: enrollments } = await supabaseDb
      .from('sequence_enrollments')
      .select('id, lead_id, status, current_step_order, last_sent_at, created_at')
      .eq('sequence_id', sequenceId)
      .order('created_at', { ascending: false });

    // Compute next_send_at for each via first pending run
    const ids = (enrollments || []).map((e:any)=>e.id);
    let nextSendByEnrollment: Record<string,string|null> = {};
    if (ids.length){
      const { data: runs } = await supabaseDb
        .from('sequence_step_runs')
        .select('enrollment_id, send_at, status')
        .in('enrollment_id', ids)
        .eq('status','pending')
        .order('send_at', { ascending: true });
      for (const r of runs||[]) if (!nextSendByEnrollment[r.enrollment_id]) nextSendByEnrollment[r.enrollment_id] = r.send_at;
    }
    const enrichedEnrollments = (enrollments||[]).map((e:any)=>({ ...e, next_send_at: nextSendByEnrollment[e.id] || null }));

    // Basic metrics from email_events/messages for now
    const { data: countEnroll } = await supabaseDb
      .from('sequence_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('sequence_id', sequenceId);
    const enrolled = countEnroll ? (countEnroll as any).length ?? countEnroll : null;

    // Sent approximated by step_runs sent
    const { data: sentRuns } = await supabaseDb
      .from('sequence_step_runs')
      .select('id', { count: 'exact', head: true })
      .eq('sequence_id', sequenceId)
      .eq('status','sent');
    const sent = sentRuns ? (sentRuns as any).length ?? sentRuns : null;

    // Replies from email_events reply
    const { data: replyEvents } = await supabaseDb
      .from('email_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type','reply');
    const replies = replyEvents ? (replyEvents as any).length ?? replyEvents : null;

    // Bounced from messages failed or email_events bounce
    const { data: bounceEvents } = await supabaseDb
      .from('email_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type','bounce');
    const bounced = bounceEvents ? (bounceEvents as any).length ?? bounceEvents : null;

    res.json({ enrollments: enrichedEnrollments, metrics: { enrolled, sent, replies, bounced } });
  } catch (e:any) {
    res.status(500).json({ error: e.message || 'Failed to load enrollments' });
  }
});

router.put('/sequences/:id', requireAuth, async (req: ApiRequest, res) => {
  try {
    const userId = req.user!.id;
    const sequenceId = req.params.id;
    const { name, description, stop_on_reply, send_window_start, send_window_end, throttle_per_hour, is_archived, steps } = req.body || {};

    // Update metadata
    const { error: updErr } = await supabaseDb
      .from('message_sequences')
      .update({
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(stop_on_reply !== undefined ? { stop_on_reply } : {}),
        ...(send_window_start !== undefined ? { send_window_start } : {}),
        ...(send_window_end !== undefined ? { send_window_end } : {}),
        ...(throttle_per_hour !== undefined ? { throttle_per_hour } : {}),
        ...(is_archived !== undefined ? { is_archived } : {})
      })
      .eq('id', sequenceId)
      .eq('owner_user_id', userId);
    if (updErr) throw updErr;

    if (Array.isArray(steps)) {
      // Fetch existing
      const { data: existing } = await supabaseDb
        .from('message_sequence_steps')
        .select('id')
        .eq('sequence_id', sequenceId);
      const existingIds = new Set((existing || []).map((s: any) => s.id));
      const incomingIds = new Set(steps.filter((s: any) => s.id).map((s: any) => s.id));

      // Delete removed
      const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
      if (toDelete.length) {
        await supabaseDb.from('message_sequence_steps').delete().in('id', toDelete);
      }

      // Upsert incoming
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        const row = {
          sequence_id: sequenceId,
          step_order: s.step_order ?? i + 1,
          subject: s.subject || null,
          body: String(s.body || ''),
          delay_days: Number(s.delay_days || 0),
          delay_hours: Number(s.delay_hours || 0),
          send_only_business_days: Boolean(s.send_only_business_days || false)
        } as any;
        if (s.id && existingIds.has(s.id)) {
          await supabaseDb.from('message_sequence_steps').update(row).eq('id', s.id);
        } else {
          await supabaseDb.from('message_sequence_steps').insert(row);
        }
      }
    }

    const full = await getSequenceWithSteps(sequenceId, userId);
    res.json(full);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to update sequence' });
  }
});

router.post('/sequences/:id/archive', requireAuth, async (req: ApiRequest, res) => {
  try {
    const userId = req.user!.id;
    const sequenceId = req.params.id;
    const { archive = true } = req.body || {};
    const { error } = await supabaseDb
      .from('message_sequences')
      .update({ is_archived: !!archive })
      .eq('id', sequenceId)
      .eq('owner_user_id', userId);
    if (error) throw error;
    res.json({ id: sequenceId, is_archived: !!archive });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to archive sequence' });
  }
});

// Enrollment ----------------------------------------------------------
router.post('/sequences/:id/enroll', requireAuth, async (req: ApiRequest, res) => {
  try {
    const userId = req.user!.id;
    // Block enrollment for Free plan users
    try {
      const { data: sub } = await supabaseDb
        .from('subscriptions')
        .select('plan_tier')
        .eq('user_id', userId)
        .maybeSingle();
      const planTier = (sub?.plan_tier || '').toLowerCase();
      if (planTier === 'free') return res.status(403).json({ error: 'Sequences are available in paid plans.' });
    } catch {}
    const sequenceId = req.params.id;
    const { leadIds, startTimeLocal, timezone, provider } = req.body || {};
    if (!Array.isArray(leadIds) || !leadIds.length) return res.status(400).json({ error: 'leadIds required' });

    const seqBundle = await getSequenceWithSteps(sequenceId, userId);
    if (!seqBundle || !seqBundle.steps.length) return res.status(404).json({ error: 'Sequence or steps not found' });
    const { sequence, steps } = seqBundle;

    const localStartIso = startTimeLocal || DateTime.now().setZone(timezone || 'America/Chicago').toISO();
    const baseUtcIso = toUtcFromLocal(localStartIso, timezone || 'America/Chicago');
    let baseUtc = DateTime.fromISO(baseUtcIso);

    // First step scheduling base with business-days and window
    const firstStep = steps[0];
    baseUtc = addBusinessDelay(baseUtc, firstStep.delay_days || 0, firstStep.delay_hours || 0, !!firstStep.send_only_business_days, 'America/Chicago');
    baseUtc = applyWindow(baseUtc, sequence.send_window_start, sequence.send_window_end, 'America/Chicago');

    // Create enrollments if missing and first runs
    const toInsertEnrollments: any[] = [];
    const toInsertRuns: any[] = [];

    let skippedCount = 0;
    for (const leadId of leadIds) {
      // Resolve lead IDs that may come from sourcing_leads by creating/finding a corresponding row in leads
      let resolvedLeadId: string | null = null;
      // 1) Check if the provided ID is already a valid leads.id
      const { data: leadRow } = await supabaseDb
        .from('leads')
        .select('id')
        .eq('id', leadId)
        .maybeSingle();
      if (leadRow?.id) {
        resolvedLeadId = leadRow.id;
      } else {
        // 2) Otherwise try to interpret it as sourcing_leads.id and upsert into leads
        const { data: sLead } = await supabaseDb
          .from('sourcing_leads')
          .select('email, name, title, company, linkedin_url, campaign_id')
          .eq('id', leadId)
          .maybeSingle();
        if (sLead) {
          // If the sourcing lead has an email, attempt to dedupe by (user_id,email)
          if (sLead.email) {
            const { data: existingByEmail } = await supabaseDb
              .from('leads')
              .select('id')
              .eq('user_id', userId)
              .eq('email', sLead.email)
              .maybeSingle();
            if (existingByEmail?.id) {
              resolvedLeadId = existingByEmail.id;
            } else {
              const insertPayload: any = {
                user_id: userId,
                name: sLead.name || sLead.email,
                email: sLead.email,
                title: sLead.title || null,
                company: sLead.company || null,
                linkedin_url: sLead.linkedin_url || null,
                // Important: leads.campaign_id references classic campaigns, not sourcing_campaigns
                // Avoid FK violation by leaving null (we can attach later when a classic campaign is chosen)
                campaign_id: null,
                source: 'sourcing_campaign'
              };
              const { data: created, error: createErr } = await supabaseDb
                .from('leads')
                .insert(insertPayload)
                .select('id')
                .single();
              if (createErr) throw createErr;
              resolvedLeadId = created.id;
            }
          } else {
            // No email present - skip enrollment for this lead as it cannot receive emails yet
            skippedCount += 1;
            continue;
          }
        } else {
          // Unknown lead ID
          skippedCount += 1;
          continue;
        }
      }

      // Upsert enrollment (unique sequence_id, lead_id)
      const { data: existing } = await supabaseDb
        .from('sequence_enrollments')
        .select('id, current_step_order')
        .eq('sequence_id', sequenceId)
        .eq('lead_id', resolvedLeadId as string)
        .maybeSingle();

      let enrollmentId: string | null = null;
      if (!existing) {
        const { data: ins, error: insErr } = await supabaseDb
          .from('sequence_enrollments')
          .insert({ sequence_id: sequenceId, lead_id: resolvedLeadId as string, enrolled_by_user_id: userId, status: 'active', current_step_order: 1, provider: provider || null })
          .select('id')
          .single();
        if (insErr) throw insErr;
        enrollmentId = ins.id;
      } else {
        enrollmentId = existing.id;
        // If lead existed but had no campaign_id, previously attempted to copy from sourcing_leads.campaign_id
        // That value points to sourcing_campaigns and violates the leads.campaign_id FK to campaigns.
        // Skip this backfill to avoid FK errors; classic campaign association can be added explicitly elsewhere.
        try {
          // no-op backfill
        } catch {}
        // Update provider if specified
        if (provider) {
          await supabaseDb
            .from('sequence_enrollments')
            .update({ provider })
            .eq('id', enrollmentId);
        }
      }

      if (enrollmentId) {
        toInsertRuns.push({
          enrollment_id: enrollmentId,
          sequence_id: sequenceId,
          step_id: firstStep.id,
          step_order: firstStep.step_order,
          send_at: baseUtc.toISO(),
          status: 'pending'
        });
      }
    }

    if (toInsertRuns.length) {
      const { error: runsErr } = await supabaseDb.from('sequence_step_runs').insert(toInsertRuns);
      if (runsErr) throw runsErr;
    }

    try {
      // Slack notify on launch
      // Derive campaign from first valid lead
      let campaignName = 'Campaign';
      let campaignId: string | null = null;
      try {
        const firstLeadId = (leadIds || [])[0];
        if (firstLeadId) {
          const { data: lrow } = await supabaseDb.from('leads').select('campaign_id').eq('id', firstLeadId).maybeSingle();
          campaignId = (lrow as any)?.campaign_id || null;
          if (campaignId) {
            const { data: crow } = await supabaseDb.from('sourcing_campaigns').select('title').eq('id', campaignId).maybeSingle();
            campaignName = (crow as any)?.title || campaignName;
          }
        }
      } catch {}
      const firstTime = baseUtc.toISO();
      await notifySlack(`📣 Sequence launched: *${campaignName}*${campaignId ? ` (${campaignId})` : ''}\nEnrolled ${leadIds.length - skippedCount} leads • First send: ${firstTime}`);
    } catch (e) {
      console.warn('[sequences/enroll] Slack notify failed', e);
    }

    res.status(201).json({ enrolled: leadIds.length - skippedCount, skipped: skippedCount, first_send_at: baseUtc.toISO() });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to enroll leads' });
  }
});

router.post('/enrollments/:id/pause', requireAuth, async (req: ApiRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { error } = await supabaseDb
      .from('sequence_enrollments')
      .update({ status: 'paused' })
      .eq('id', id)
      .or(`enrolled_by_user_id.eq.${userId}`);
    if (error) throw error;
    res.json({ id, status: 'paused' });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to pause enrollment' });
  }
});

router.post('/enrollments/:id/resume', requireAuth, async (req: ApiRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { error } = await supabaseDb
      .from('sequence_enrollments')
      .update({ status: 'active' })
      .eq('id', id)
      .or(`enrolled_by_user_id.eq.${userId}`);
    if (error) throw error;
    res.json({ id, status: 'active' });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to resume enrollment' });
  }
});

router.post('/enrollments/:id/cancel', requireAuth, async (req: ApiRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { error } = await supabaseDb
      .from('sequence_enrollments')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .or(`enrolled_by_user_id.eq.${userId}`);
    if (error) throw error;
    res.json({ id, status: 'cancelled' });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to cancel enrollment' });
  }
});

router.get('/enrollments/:id', requireAuth, async (req: ApiRequest, res) => {
  try {
    const { id } = req.params;
    const { data: enrollment } = await supabaseDb
      .from('sequence_enrollments')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!enrollment) return res.status(404).json({ error: 'Not found' });
    const { data: runs } = await supabaseDb
      .from('sequence_step_runs')
      .select('*')
      .eq('enrollment_id', id)
      .order('send_at', { ascending: true });
    res.json({ enrollment, runs: runs || [] });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to get enrollment' });
  }
});

// Convenience: get enrollment by lead for drawer
router.get('/sequence-enrollments/by-lead/:leadId', requireAuth, async (req: ApiRequest, res) => {
  try {
    const userId = req.user!.id;
    const leadId = req.params.leadId;
    const { data: enr } = await supabaseDb
      .from('sequence_enrollments')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!enr) return res.json({ enrollment: null, runs: [] });
    const { data: runs } = await supabaseDb
      .from('sequence_step_runs')
      .select('*')
      .eq('enrollment_id', enr.id)
      .order('send_at', { ascending: true });
    res.json({ enrollment: enr, runs: runs || [] });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to fetch enrollment' });
  }
});

// Reply Hook ----------------------------------------------------------
router.post('/sequences/reply-hook', async (req, res) => {
  try {
    const { leadId, occurredAt } = req.body || {};
    if (!leadId) return res.status(400).json({ error: 'leadId required' });
    // Find active enrollments with stop_on_reply
    const { data: enrollments } = await supabaseDb
      .from('sequence_enrollments')
      .select('id, sequence_id')
      .eq('lead_id', leadId)
      .eq('status', 'active');
    if (!enrollments || !enrollments.length) return res.json({ updated: 0 });

    // Load sequences to check stop_on_reply
    const seqIds = enrollments.map((e: any) => e.sequence_id);
    const { data: sequences } = await supabaseDb
      .from('message_sequences')
      .select('id, stop_on_reply')
      .in('id', seqIds);
    const stopSet = new Set((sequences || []).filter((s: any) => s.stop_on_reply).map((s: any) => s.id));

    const affected = enrollments.filter((e: any) => stopSet.has(e.sequence_id));
    if (!affected.length) return res.json({ updated: 0 });

    const ids = affected.map((e: any) => e.id);
    await supabaseDb
      .from('sequence_enrollments')
      .update({ status: 'completed', completed_at: occurredAt || new Date().toISOString() })
      .in('id', ids);

    // Skip all future pending runs
    await supabaseDb
      .from('sequence_step_runs')
      .update({ status: 'skipped' })
      .in('enrollment_id', ids)
      .eq('status', 'pending');

    res.json({ updated: ids.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to process reply hook' });
  }
});

export default router;


