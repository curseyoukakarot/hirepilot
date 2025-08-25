import dayjs from 'dayjs';
import { supabase } from '../lib/supabase';
import { sendEmail } from './sendgrid';
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const DAILY_CAP = Number(process.env.SNIPER_OPENER_DAILY_CAP || 20);
const RATE_PER_MIN = Number(process.env.SNIPER_OPENER_RATE_PER_MIN || 30);

export async function processSniperOpenersBatch(targetId: string) {
  // load target & campaign
  const { data: target } = await supabase.from('sniper_targets').select('*').eq('id', targetId).single();
  if (!target || !target.send_opener) return { skipped: true };
  // today counts
  const today = dayjs().startOf('day').toISOString();
  const { data: sentToday } = await supabase
    .from('sniper_opener_sends').select('id')
    .eq('target_id', targetId).gte('sent_at', today);
  const remaining = Math.max(0, DAILY_CAP - (sentToday?.length || 0));
  if (remaining <= 0) return { limit: true };

  // Correct pool query: enriched leads with email in campaign
  const { data: pool } = await supabase
    .from('sourcing_leads')
    .select('id, email, name, company, title')
    .eq('campaign_id', target.campaign_id)
    .not('email','is', null);

  if (!pool?.length) return { queued: 0 };

  // exclude already sent
  const { data: already } = await supabase
    .from('sniper_opener_sends')
    .select('lead_id')
    .eq('target_id', targetId)
    .gte('sent_at', dayjs().subtract(60, 'day').toISOString()); // window
  const exclude = new Set((already || []).map(r => r.lead_id));
  const todo = pool.filter(l => !exclude.has(l.id)).slice(0, remaining);

  if (!todo.length) return { queued: 0 };

  // build subject/body (use existing on target or generate)
  let subject = target.opener_subject as string | null;
  let body = target.opener_body as string | null;
  if (!subject || !body) {
    const gen = await generateSniperOpener(target);
    subject = gen.subject; body = gen.body;
    await supabase.from('sniper_targets').update({ opener_subject: subject, opener_body: body }).eq('id', targetId);
  }

  let sent = 0;
  for (const lead of todo) {
    if (!lead.email) continue;
    const s = personalize(subject!, lead);
    const b = personalize(body!, lead);
    await sendEmail(lead.email, s, b, {
      'X-Sniper-Target-Id': targetId,
      'X-Lead-Id': lead.id
    });
    await supabase.from('sniper_opener_sends').insert({
      target_id: targetId,
      lead_id: lead.id,
      email: lead.email
    });
    sent++;
    // throttle
    await waitMs(Math.ceil(60_000 / RATE_PER_MIN));
  }

  // Action Inbox notification
  await notifyBatch(targetId, sent);

  return { sent };
}

function waitMs(ms: number){ return new Promise(res => setTimeout(res, ms)); }

function personalize(t: string, lead: any) {
  return (t || '')
    .replace(/\{\{name\}\}/gi, lead.name || '')
    .replace(/\{\{company\}\}/gi, lead.company || '')
    .replace(/\{\{title\}\}/gi, lead.title || '');
}

async function generateSniperOpener(target: any): Promise<{ subject: string; body: string }> {
  const context = target.type === 'keyword'
    ? `They engaged with posts about "${target.keyword_match}".`
    : `They engaged with the post: ${target.post_url}`;
  const prompt = `Write a concise cold opener email (<110 words) for prospects captured from LinkedIn engagement. 
Context: ${context}
Style: specific, curious, zero fluff, 1 CTA to quick call.
Use placeholders {{name}} and {{company}} where useful.
Return JSON: {"subject":"","body":""}`;
  const r = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5
  });
  try { return JSON.parse(r.choices[0]?.message?.content || '{}'); }
  catch { return { subject: 'Quick question', body: 'Hi {{name}}, quick one re: {{company}}…' }; }
}

async function notifyBatch(targetId: string, sent: number) {
  // target & campaign info
  const { data: t } = await supabase.from('sniper_targets').select('user_id, type, post_url, keyword_match, campaign_id').eq('id', targetId).single();
  if (!t) return;
  const title = `Sniper opener batch sent (${sent})`;
  const desc = t.type === 'keyword' ? `Keyword: *${t.keyword_match}*` : `Post: ${t.post_url}`;
  await fetch(`${process.env.BACKEND_BASE_URL}/api/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: t.user_id,
      source: 'inapp',
      thread_key: `sniper:${targetId}`,
      title,
      body_md: `${desc}\n\nI sent **${sent}** opener emails from the Sniper micro-campaign.\nWant to increase daily cap or pause?`,
      actions: [
        { id: `sniper:pause:${targetId}`, type: 'button', label: 'Pause target' },
        { id: `sniper:increase:${targetId}`, type: 'button', label: 'Increase daily cap +5' },
        { id: `view_campaign:${t.campaign_id}`, type: 'button', label: 'View campaign' }
      ]
    })
  });
}


