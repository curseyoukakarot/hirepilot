import { Worker } from 'bullmq';
import { connection } from './queues';
import { classifyIntent } from '../services/sales/intent';
import { getPolicyForUser } from '../services/sales/policy';
import { makeDrafts } from '../services/sales/drafts';
import { supabase } from '../lib/supabase';

export const salesInboundWorker = new Worker('sales:inbound', async (job) => {
  const { threadId, userId } = job.data as { threadId: string; userId: string };

  const { data: msgs } = await supabase.from('sales_messages')
    .select('*').eq('thread_id', threadId).order('created_at', { ascending: false }).limit(1);
  const inbound = msgs?.[0];
  if (!inbound) return { skipped: 'no-inbound' };

  const intent = classifyIntent(inbound.body || '');
  const policy = await getPolicyForUser(userId);

  if (policy.mode === 'share') {
    const drafts = await makeDrafts(threadId, policy, intent);
    for (const d of drafts) {
      await supabase.from('sales_messages').insert({
        thread_id: threadId, direction: 'draft', subject: d.subject, body: d.body, assets: (d as any).assets || {}
      });
    }
    await supabase.from('sales_actions').insert({ thread_id: threadId, action:'share_drafts', payload:{ count: drafts.length, intent } });
    await supabase.from('sales_threads').update({ status:'awaiting_user' }).eq('id', threadId);
    return { ok: true, drafts: drafts.length };
  }

  const [best] = await makeDrafts(threadId, policy, intent);
  await supabase.from('sales_messages').insert({
    thread_id: threadId, direction: 'draft', subject: best.subject, body: best.body, assets: (best as any).assets || {}
  });
  await supabase.from('sales_actions').insert({ thread_id: threadId, action:'auto_reply', payload:{ intent } });

  return { queued: true, action: 'auto_reply' };
}, { connection: connection as any });


