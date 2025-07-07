import { resetStuckPhantoms } from './resetStuckPhantoms';
import { supabaseDb } from '../lib/supabase';

// Import queue/launch helpers – gracefully handle missing helper to keep server alive
let launchPhantom: any,
  getPhantomCooldown: any,
  getPhantomHealth: any,
  getPhantomJobHistory: any,
  logPhantomHealth: any,
  checkPhantomHealth: any;

try {
  ({
    launchPhantom,
    getPhantomCooldown,
    getPhantomHealth,
    getPhantomJobHistory,
    logPhantomHealth,
    checkPhantomHealth
  } = require('../lib/phantom'));
} catch (e) {
  console.error('[cron] Phantom helper missing – cron jobs will be disabled until the helper is restored.', e);
  // Provide safe fall-backs so the rest of the API can boot without crashing
  launchPhantom = async () => {
    console.warn('[cron] launchPhantom called but helper is unavailable.');
    return null;
  };
  getPhantomCooldown = async () => null;
  getPhantomHealth = async () => null;
  getPhantomJobHistory = async () => [];
  logPhantomHealth = async () => undefined;
  checkPhantomHealth = async () => undefined;
}

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
      const sent=await sendProvider.sendEmail(leadRes.data,msg.content,msg.user_id,msg.sender_meta);
      await supabaseDb.from('messages').update({ status: sent?'sent':'failed', sent_at:new Date().toISOString() }).eq('id',msg.id);
    }catch(e){
      console.error('[processScheduledMessages]',e);
      await supabaseDb.from('messages').update({ status:'failed'}).eq('id',msg.id);
    }
  }
}

export function startCronJobs() {
  console.log('[cron] Starting cron jobs...');

  async function runAndReschedule() {
    await resetStuckPhantoms();
    await generateDailyPhantomJobs();
    await processPhantomJobQueue();
    await processScheduledMessages();
    const nextInterval = randomIntervalMs();
    console.log(`[cron] Next run in ${nextInterval / 60000} minutes`);
    setTimeout(runAndReschedule, nextInterval);
  }

  // Run immediately on startup
  runAndReschedule();

  console.log('[cron] Cron jobs started');
} 