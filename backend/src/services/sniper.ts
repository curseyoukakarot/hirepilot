import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import fetch from 'node-fetch';
import { LinkedInClient } from '../lib/linkedin/client';
import { sniperOpenerQueue } from '../queues/redis';
import { decryptGCM } from '../lib/crypto';
import sgMail from '@sendgrid/mail';

type Target = {
  id: string; user_id: string; type: 'own'|'competitor'|'keyword';
  post_url?: string; keyword_match?: string; daily_cap: number; campaign_id?: string; status: string;
};

async function getTarget(id:string): Promise<Target> {
  const { data, error } = await supabase.from('sniper_targets').select('*').eq('id', id).single();
  if (error || !data) throw new Error('target not found'); return data as any;
}

async function getLinkedInCookies(user_id: string): Promise<{ li_at: string; jsession?: string }> {
  const { data, error } = await supabase.from('linkedin_sessions').select('*').eq('user_id', user_id).single();
  if (error || !data) throw new Error('LinkedIn session missing. Connect in Settings.');
  const li_at = decryptGCM(JSON.parse(data.enc_li_at));
  const jsession = data.enc_jsessionid ? decryptGCM(JSON.parse(data.enc_jsessionid)) : undefined;
  return { li_at, jsession };
}

export async function ensureMicroCampaignForTarget(t: Target) {
  if (t.campaign_id) {
    // Ensure legacy campaigns get created_by filled for Agent Mode visibility
    try {
      const { data: existing } = await supabase
        .from('sourcing_campaigns')
        .select('id,created_by')
        .eq('id', t.campaign_id)
        .maybeSingle();
      if (existing && !existing.created_by) {
        await supabase.from('sourcing_campaigns').update({ created_by: t.user_id }).eq('id', t.campaign_id);
      }
    } catch {}
    return t.campaign_id;
  }
  const base = t.type === 'keyword' ? (t.keyword_match || 'keyword') : (t.post_url || 'post');
  const title = `Sniper – ${base.slice(0, 40)} – ${dayjs().format('YYYY[W]WW')}`;
  const { data, error } = await supabase
    .from('sourcing_campaigns')
    .insert({ title, audience_tag: 'sniper', created_by: t.user_id })
    .select()
    .single();
  if (error) throw error;
  await supabase.from('sniper_targets').update({ campaign_id: data.id }).eq('id', t.id);
  return data.id;
}

// ---------------- Notifications -----------------
async function getUserNotifySettings(userId: string): Promise<{ email?: string; slack?: string }> {
  try {
    const { data } = await supabase
      .from('user_settings')
      .select('email, slack_webhook_url')
      .eq('user_id', userId)
      .maybeSingle();
    return { email: (data as any)?.email, slack: (data as any)?.slack_webhook_url };
  } catch { return {}; }
}

export async function notifySniperQueued(userId: string, targetId: string, campaignId?: string, postUrl?: string) {
  const { email, slack } = await getUserNotifySettings(userId);
  const text = `Sniper job queued${postUrl ? ` for ${postUrl}` : ''}. Target: ${targetId}${campaignId ? `, Campaign: ${campaignId}` : ''}.`;
  if (slack) {
    try { await (await import('axios')).default.post(slack, { text }); } catch {}
  }
  if (email && process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM) {
    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.send({ to: email, from: process.env.SENDGRID_FROM, subject: 'Sniper queued', text });
    } catch {}
  }
}

export async function notifySniperCompleted(userId: string, targetId: string, campaignId: string, found: number, enriched: number) {
  const { email, slack } = await getUserNotifySettings(userId);
  const text = `Sniper completed. Target: ${targetId}, Campaign: ${campaignId}. Found=${found}, Enriched=${enriched}.`;
  if (slack) {
    try { await (await import('axios')).default.post(slack, { text }); } catch {}
  }
  if (email && process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM) {
    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.send({ to: email, from: process.env.SENDGRID_FROM, subject: 'Sniper completed', text });
    } catch {}
  }
}

export async function notifySniperFailed(userId: string, targetId: string, errorMsg: string) {
  const { email, slack } = await getUserNotifySettings(userId);
  const text = `Sniper failed. Target: ${targetId}. Error: ${errorMsg}`;
  if (slack) {
    try { await (await import('axios')).default.post(slack, { text }); } catch {}
  }
  if (email && process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM) {
    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      await sgMail.send({ to: email, from: process.env.SENDGRID_FROM, subject: 'Sniper failed', text });
    } catch {}
  }
}

export async function addTarget(userId: string, body: { type:'own'|'competitor'|'keyword', post_url?:string, keyword_match?:string, daily_cap?:number }) {
  if (body.type !== 'keyword' && !body.post_url) throw new Error('post_url required for own/competitor');
  if (body.type === 'keyword' && !body.keyword_match) throw new Error('keyword_match required');
  const { data, error } = await supabase.from('sniper_targets').insert({ user_id: userId, ...body, daily_cap: body.daily_cap ?? 15 }).select().single();
  if (error) throw error;
  const campaign_id = await ensureMicroCampaignForTarget(data as any);
  return { ...(data as any), campaign_id };
}

export async function listTargets(userId: string) {
  const { data, error } = await supabase.from('sniper_targets').select('*').eq('user_id', userId).order('created_at', { ascending:false });
  if (error) throw error; return data;
}

export async function pauseTarget(id: string) { await supabase.from('sniper_targets').update({ status:'paused' }).eq('id', id); }
export async function resumeTarget(id: string) { await supabase.from('sniper_targets').update({ status:'active' }).eq('id', id); }

async function todayCount(targetId:string) {
  const { data } = await supabase.from('sniper_captures').select('id').eq('target_id', targetId).gte('captured_at', dayjs().startOf('day').toISOString());
  return data?.length || 0;
}

async function insertCapture(targetId:string, p:{name:string; linkedin_url:string}) {
  const { error } = await supabase.from('sniper_captures').insert({ target_id: targetId, name: p.name, linkedin_url: p.linkedin_url });
  if (error && !String(error.message).includes('duplicate')) throw error;
  return !error;
}

async function upsertLead(campaign_id:string, p:any, e:any) {
  await supabase
    .from('sourcing_leads')
    .upsert({
      campaign_id,
      name: p.name,
      title: e.title || null,
      company: e.company || null,
      linkedin_url: p.linkedin_url,
      email: e.email || null,
      domain: e.domain || null,
      enriched: !!e.email
    }, { onConflict: 'linkedin_url' });
}

export async function enrichLead(linkedin_url: string, name?: string) {
  const apiKey = process.env.APOLLO_API_KEY!;
  try {
    const r = await fetch(`${process.env.APOLLO_API_BASE || 'https://api.apollo.io/v1'}/people/match`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({ linkedin_url, person_name: name })
    });
    const j:any = await r.json();
    const person = j?.person || j?.people?.[0];
    if (!person) return null;
    return { email: person.email || person.emails?.[0], title: person.title, company: person.employer_name, domain: person.organization?.website_url };
  } catch { return null; }
}

export async function captureOnce(targetId: string) {
  const t = await getTarget(targetId);
  if (t.status !== 'active') return { skipped:true, reason:'paused' };

  const remaining = Math.max(0, (t.daily_cap || 15) - (await todayCount(targetId)));
  if (remaining <= 0) return { found:0, enriched:0, limit:true };

  const { li_at, jsession } = await getLinkedInCookies(t.user_id);
  const li = new LinkedInClient();
  await li.init({ li_at, jsession });

  try {
    if (t.type === 'keyword') await li.searchKeyword(t.keyword_match!);
    else await li.gotoPost(t.post_url!);

    const limit = Math.min(remaining, Number(process.env.SNIPER_MAX_PER_RUN || 25));
    const people = await li.collectProfiles(limit);

    let found = 0, enriched = 0;
    for (const p of people) {
      const ok = await insertCapture(targetId, p);
      if (!ok) continue;
      found++;
      const e = await enrichLead(p.linkedin_url, p.name);
      if (e?.email) {
        const cid = await ensureMicroCampaignForTarget(t);
        await upsertLead(cid, p, e);
        enriched++;
      }
      const min = Number(process.env.SNIPER_MIN_WAIT_MS || 800);
      const max = Number(process.env.SNIPER_MAX_WAIT_MS || 1600);
      await li.sleep(min + Math.floor(Math.random()*(max-min)));
    }

    // if target is set to send openers and we enriched some leads, queue a batch
    if ((t as any).send_opener && enriched > 0 && process.env.SNIPER_OPENER_ENABLE === 'true') {
      await sniperOpenerQueue.add('opener', { targetId }, { delay: 5000 });
    }

    await supabase.from('sniper_runs').insert({ target_id: targetId, success_count: found });
    if (found > 0) {
      try { await notifySniperCompleted(t.user_id, targetId, await ensureMicroCampaignForTarget(t), found, enriched); } catch {}
    }
    return { found, enriched };
  } catch (e:any) {
    await supabase.from('sniper_runs').insert({ target_id: targetId, error_count: 1, log: String(e?.message || e) });
    try {
      await supabase.from('sniper_targets').update({ status: 'failed' }).eq('id', targetId);
      await notifySniperFailed(t.user_id, targetId, String(e?.message || e));
    } catch {}
    return { error: String(e?.message || e) };
  } finally {
    await li.cleanup();
  }
}


