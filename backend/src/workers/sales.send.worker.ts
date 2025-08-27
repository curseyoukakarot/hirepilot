import { Worker } from 'bullmq';
import { connection } from './queues';
import { supabase } from '../lib/supabase';
import { sendEmail } from '../integrations/sendgrid';
import dayjs from 'dayjs';

const PER_THREAD_DAILY = Number(process.env.SALES_SEND_MAX_PER_THREAD_PER_DAY || 1);

async function canSend(threadId: string){
  const since = dayjs().startOf('day').toISOString();
  const { data } = await supabase.from('sales_messages')
    .select('id').eq('thread_id', threadId).eq('direction','outbound')
    .gte('created_at', since);
  return (data?.length || 0) < PER_THREAD_DAILY;
}

export const salesSendWorker = new Worker('sales:send', async (job) => {
  const { name } = job;
  if (name === 'propose-drafts') return { ok:true };

  if (name === 'send-approved' || name === 'offer-scheduling' || name === 'send-proposal') {
    const { thread_id, subject, body, assets } = job.data as any;
    if (!(await canSend(thread_id))) return { limit: true };

    const { data: t } = await supabase.from('sales_threads').select('id, user_id, meta').eq('id', thread_id).single();
    const { data: lastInbound } = await supabase.from('sales_messages')
      .select('sender, recipient').eq('thread_id', thread_id).eq('direction','inbound')
      .order('created_at',{ascending:false}).limit(1);
    const recipient = lastInbound?.[0]?.sender;

    const { data: pol } = await supabase.from('sales_agent_policies').select('policy').eq('user_id', (t as any).user_id).single();
    const from = (pol as any)?.policy?.sender?.email || process.env.DEFAULT_SENDER;

    if (recipient && from) {
      await sendEmail({
        from, to: recipient, subject: subject || '(no subject)',
        html: body
      });
    }

    await supabase.from('sales_messages').insert({
      thread_id, direction:'outbound', sender: from, recipient, subject, body, assets: assets || {}
    });
    await supabase.from('sales_threads').update({ status:'awaiting_prospect', last_outbound_at: new Date().toISOString() }).eq('id', thread_id);
    return { sent: true };
  }

  return { skipped: true, name };
}, { connection: connection as any });


