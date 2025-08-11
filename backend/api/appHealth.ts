import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../src/services/supabase';
import { getMetrics } from '../metrics/appMetrics';

export default async function appHealth(req: Request, res: Response) {
  const result: any = {};
  try {
    // Supabase ping
    const t0 = Date.now();
    // lightweight query: head count on users table
    const { error: dbErr } = await supabase
      .from('users')
      .select('id', { head: true, count: 'exact' })
      .limit(1);
    const latency = Date.now() - t0;
    result.supabase = { status: dbErr ? 'down' : 'ok', latencyMs: latency };
  } catch {
    result.supabase = { status: 'down' };
  }

  // Edge Functions placeholder
  result.edge = { status: 'ok' };

  // Phantom queue (best-effort)
  try {
    const { launchQueue } = await import('./campaigns/launch');
    if (launchQueue) {
      const counts = await launchQueue.getJobCounts();
      const queued = (counts.wait || 0) + (counts.delayed || 0);
      result.phantom = {
        status: queued > 0 ? 'degraded' : 'ok',
        queued,
        active: counts.active || 0
      };
    }
  } catch {
    result.phantom = { status: 'unknown' };
  }

  // Affiliates (service role count)
  try {
    const { error: affErr, count } = await supabaseAdmin
      .from('affiliates')
      .select('id', { head: true, count: 'exact' });
    result.affiliates = { total: affErr ? 0 : (count || 0) };
  } catch {
    result.affiliates = { total: 0 };
  }

  // Slack integration
  try {
    const { data } = await supabase.from('slack_accounts').select('id', { head: true, count: 'exact' });
    const connected = (data as any)?.count ?? 0;
    result.slack = { status: connected ? 'ok' : 'down', connected };
  } catch {
    result.slack = { status: 'unknown' };
  }

  // app metrics
  const m = getMetrics();
  result.failed = { today: m.failedCalls };
  result.api = { today: m.apiCalls };

  res.json(result);
} 