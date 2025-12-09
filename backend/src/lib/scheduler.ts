import { supabaseAdmin } from './supabaseAdmin';
import { parseNextRun } from './cron';
import { ScheduleRow } from '../types/agentMode';

export async function getDueJobs(now: Date = new Date()): Promise<ScheduleRow[]> {
  const { data, error } = await supabaseAdmin
    .from('schedules')
    .select('*')
    .eq('status', 'active')
    .or(`next_run_at.lte.${now.toISOString()},and(next_run_at.is.null,run_at.lte.${now.toISOString()})`);
  if (error) throw new Error(error.message);
  return (data || []) as unknown as ScheduleRow[];
}

export function computeNextRun(job: ScheduleRow): string | null {
  if (job.schedule_kind === 'recurring' && job.cron_expr) {
    const next = parseNextRun(job.cron_expr, new Date());
    return next ? next.toISOString() : null;
  }
  return null; // one-time jobs have no next run after execution
}

export async function markRun(jobId: string, opts: { ranAt: Date; nextRunAt: Date | null; runResult: any }) {
  const { error } = await supabaseAdmin
    .from('schedules')
    .update({ last_run_at: opts.ranAt.toISOString(), next_run_at: opts.nextRunAt, status: opts.nextRunAt ? 'active' : 'completed', updated_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) throw new Error(error.message);
}

type ScheduleInput = {
  name: string;
  action_type: 'source_via_persona' | 'launch_campaign' | 'send_sequence' | 'persona_with_auto_outreach';
  persona_id?: string | null;
  campaign_id?: string | null;
  linked_persona_id?: string | null;
  linked_campaign_id?: string | null;
  auto_outreach_enabled?: boolean;
  leads_per_run?: number | null;
  send_delay_minutes?: number | null;
  daily_send_cap?: number | null;
  payload?: any;
  schedule_kind: 'one_time' | 'recurring';
  cron_expr?: string | null;
  run_at?: string | null;
};

export async function scheduleFromPayload(userId: string, input: ScheduleInput): Promise<ScheduleRow> {
  // compute initial next_run_at
  let nextRunAt: string | null = null;
  if (input.schedule_kind === 'recurring') {
    const next = input.cron_expr ? parseNextRun(input.cron_expr) : null;
    nextRunAt = next ? next.toISOString() : null;
  } else if (input.schedule_kind === 'one_time') {
    nextRunAt = input.run_at || null;
  }

  const payload = input.payload || {};

  const { data, error } = await supabaseAdmin
    .from('schedules')
    .insert({
      user_id: userId,
      name: input.name,
      action_type: input.action_type,
      persona_id: input.persona_id || null,
      campaign_id: input.campaign_id || null,
      linked_persona_id: input.linked_persona_id ?? input.persona_id ?? null,
      linked_campaign_id: input.linked_campaign_id ?? input.campaign_id ?? null,
      auto_outreach_enabled: Boolean(input.auto_outreach_enabled),
      leads_per_run: input.leads_per_run ?? 50,
      send_delay_minutes: input.send_delay_minutes ?? 0,
      daily_send_cap: input.daily_send_cap ?? null,
      payload,
      schedule_kind: input.schedule_kind,
      cron_expr: input.cron_expr || null,
      run_at: input.run_at || null,
      next_run_at: nextRunAt,
      status: 'active'
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as ScheduleRow;
}


