import { resetStuckPhantoms } from './resetStuckPhantoms';
import { monitorCampaignExecutions } from './monitorCampaignExecutions';
import { supabaseDb } from '../lib/supabase';
import { notifySlack } from '../lib/slack';
import { personalizeMessage } from '../utils/messageUtils';
import { DateTime } from 'luxon';

// Import phantom helper functions
import {
  launchPhantom,
  getPhantomCooldown,
  getPhantomHealth,
  getPhantomJobHistory,
  logPhantomHealth,
  checkPhantomHealth
} from '../lib/phantom';

function randomIntervalMs(minMinutes = 5, maxMinutes = 15) {
  return (Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes) * 60 * 1000;
}

function randomizeRunTimes(start: Date, end: Date, count: number, offset: number): Date[] {
  // start/end: Date objects for today, count: runs_per_day, offset: max random offset in minutes
  const times: Date[] = [];
  const windowMinutes = (end.getTime() - start.getTime()) / 60000;
  let last = start.getTime();
  for (let i = 0; i < count; i++) {
    // Randomly space runs within window
    const min = last + 10 * 60 * 1000; // at least 10 min after last
    const max = end.getTime() - (count - i - 1) * 10 * 60 * 1000;
    let t = Math.floor(Math.random() * (max - min + 1)) + min;
    // Add random offset
    t += (Math.floor(Math.random() * (2 * offset + 1)) - offset) * 60000;
    t = Math.max(start.getTime(), Math.min(t, end.getTime()));
    times.push(new Date(t));
    last = t;
  }
  return times;
}

export async function generateDailyPhantomJobs() {
  const today = new Date();
  today.setHours(0,0,0,0);
  const { data: schedules } = await supabaseDb.from('phantom_schedules').select('*');
  for (const sched of schedules || []) {
    // Check if phantom/account is in cooldown
    const cooldown = await getPhantomCooldown(sched.phantom_id);
    if (cooldown && cooldown.cooldown_until && new Date(cooldown.cooldown_until) > new Date()) {
      continue; // skip if in cooldown
    }
    // Adaptive pacing: check job history for today
    const jobHistory = await getPhantomJobHistory(sched.phantom_id);
    const jobsToday = (jobHistory || []).filter((j: any) => j.next_run_at && new Date(j.next_run_at) >= today);
    if (jobsToday.length >= sched.runs_per_day) continue;
    // Generate run times
    const [h1, m1] = sched.run_window_start.split(':').map(Number);
    const [h2, m2] = sched.run_window_end.split(':').map(Number);
    const start = new Date(today); start.setHours(h1, m1, 0, 0);
    const end = new Date(today); end.setHours(h2, m2, 0, 0);
    const times = randomizeRunTimes(start, end, sched.runs_per_day, sched.random_offset_minutes);
    for (const t of times) {
      // Only insert if not already scheduled
      if (!jobsToday.find((j: any) => Math.abs(new Date(j.next_run_at).getTime() - t.getTime()) < 5 * 60 * 1000)) {
        await supabaseDb.from('phantom_job_queue').insert({
          schedule_id: sched.schedule_id,
          account_id: sched.account_id,
          phantom_id: sched.phantom_id,
          next_run_at: t.toISOString(),
          status: 'pending'
        });
      }
    }
  }
}

export async function processPhantomJobQueue() {
  const now = new Date().toISOString();
  // Get all jobs ready to run
  const { data: jobs } = await supabaseDb
    .from('phantom_job_queue')
    .select('*')
    .lte('next_run_at', now)
    .eq('status', 'pending');
  for (const job of jobs || []) {
    // Check if account/phantom is in cooldown
    const cooldown = await getPhantomCooldown(job.phantom_id);
    if (cooldown && cooldown.cooldown_until && new Date(cooldown.cooldown_until) > new Date()) {
      await supabaseDb.from('phantom_job_queue').update({ status: 'skipped', updated_at: new Date().toISOString() }).eq('job_id', job.job_id);
      continue;
    }
    // Check if account is running
    const { data: running } = await supabaseDb
      .from('phantom_launch_queue')
      .select('queue_id')
      .eq('account_id', job.account_id)
      .eq('status', 'running')
      .maybeSingle();
    if (running) continue; // skip if running
    // Humanized launch: call launchPhantom for this job
    try {
      await supabaseDb.from('phantom_job_queue').update({ status: 'running', updated_at: new Date().toISOString() }).eq('job_id', job.job_id);
      const result = await launchPhantom(job.phantom_id, {}); // Add config as needed
      // Log health status and check for errors
      const healthLog = await logPhantomHealth(job.phantom_id, job.job_id, result ? 'success' : 'error', result || { error: 'Launch failed' });
      if (!result) {
        await checkPhantomHealth(job.phantom_id, job.job_id, 'error', { error: 'Launch failed' });
        // Slack alert for error
        console.log(`[Slack Alert] Phantom ${job.phantom_id} launch failed. Cooldown set.`);
      }
      await supabaseDb.from('phantom_job_queue').update({ status: result ? 'completed' : 'failed', updated_at: new Date().toISOString(), result: result ? JSON.stringify(result) : null }).eq('job_id', job.job_id);
    } catch (e: any) {
      await supabaseDb.from('phantom_job_queue').update({ status: 'failed', updated_at: new Date().toISOString(), result: JSON.stringify({ error: e.message }) }).eq('job_id', job.job_id);
      // Log health status and check for errors
      await logPhantomHealth(job.phantom_id, job.job_id, 'error', { error: e.message });
      await checkPhantomHealth(job.phantom_id, job.job_id, 'error', { error: e.message });
      // Slack alert for error
      console.log(`[Slack Alert] Phantom ${job.phantom_id} launch error: ${e.message}. Cooldown set.`);
    }
  }
}

export async function processScheduledMessages(){
  const now=new Date().toISOString();
  const { data: msgs } = await supabaseDb
    .from('messages')
    .select('*')
    .eq('status','scheduled')
    .lte('scheduled_at',now);
  for(const msg of msgs||[]){
    try{
      const leadRes=await supabaseDb.from('leads').select('*').eq('id',msg.lead_id).single();
      if(leadRes.error||!leadRes.data){
        await supabaseDb.from('messages').update({ status:'failed'}).eq('id',msg.id);
        continue;
      }
      const sendProvider=require('../services/emailProviderService');
      // Use stored subject if present; fall back to parsing handled inside service
      const explicitSubject = (msg as any)?.subject || undefined;
      const sent=await sendProvider.sendEmail(leadRes.data,msg.content,msg.user_id,explicitSubject);
      await supabaseDb.from('messages').update({ status: sent?'sent':'failed', sent_at:new Date().toISOString() }).eq('id',msg.id);
    }catch(e){
      console.error('[processScheduledMessages]',e);
      await supabaseDb.from('messages').update({ status:'failed'}).eq('id',msg.id);
    }
  }
}

// -----------------------------------------------------------------------------
// Sequence Step Dispatcher
// -----------------------------------------------------------------------------
export async function processSequenceStepRuns(){
  const nowIso = new Date().toISOString();
  // Fetch due runs
  const { data: runs } = await supabaseDb
    .from('sequence_step_runs')
    .select('id,enrollment_id,sequence_id,step_id,step_order,send_at,status,retry_count')
    .eq('status','pending')
    .lte('send_at', nowIso)
    .order('send_at', { ascending: true });

  if (!runs || !runs.length) return;

  // Prefetch enrollments and sequences for throttle/window rules
  const enrollmentIds = Array.from(new Set(runs.map((r:any)=>r.enrollment_id)));
  const { data: enrollments } = await supabaseDb
    .from('sequence_enrollments')
    .select('id,sequence_id,lead_id,status,current_step_order')
    .in('id', enrollmentIds);
  const enrollmentById: Record<string, any> = {};
  for (const e of enrollments || []) enrollmentById[e.id]=e;

  const sequenceIds = Array.from(new Set((enrollments||[]).map((e:any)=>e.sequence_id)));
  const { data: sequences } = await supabaseDb
    .from('message_sequences')
    .select('id,team_id,throttle_per_hour,send_window_start,send_window_end')
    .in('id', sequenceIds);
  const seqById: Record<string, any> = {};
  for (const s of sequences || []) seqById[s.id]=s;

  // Throttle per team if needed
  const teamThrottle: Record<string, { limit:number, sentLastHour:number }> = {};
  const teamIds = Array.from(new Set((sequences||[]).map((s:any)=>s.team_id).filter(Boolean)));
  if (teamIds.length){
    const oneHourAgo = new Date(Date.now()-60*60*1000).toISOString();
    const { data: sent } = await supabaseDb
      .from('messages')
      .select('id, user_id, sent_at')
      .gte('sent_at', oneHourAgo);
    // Without a direct team mapping in messages, conservatively apply throttle after per-run check below.
    for (const s of sequences||[]) {
      const lim = Number(s.throttle_per_hour||0);
      if (lim>0) teamThrottle[s.team_id||`seq-${s.id}`] = { limit: lim, sentLastHour: 0 };
    }
  }

  for (const run of runs){
    try{
      const enrollment = enrollmentById[run.enrollment_id];
      if (!enrollment || enrollment.status !== 'active') {
        await supabaseDb.from('sequence_step_runs').update({ status: 'skipped', updated_at: new Date().toISOString() }).eq('id', run.id);
        continue;
      }
      const seq = seqById[enrollment.sequence_id];

      // Throttle: if limit hit, delay +15 min
      if (seq && seq.throttle_per_hour){
        const key = seq.team_id || `seq-${seq.id}`;
        const bucket = teamThrottle[key];
        if (bucket && bucket.limit>0 && bucket.sentLastHour >= bucket.limit){
          await supabaseDb.from('sequence_step_runs').update({ send_at: new Date(Date.now()+15*60*1000).toISOString() }).eq('id', run.id);
          continue;
        }
      }

      // Get step and lead
      const { data: step } = await supabaseDb
        .from('message_sequence_steps')
        .select('*')
        .eq('id', run.step_id)
        .maybeSingle();
      if (!step){
        await supabaseDb.from('sequence_step_runs').update({ status:'failed', error_text:'step not found' }).eq('id', run.id);
        continue;
      }
      const { data: leadRes } = await supabaseDb.from('leads').select('*').eq('id', enrollment.lead_id).maybeSingle();
      if (!leadRes){
        await supabaseDb.from('sequence_step_runs').update({ status:'failed', error_text:'lead not found' }).eq('id', run.id);
        continue;
      }

      // Render content
      const body = personalizeMessage(step.body || '', leadRes);
      const subject = step.subject ? personalizeMessage(step.subject, leadRes) : undefined;

      // Determine provider for this enrollment if specified; else fall back to default service
      let sent = false;
      const preferredProvider = (enrollment as any)?.provider as string | undefined;
      if (preferredProvider && ['sendgrid','google','gmail','outlook'].includes(preferredProvider)) {
        const { sendViaProvider } = await import('../services/providerEmail');
        const subj = step.subject ? personalizeMessage(step.subject, leadRes) : 'Message from HirePilot';
        sent = await sendViaProvider(preferredProvider as any, leadRes, body, leadRes.user_id, subj);
      } else {
        const ep = await import('../services/emailProviderService');
        sent = await ep.sendEmail(leadRes, body, leadRes.user_id, subject);
      }

      if (!sent){
        const retryCount = Number(run.retry_count || 0);
        if (retryCount < 2) {
          await supabaseDb.from('sequence_step_runs').update({ retry_count: retryCount + 1, send_at: new Date(Date.now()+15*60*1000).toISOString(), updated_at: new Date().toISOString() }).eq('id', run.id);
        } else {
          await supabaseDb.from('sequence_step_runs').update({ status:'failed', updated_at: new Date().toISOString(), error_text: 'send failed' }).eq('id', run.id);
        }
        continue;
      }

      // Mark sent and update enrollment
      await supabaseDb.from('sequence_step_runs').update({ status:'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', run.id);
      await supabaseDb.from('sequence_enrollments').update({ last_sent_at: new Date().toISOString(), current_step_order: run.step_order }).eq('id', enrollment.id);

      // Schedule next step if any
      const { data: nextStep } = await supabaseDb
        .from('message_sequence_steps')
        .select('*')
        .eq('sequence_id', enrollment.sequence_id)
        .gt('step_order', run.step_order)
        .order('step_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (nextStep){
        const sentLocal = DateTime.fromISO(new Date().toISOString()).setZone('America/Chicago');
        // Add delay
        let base = sentLocal.plus({ days: nextStep.delay_days||0, hours: nextStep.delay_hours||0 });
        // Business-day rule
        if (nextStep.send_only_business_days) {
          while (base.weekday > 5) {
            base = base.plus({ days: 1 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
          }
        }
        const [sH, sM] = (seq?.send_window_start || '00:00').split(':').map(Number);
        const [eH, eM] = (seq?.send_window_end || '23:59').split(':').map(Number);
        let local = base;
        const startLocal = local.set({ hour: sH, minute: sM, second: 0, millisecond: 0 });
        const endLocal = local.set({ hour: eH, minute: eM, second: 59, millisecond: 0 });
        if (local < startLocal) local = startLocal;
        if (local > endLocal) local = startLocal.plus({ days: 1 });
        const sendAtUtc = local.toUTC().toISO();
        await supabaseDb.from('sequence_step_runs').insert({
          enrollment_id: enrollment.id,
          sequence_id: enrollment.sequence_id,
          step_id: nextStep.id,
          step_order: nextStep.step_order,
          send_at: sendAtUtc,
          status: 'pending'
        });
      } else {
        await supabaseDb.from('sequence_enrollments').update({ status:'completed', completed_at: new Date().toISOString() }).eq('id', enrollment.id);
      }

    }catch(e:any){
      await supabaseDb.from('sequence_step_runs').update({ status:'failed', error_text: e.message||'error' }).eq('id', run.id);
    }
  }
}

export function startCronJobs() {
  console.log('[cron] Starting cron jobs...');

  async function runAndReschedule() {
    await resetStuckPhantoms();
    await monitorCampaignExecutions(); // Monitor campaign executions for PhantomBuster completion
    await generateDailyPhantomJobs();
    await processPhantomJobQueue();
    await processScheduledMessages();
    await processSequenceStepRuns();
    // Weekly campaign performance digest (runs once per day; digest logic checks last sent time)
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const { data: campaigns } = await supabaseDb
        .from('sourcing_campaigns')
        .select('id,title,created_by,status')
        .eq('status', 'running');
      for (const c of campaigns || []) {
        try {
          // Basic metrics from email_events
          const { count: sent } = await supabaseDb
            .from('email_events')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', c.id)
            .eq('event_type', 'sent')
            .gte('created_at', oneWeekAgo.toISOString());
          const { count: replies } = await supabaseDb
            .from('email_events')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', c.id)
            .eq('event_type', 'reply')
            .gte('created_at', oneWeekAgo.toISOString());
          // Meetings booked: placeholder - count messages tagged calendar_scheduled
          const { count: meetings } = await supabaseDb
            .from('email_events')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', c.id)
            .eq('event_type', 'calendar_scheduled')
            .gte('created_at', oneWeekAgo.toISOString());

          // Avoid duplicate digests: store last_digest_at in campaign
          const { data: meta } = await supabaseDb
            .from('sourcing_campaigns')
            .select('last_digest_at')
            .eq('id', c.id)
            .maybeSingle();
          const lastDigest = meta?.last_digest_at ? new Date(meta.last_digest_at) : null;
          const sevenDays = 7 * 24 * 60 * 60 * 1000;
          if (!lastDigest || Date.now() - lastDigest.getTime() > sevenDays) {
            await notifySlack(`📊 Weekly update: *${c.title}*\nSent: ${Number(sent || 0)} • Replies: ${Number(replies || 0)} • Meetings: ${Number(meetings || 0)}\nReply here or use /rex to adjust next week.`);
            await supabaseDb
              .from('sourcing_campaigns')
              .update({ last_digest_at: new Date().toISOString() })
              .eq('id', c.id);
          }
        } catch {}
      }
    } catch {}
    // Weekly REX check-in: once a week per user
    try {
      const { supabaseDb } = require('../lib/supabase');
      const { data: users } = await supabaseDb.from('users').select('id');
      for (const u of users || []) {
        try { await fetch(`${process.env.BACKEND_BASE_URL || 'http://localhost:8080'}/api/rex/checkin`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ userId: u.id }) }); } catch {}
      }
    } catch {}
    const nextInterval = randomIntervalMs();
    console.log(`[cron] Next run in ${nextInterval / 60000} minutes`);
    setTimeout(runAndReschedule, nextInterval);
  }

  // Run immediately on startup
  runAndReschedule();

  console.log('[cron] Cron jobs started');
} 