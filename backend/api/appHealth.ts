import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';

export default async function appHealth(req: Request, res: Response) {
  const result: any = {};
  try {
    // Supabase ping
    const t0 = Date.now();
    const { error: dbErr } = await supabase.rpc('heartbeat'); // assume func exists else fallback
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

  // Slack integration
  try {
    const { data } = await supabase.from('slack_accounts').select('id', { head: true, count: 'exact' });
    const connected = (data as any)?.count ?? 0;
    result.slack = { status: connected ? 'ok' : 'down', connected };
  } catch {
    result.slack = { status: 'unknown' };
  }

  res.json(result);
} 