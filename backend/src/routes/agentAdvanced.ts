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
  goal_total_leads: z.number().int().nonnegative().optional().nullable()
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
  action_type: z.enum(['source_via_persona','launch_campaign','send_sequence','persona_with_auto_outreach']).optional(),
  persona_id: z.string().uuid().optional().nullable(),
  campaign_id: z.string().uuid().optional().nullable(),
  linked_persona_id: z.string().uuid().optional().nullable(),
  linked_campaign_id: z.string().uuid().optional().nullable(),
  auto_outreach_enabled: z.boolean().optional(),
  leads_per_run: z.number().int().positive().max(500).optional(),
  send_delay_minutes: z.number().int().nonnegative().optional().nullable(),
  daily_send_cap: z.number().int().positive().optional().nullable(),
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
    if (parsed.data.auto_outreach_enabled) {
      const personaRef = parsed.data.linked_persona_id || parsed.data.persona_id;
      const campaignRef = parsed.data.linked_campaign_id || parsed.data.campaign_id;
      if (!personaRef) return res.status(400).json({ error: 'linked_persona_id_required' });
      if (!campaignRef) return res.status(400).json({ error: 'linked_campaign_id_required' });
    }
    const job = await scheduleFromPayload(userId, {
      ...parsed.data,
      payload,
      linked_persona_id: parsed.data.linked_persona_id ?? parsed.data.persona_id ?? null,
      linked_campaign_id: parsed.data.linked_campaign_id ?? parsed.data.campaign_id ?? null,
      auto_outreach_enabled: parsed.data.auto_outreach_enabled ?? false,
      leads_per_run: parsed.data.leads_per_run ?? (parsed.data.tool_payload as any)?.batch_size ?? 50,
      send_delay_minutes: parsed.data.send_delay_minutes ?? 0,
      daily_send_cap: parsed.data.daily_send_cap ?? null
    } as any);
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

router.post('/api/schedules/campaign-from-persona', async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const schema = z.object({ persona_id: z.string().uuid(), name: z.string().min(3) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const { data: persona, error: personaErr } = await supabaseAdmin
      .from('personas')
      .select('id,name')
      .eq('id', parsed.data.persona_id)
      .eq('user_id', userId)
      .single();
    if (personaErr || !persona) return res.status(404).json({ error: 'persona_not_found' });

    const { data: campaign, error } = await supabaseAdmin
      .from('sourcing_campaigns')
      .insert({
        title: parsed.data.name,
        audience_tag: persona.name,
        created_by: userId,
        status: 'draft'
      })
      .select('id,title,status,created_at')
      .single();
    if (error) throw error;
    res.json(campaign);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'failed_to_create_campaign' });
  }
});

export default router;


