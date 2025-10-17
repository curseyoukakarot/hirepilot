import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { sourcingRunPersonaTool } from '../mcp/sourcing.run_persona';

const router = Router();

router.post('/send-message', requireAuth as any, async (req, res) => {
  try {
    const userId = (req as any)?.user?.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

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

    return res.json({ message: 'Understood. How would you like to proceed?' });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'chat failed' });
  }
});

export default router;


