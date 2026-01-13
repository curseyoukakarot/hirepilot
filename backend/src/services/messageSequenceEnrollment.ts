import { DateTime } from 'luxon';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { personalizeMessage } from '../../utils/messageUtils';

type EnrollOpts = {
  userId: string;
  sequenceId: string;
  leadIds: string[];
  /**
   * Base time in UTC ISO when the sequence is considered "started".
   * The first step's delay/window rules will be applied on top of this.
   */
  startAtUtcIso?: string;
  timezone?: string; // for window/business-day calculations
  provider?: string | null;
  bcc?: string | string[] | null;
};

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

function normalizeBccInput(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = Array.isArray(value) ? value : String(value).split(/[,;\n]/);
  const cleaned = Array.from(new Set(raw.map(v => v.trim()).filter(Boolean)));
  return cleaned.length ? cleaned.join(',') : null;
}

async function getSequenceWithSteps(sequenceId: string, userId: string) {
  const { data: sequence } = await supabaseAdmin
    .from('message_sequences')
    .select('*')
    .eq('id', sequenceId)
    .eq('owner_user_id', userId)
    .maybeSingle();
  if (!sequence) return null;
  const { data: steps } = await supabaseAdmin
    .from('message_sequence_steps')
    .select('*')
    .eq('sequence_id', sequenceId)
    .order('step_order', { ascending: true });
  return { sequence, steps: steps || [] };
}

async function resolveLeadIdForEnrollment(userId: string, inputLeadId: string): Promise<string | null> {
  // 1) Already a base leads.id?
  const { data: leadRow } = await supabaseAdmin
    .from('leads')
    .select('id')
    .eq('id', inputLeadId)
    .maybeSingle();
  if (leadRow?.id) return leadRow.id;

  // 2) Otherwise attempt to interpret as sourcing_leads.id and upsert into leads
  const { data: sLead } = await supabaseAdmin
    .from('sourcing_leads')
    .select('email, name, title, company, linkedin_url')
    .eq('id', inputLeadId)
    .maybeSingle();
  if (!sLead) return null;

  // Skip if no email
  if (!sLead.email) return null;

  const email = String(sLead.email).trim().toLowerCase();
  const { data: existingByEmail } = await supabaseAdmin
    .from('leads')
    .select('id')
    .eq('user_id', userId)
    .eq('email', email)
    .maybeSingle();
  if (existingByEmail?.id) return existingByEmail.id;

  const insertPayload: any = {
    user_id: userId,
    name: sLead.name || email,
    email,
    title: sLead.title || null,
    company: sLead.company || null,
    linkedin_url: sLead.linkedin_url || null,
    campaign_id: null,
    source: 'sourcing_campaign'
  };
  const { data: created, error: createErr } = await supabaseAdmin
    .from('leads')
    .insert(insertPayload)
    .select('id')
    .single();
  if (createErr) throw createErr;
  return created.id;
}

async function ensureFirstStepRun(opts: { enrollmentId: string; sequenceId: string; stepId: string; stepOrder: number; sendAtUtcIso: string; }) {
  // Avoid duplicates if enrollment already has a step1 run (pending/sent).
  const { data: existing } = await supabaseAdmin
    .from('sequence_step_runs')
    .select('id,status')
    .eq('enrollment_id', opts.enrollmentId)
    .eq('step_order', opts.stepOrder)
    .in('status', ['pending','sent'])
    .maybeSingle();
  if (existing?.id) return false;

  const { error } = await supabaseAdmin
    .from('sequence_step_runs')
    .insert({
      enrollment_id: opts.enrollmentId,
      sequence_id: opts.sequenceId,
      step_id: opts.stepId,
      step_order: opts.stepOrder,
      send_at: opts.sendAtUtcIso,
      status: 'pending'
    });
  if (error) throw error;
  return true;
}

export async function enrollLeadsInMessageSequence(opts: EnrollOpts): Promise<{ enrolled: number; skipped: number; first_send_at: string | null }> {
  const timezone = opts.timezone || 'America/Chicago';
  const seqBundle = await getSequenceWithSteps(opts.sequenceId, opts.userId);
  if (!seqBundle || !seqBundle.steps.length) {
    throw new Error('sequence_or_steps_not_found');
  }

  const { sequence, steps } = seqBundle as any;
  const firstStep = steps[0];
  const startAtUtcIso = opts.startAtUtcIso || new Date().toISOString();
  let baseUtc = DateTime.fromISO(startAtUtcIso, { zone: 'utc' });
  if (!baseUtc.isValid) baseUtc = DateTime.utc();

  // Apply first-step delay in the user's timezone; then normalize rules back to UTC.
  const localBase = baseUtc.setZone(timezone).plus({
    days: Number(firstStep.delay_days || 0),
    hours: Number(firstStep.delay_hours || 0),
  });
  const adjustedLocal = applyBusinessDayRule(localBase, !!firstStep.send_only_business_days);
  baseUtc = applyWindow(adjustedLocal.toUTC(), sequence.send_window_start, sequence.send_window_end, timezone);

  const provider = opts.provider ?? null;
  const bccProvided = Object.prototype.hasOwnProperty.call(opts, 'bcc');
  const normalizedBcc = bccProvided ? normalizeBccInput(opts.bcc) : undefined;

  let enrolled = 0;
  let skipped = 0;
  for (const inputLeadId of opts.leadIds || []) {
    const resolvedLeadId = await resolveLeadIdForEnrollment(opts.userId, inputLeadId);
    if (!resolvedLeadId) {
      skipped += 1;
      continue;
    }

    // Upsert enrollment (best-effort idempotency by checking existing first)
    const { data: existingEnrollment } = await supabaseAdmin
      .from('sequence_enrollments')
      .select('id,status')
      .eq('sequence_id', opts.sequenceId)
      .eq('lead_id', resolvedLeadId)
      .maybeSingle();

    let enrollmentId: string;
    if (!existingEnrollment?.id) {
      const insertPayload: Record<string, any> = {
        sequence_id: opts.sequenceId,
        lead_id: resolvedLeadId,
        enrolled_by_user_id: opts.userId,
        status: 'active',
        current_step_order: 1,
        provider: provider || null
      };
      if (bccProvided) insertPayload.bcc = normalizedBcc ?? null;
      const { data: ins, error: insErr } = await supabaseAdmin
        .from('sequence_enrollments')
        .insert(insertPayload)
        .select('id')
        .single();
      if (insErr) throw insErr;
      enrollmentId = ins.id;
    } else {
      enrollmentId = existingEnrollment.id;
      const updatePayload: Record<string, any> = {};
      if (provider) updatePayload.provider = provider;
      if (bccProvided) updatePayload.bcc = normalizedBcc ?? null;
      if (Object.keys(updatePayload).length) {
        await supabaseAdmin
          .from('sequence_enrollments')
          .update(updatePayload)
          .eq('id', enrollmentId);
      }
      // If enrollment was not active, reactivate for schedule-driven kickoffs.
      if (existingEnrollment.status !== 'active') {
        await supabaseAdmin
          .from('sequence_enrollments')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', enrollmentId);
      }
    }

    // Ensure step 1 run exists
    const createdRun = await ensureFirstStepRun({
      enrollmentId,
      sequenceId: opts.sequenceId,
      stepId: firstStep.id,
      stepOrder: firstStep.step_order,
      sendAtUtcIso: baseUtc.toISO() as string
    });
    if (createdRun) enrolled += 1;
    else skipped += 1;
  }

  // Best-effort activity log via a message preview render (cheap signal)
  try {
    const { data: stepRow } = await supabaseAdmin
      .from('message_sequence_steps')
      .select('subject,body')
      .eq('id', firstStep.id)
      .maybeSingle();
    if (stepRow?.body && enrolled > 0) {
      // noop: keep import to avoid TS unused errors in some builds; also a cheap sanity render
      personalizeMessage(stepRow.body, { name: 'Test', company: 'TestCo', title: 'Test' } as any);
    }
  } catch {}

  return { enrolled, skipped, first_send_at: baseUtc.toISO() };
}

