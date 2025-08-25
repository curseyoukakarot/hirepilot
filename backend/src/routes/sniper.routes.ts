import type { Application, Request, Response } from 'express';
import { z } from 'zod';
import { addTarget, listTargets, pauseTarget, resumeTarget, captureOnce } from '../services/sniper';
import { sniperQueue } from '../queues/redis';

function uid(req: Request){
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (req as any).user?.id || req.headers['x-user-id'];
}

export function registerSniperRoutes(app: Application) {
  app.post('/api/sniper/targets', async (req: Request, res: Response) => {
    const user_id = uid(req); if (!user_id) return res.status(401).json({ error:'unauthorized' });
    const bodyParsed = z.object({
      type: z.enum(['own','competitor','keyword']),
      post_url: z.string().url().optional(),
      keyword_match: z.string().optional(),
      daily_cap: z.number().int().min(5).max(30).default(15)
    }).safeParse(req.body);

    if (!bodyParsed.success) return res.status(400).json({ error: 'invalid_payload', details: bodyParsed.error.flatten() });

    const t = await addTarget(String(user_id), bodyParsed.data as any);
    await sniperQueue.add('capture', { targetId: (t as any).id }, { delay: 5000 });
    return res.status(201).json(t);
  });

  app.get('/api/sniper/targets', async (req: Request, res: Response) => {
    const user_id = uid(req); if (!user_id) return res.status(401).json({ error:'unauthorized' });
    const data = await listTargets(String(user_id));
    return res.json(data);
  });

  app.post('/api/sniper/targets/:id/pause', async (req: Request, res: Response) => { await pauseTarget((req.params as any).id); return res.json({ ok:true }); });
  app.post('/api/sniper/targets/:id/resume', async (req: Request, res: Response) => { await resumeTarget((req.params as any).id); return res.json({ ok:true }); });

  app.post('/api/sniper/targets/:id/capture-now', async (req: Request, res: Response) => {
    const result = await captureOnce((req.params as any).id);
    return res.json(result);
  });
}


