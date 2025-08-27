import OpenAI from 'openai';
import { supabase } from '../../lib/supabase';
import { Intent } from './intent';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function makeDrafts(threadId: string, policy: any, intent: Intent){
  const { data: inb } = await supabase.from('sales_messages')
    .select('body, thread_id').eq('thread_id', threadId).eq('direction','inbound')
    .order('created_at',{ascending:false}).limit(1);
  const inbound = inb?.[0]?.body || '';

  const sys = `You are the Sales Agent. Write concise (${policy.reply_style?.length || 'short'}) replies in a ${policy.reply_style?.tone || 'friendly-direct'} tone, with a single clear CTA. If positive intent, include a Calendly CTA for ${policy?.scheduling?.event_type}. If pricing is requested, include ${policy?.assets?.pricing_url || ''}. Return JSON array of drafts: [{"subject":"","body":"","assets":[]}].`;

  const user = `Prospect message:\n\"\"\"${inbound}\"\"\"\nIntent: ${intent}. Reply format: ${policy.reply_style?.format}.`;

  const r = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    temperature: 0.4
  });

  try {
    const content = r.choices[0]?.message?.content || '[]';
    const drafts = JSON.parse(content);
    return Array.isArray(drafts) ? drafts.slice(0,3) : [];
  } catch { return []; }
}


