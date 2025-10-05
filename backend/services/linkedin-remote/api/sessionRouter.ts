import { Router } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { assignProxyForUser } from '../proxy/proxyService';
import { startSession, stopSession } from '../orchestrator';
import { harvestCookies } from '../cdp/harvest';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const router = Router();

const authUser = (req: any) => {
  const uid = req.headers['x-user-id'] as string | undefined;
  if (!uid) throw new Error('Unauthenticated');
  return uid;
};

router.post('/start', async (req, res) => {
  try {
    const userId = authUser(req);
    const runtime = (req.body?.streamMode ?? process.env.LINKEDIN_STREAM_MODE ?? 'novnc') as 'novnc'|'webrtc';

    // Legacy installs may have a unique/PK on user_id; use upsert to avoid duplicate key errors
    const { data, error } = await supabase
      .from('linkedin_sessions')
      .upsert({
        user_id: userId,
        status: 'pending',
        login_method: 'streamed',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select('id')
      .single();
    if (error) throw error;
    const sessionId = data.id as string;

    const proxyUrl = await assignProxyForUser(userId);
    const result = await startSession({ sessionId, runtime, proxyUrl });

    await supabase.from('container_instances').insert({
      session_id: sessionId,
      runtime,
      engine: runtime === 'webrtc' ? 'browserless' : 'docker',
      remote_debug_url: result.remoteDebugUrl,
      stream_url: result.streamUrl,
      state: 'starting'
    });

    await supabase.from('linkedin_sessions').update({ container_id: result.containerId, status: 'pending' }).eq('id', sessionId);

    res.json({ sessionId, streamUrl: result.streamUrl });
  } catch (e:any) {
    console.error('[LI Session Start] Error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/status', async (req, res) => {
  try {
    const userId = authUser(req);
    const sessionId = z.string().parse(req.query.sessionId);
    const { data, error } = await supabase.from('linkedin_sessions').select('*').eq('id', sessionId).eq('user_id', userId).single();
    if (error) throw error;
    res.json({ status: data.status, session: data });
  } catch (e:any) { res.status(500).json({ error: e.message }); }
});

router.post('/complete', async (req, res) => {
  try {
    const userId = authUser(req);
    const { sessionId } = z.object({ sessionId: z.string() }).parse(req.body);

    const { data: ci } = await supabase.from('container_instances').select('*').eq('session_id', sessionId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!ci?.remote_debug_url) throw new Error('No remote debug URL');

    const result = await harvestCookies(sessionId, ci.remote_debug_url);
    await supabase.from('container_instances').update({ state: 'ready' }).eq('id', ci.id);
    res.json({ ok: true, harvested: result });
  } catch (e:any) { res.status(500).json({ error: e.message }); }
});

router.post('/hibernate', async (req, res) => {
  res.json({ ok: true, note: 'Implement snapshot manager & stop container' });
});

router.post('/resume', async (req, res) => {
  res.json({ ok: true, note: 'Implement restore & start flow' });
});

router.delete('/', async (req, res) => {
  try {
    const userId = authUser(req);
    const { sessionId } = z.object({ sessionId: z.string() }).parse(req.body);
    const { data: ci } = await supabase.from('container_instances').select('*').eq('session_id', sessionId).maybeSingle();
    if (ci?.stream_url) {
      const containerId = (ci as any).container_id || '';
      if (containerId) await stopSession(containerId).catch(()=>{});
    }
    await supabase.from('linkedin_sessions').update({ status: 'expired' }).eq('id', sessionId).eq('user_id', userId);
    res.json({ ok: true });
  } catch (e:any) { res.status(500).json({ error: e.message }); }
});

export default router;


