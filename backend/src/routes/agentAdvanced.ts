import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { scheduleFromPayload, computeNextRun, markRun } from '../lib/scheduler';
import { executeAction } from '../lib/actions';

const router = Router();

// Middleware assumes req.user.id is set by upstream auth
function requireUser(req: Request, res: Response): string | null {
  const userId = (req as any)?.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  return userId;
}

// Personas
const personaSchema = z.object({
  name: z.string().min(1),
  titles: z.array(z.string()).optional(),
  include_keywords: z.array(z.string()).optional(),
  exclude_keywords: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  channels: z.array(z.string()).optional(),
  goal_total_leads: z.number().int().nonnegative().optional()
});

router.post('/api/personas', async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const parsed = personaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const body = parsed.data;
  const { data, error } = await supabaseAdmin.from('personas').insert({
    user_id: userId,
    name: body.name,
    titles: body.titles || [],
    include_keywords: body.include_keywords || [],
    exclude_keywords: body.exclude_keywords || [],
    locations: body.locations || [],
    channels: body.channels || [],
    goal_total_leads: body.goal_total_leads || 0
  }).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.get('/api/personas', async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const { data, error } = await supabaseAdmin.from('personas').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.get('/api/personas/:id', async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const id = req.params.id;
  const { data, error } = await supabaseAdmin.from('personas').select('*').eq('id', id).eq('user_id', userId).single();
  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
});

router.patch('/api/personas/:id', async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const id = req.params.id;
  const fields = personaSchema.partial().safeParse(req.body);
  if (!fields.success) return res.status(400).json({ error: fields.error.flatten() });
  const { data, error } = await supabaseAdmin.from('personas').update({ ...fields.data }).eq('id', id).eq('user_id', userId).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/api/personas/:id', async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const id = req.params.id;
  const { error } = await supabaseAdmin.from('personas').delete().eq('id', id).eq('user_id', userId);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// Schedules
const scheduleSchema = z.object({
  name: z.string().min(1),
  action_type: z.enum(['source_via_persona','launch_campaign','send_sequence']).optional(),
  persona_id: z.string().uuid().optional().nullable(),
  campaign_id: z.string().uuid().optional().nullable(),
  payload: z.record(z.any()).optional(),
  schedule_kind: z.enum(['one_time','recurring']),
  cron_expr: z.string().optional().nullable(),
  run_at: z.string().datetime().optional().nullable(),
  action_tool: z.enum(['sourcing.run_persona']).optional(),
  tool_payload: z.record(z.any()).optional()
});

router.post('/api/schedules', async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const payload = parsed.data.action_tool ? { action_tool: parsed.data.action_tool, tool_payload: parsed.data.tool_payload || {} } : (parsed.data.payload || {});
    const job = await scheduleFromPayload(userId, { ...parsed.data, payload } as any);
    res.json(job);
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'failed to create schedule' });
  }
});

router.get('/api/schedules', async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const { data, error } = await supabaseAdmin
    .from('schedules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.patch('/api/schedules/:id', async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const id = req.params.id;
  const body = z.object({ name: z.string().optional(), status: z.enum(['active','paused']).optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const { data, error } = await supabaseAdmin.from('schedules').update({ ...body.data }).eq('id', id).eq('user_id', userId).select('*').single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/api/schedules/:id', async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const id = req.params.id;
  const { error } = await supabaseAdmin.from('schedules').delete().eq('id', id).eq('user_id', userId);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

router.post('/api/schedules/:id/run', async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const id = req.params.id;
  const { data: job, error } = await supabaseAdmin.from('schedules').select('*').eq('id', id).eq('user_id', userId).single();
  if (error || !job) return res.status(404).json({ error: 'not found' });
  const result = await executeAction(job as any);
  const next = computeNextRun(job as any);
  await markRun(id, { ranAt: new Date(), nextRunAt: next ? new Date(next) : null, runResult: result });
  res.json({ ok: true, result, next_run_at: next });
});

// Proxy: run persona now
router.post('/api/agent/run-persona', async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const schema = z.object({ persona_id: z.string(), batch_size: z.number().int().positive().max(500).optional(), campaign_id: z.string().optional(), auto_send: z.boolean().optional(), credit_mode: z.enum(['base','enhanced']).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const { sourcingRunPersonaTool } = await import('../mcp/sourcing.run_persona');
    const toolResp = await sourcingRunPersonaTool.handler({ userId, ...parsed.data });
    const summary = JSON.parse(toolResp.content?.[0]?.text || '{}');
    res.json(summary);
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'run failed' });
  }
});

export default router;


