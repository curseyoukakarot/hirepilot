import OpenAI from 'openai';
import { supabase } from '../../lib/supabase';
import { Intent } from './intent';
import { getEffectiveAssets } from './policy';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function makeDrafts(threadId: string, policy: any, intent: Intent){
  const { data: inb } = await supabase.from('sales_messages')
    .select('body, thread_id').eq('thread_id', threadId).eq('direction','inbound')
    .order('created_at',{ascending:false}).limit(1);
  const inbound = inb?.[0]?.body || '';

  const assets = getEffectiveAssets(policy);
  const pricingLine = assets.pricing ? `Include pricing link: ${assets.pricing}` : '';
  const demoLine = assets.demo ? `Include demo link: ${assets.demo}` : '';
  const calendlyLine = policy?.scheduling?.event_type
    ? `If positive intent, offer Calendly using event type "${policy.scheduling.event_type}".`
    : `If positive intent, propose a quick call and ask for availability.`;

  const sys = `You are the Sales Agent. Write concise (${policy.reply_style?.length || 'short'}) replies in a ${policy.reply_style?.tone || 'friendly-direct'} tone, with a single clear CTA.
${calendlyLine}
${pricingLine}
${demoLine}
Return JSON array of drafts: [{"subject":"","body":"","assets":[]}]. If a link isn't provided, don't fabricate it.`;

  const user = `Prospect message:
"""${inbound}"""
Intent: ${intent}. Reply format: ${policy.reply_style?.format || 'bullet_then_cta'}.`;

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


