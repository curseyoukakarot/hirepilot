import { Router } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { sourcingRunPersonaTool } from '../mcp/sourcing.run_persona';
import OpenAI from 'openai';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

const CALM_REX_SYSTEM_PROMPT =
  'You are REX, an AI Recruiting Agent inside HirePilot. Mode: Calm Professional Assistant. Be concise and neutral. Use personas to guide sourcing. When asked to source, schedule, or edit personas, offer 2 clear options, not more. Avoid exclamation marks. Never assume user intent; confirm next step.';

router.post('/send-message', async (req, res) => {
  try {
    const userId = (req as any)?.user?.id || (req as any)?.body?.userId || 'anonymous';

    const { message = '', personaId, action, args = {} } = req.body || {};

    // Handle action buttons first
    if (action) {
      if (action === 'run_now') {
        try {
          const toolResp = await sourcingRunPersonaTool.handler({ userId, persona_id: personaId, batch_size: Number(args.batch_size || 50) });
          const summary = JSON.parse(toolResp?.content?.[0]?.text || '{}');
          return res.json({
            message: `Added ${summary.added_count || 0} new leads (${summary.skipped_duplicates || 0} duplicates skipped).`,
            actions: [ { label: 'Start Outreach', value: 'start_outreach' }, { label: 'Add More Filters', value: 'refine' } ]
          });
        } catch (e: any) {
          return res.status(400).json({ message: e?.message || 'Run failed' });
        }
      }
      if (action === 'schedule') {
        return res.json({ message: 'Should I set it for a specific date or make it recurring?', actions: [ { label: 'One-Time', value: 'one_time' }, { label: 'Recurring', value: 'recurring' } ] });
      }
      // Basic fallthrough
      return res.json({ message: 'Understood.' });
    }

    const text: string = String(message || '').toLowerCase();
    const isGreeting = /^(hi|hello|hey|yo|gm|good\smorning|good\safternoon|good\sevening)\b/.test(text) || /\bhello\s*rex\b/.test(text);
    if (isGreeting) {
      return res.json({
        message: 'Hello — I\'m REX. How can I help today? I can source leads, schedule automations, or refine a persona.',
        actions: [
          { label: 'Run Now', value: 'run_now' },
          { label: 'Schedule', value: 'schedule' },
          { label: 'Modify Persona', value: 'refine' }
        ]
      });
    }
    if (text.startsWith('/source') || /(find|source|sourcing|prospect)/.test(text)) {
      return res.json({
        message: personaId ? `Would you like me to start sourcing using your active persona?` : 'Would you like me to start sourcing using your active persona?',
        actions: [ { label: 'Run Now', value: 'run_now' }, { label: 'Schedule', value: 'schedule' } ]
      });
    }
    if (text.startsWith('/schedule') || /schedule/.test(text)) {
      return res.json({ message: 'I can schedule this. Daily or weekly?', actions: [ { label: 'Daily', value: 'schedule_daily' }, { label: 'Weekly', value: 'schedule_weekly' } ] });
    }
    if (text.startsWith('/refine') || /persona|title|location|keyword/.test(text)) {
      return res.json({ message: 'What would you like to modify in your persona?', actions: [ { label: 'Titles', value: 'refine_titles' }, { label: 'Locations', value: 'refine_locations' }, { label: 'Filters', value: 'refine_filters' } ] });
    }

    // 4) Default: delegate to rexChat (tools + OpenAI) for full capability
    try {
      const { default: rexChat } = await import('../api/rexChat');
      const fakeReq: any = {
        method: 'POST',
        headers: req.headers,
        body: {
          userId,
          messages: [ { role: 'user', content: String(message || '') } ]
        }
      };
      const fakeRes: any = {
        status: (code: number) => ({ json: (obj: any) => res.status(code).json({ message: obj?.reply?.content || obj?.message || 'Understood. How would you like to proceed?' }) }),
        json: (obj: any) => res.json({ message: obj?.reply?.content || obj?.message || 'Understood. How would you like to proceed?' }),
        set: () => {}
      };
      return rexChat(fakeReq, fakeRes);
    } catch (e: any) {
      console.error('agentChat -> rexChat error', e?.message || e);
      return res.json({ message: 'Understood. How would you like to proceed?' });
    }
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'chat failed' });
  }
});

export default router;


