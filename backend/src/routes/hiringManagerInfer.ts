import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { requireAuth } from '../../middleware/authMiddleware';
import { openai } from '../../lib/llm';
import { supabaseDb } from '../../lib/supabase';
import { searchAndEnrichPeople } from '../../utils/apolloApi';
import { sendEmail } from '../services/sendgrid';

const router = express.Router();

type InferPayload = {
  job_description?: string;
  company_size?: string;
  industry?: string;
  company_name?: string;
  titles?: TitleResult[];
  selected_titles?: TitleResult[];
};

type TitleResult = {
  title: string;
  confidence: 'High' | 'Medium' | 'Low';
  reasoning: string;
};

const sizeToSeniority = (size?: string) => {
  if (!size) return ['Head', 'Director', 'VP'];
  const normalized = size.replace(/[,–—\s+]/g, '').toLowerCase();
  if (normalized.includes('1-10') || normalized.includes('11-50')) return ['Head', 'VP'];
  if (normalized.includes('51-200') || normalized.includes('201-1000')) return ['Director', 'VP'];
  return ['Director', 'VP'];
};

const inferTitlesHeuristic = (body: InferPayload): TitleResult[] => {
  const desc = (body.job_description || '').toLowerCase();
  const size = body.company_size;
  const seniorities = sizeToSeniority(size);

  const roleHints: string[] = [];
  if (desc.includes('product')) roleHints.push('Product');
  if (desc.includes('marketing')) roleHints.push('Marketing');
  if (desc.includes('sales') || desc.includes('revenue')) roleHints.push('Sales');
  if (desc.includes('customer') || desc.includes('support') || desc.includes('success')) roleHints.push('Customer Success');
  if (desc.includes('people') || desc.includes('talent') || desc.includes('hr')) roleHints.push('People');
  if (desc.includes('operations') || desc.includes('ops') || desc.includes('program')) roleHints.push('Operations');
  if (desc.includes('engineering') || desc.includes('software') || desc.includes('developer')) roleHints.push('Engineering');
  if (desc.includes('data') || desc.includes('analytics')) roleHints.push('Data');
  if (desc.includes('design') || desc.includes('ux')) roleHints.push('Design');

  const base = roleHints.length ? roleHints[0] : 'Operations';
  const titles: TitleResult[] = [];
  seniorities.forEach((seniority, idx) => {
    titles.push({
      title: `${seniority} of ${base}`,
      confidence: idx === 0 ? 'High' : 'Medium',
      reasoning: `Based on role focus (${base}) and company size (${size || 'unspecified'})`,
    });
  });

  // Add a third option if only two were generated
  if (titles.length < 3) {
    titles.push({
      title: `Head of ${base}`,
      confidence: 'Medium',
      reasoning: 'Alternate owner for the role to increase reply rates',
    });
  }

  // Clamp to 3
  return titles.slice(0, 3);
};

async function inferTitlesLLM(body: InferPayload): Promise<TitleResult[]> {
  const system = `You are a career outreach assistant. Given a job description and context (company size, industry, company name), return 1-3 likely hiring manager titles who would own the role. Titles must be ownership-level (Head/Director/VP/C-level), not IC. Prefer concise titles. Include a confidence label (High/Medium/Low) and a one-line reasoning. Respond as JSON: { "titles": [ { "title": "...", "confidence": "High|Medium|Low", "reasoning": "..." } ] }`;
  const user = `Job description:\n${body.job_description || 'N/A'}\n\nCompany: ${body.company_name || 'N/A'}\nCompany size: ${body.company_size || 'N/A'}\nIndustry: ${body.industry || 'N/A'}`;

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const content = resp.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);
  const titles = Array.isArray(parsed?.titles) ? parsed.titles : [];
  return (titles as TitleResult[]).slice(0, 3);
}

router.post('/jobs/hiring-manager-infer', requireAuth, async (req: Request, res: Response) => {
  try {
    const payload = (req.body || {}) as InferPayload;
    if (!payload.job_description) {
      return res.status(400).json({ error: 'job_description required' });
    }
    let titles: TitleResult[] = [];
    try {
      titles = await inferTitlesLLM(payload);
    } catch (llmErr) {
      console.warn('hiring-manager-infer LLM failed, using heuristic', llmErr);
      titles = inferTitlesHeuristic(payload);
    }
    if (!titles || !titles.length) {
      titles = inferTitlesHeuristic(payload);
    }
    const role_category = titles[0]?.title || 'Hiring Manager';
    const seniority_guess = sizeToSeniority(payload.company_size)[0] || 'Director';
    res.json({ titles, role_category, seniority_guess });
  } catch (e: any) {
    console.error('hiring-manager-infer error', e);
    res.status(500).json({ error: e?.message || 'infer_failed' });
  }
});

router.post('/jobs/hiring-manager-launch', requireAuth, async (req: Request, res: Response) => {
  try {
    const launchId = crypto.randomUUID();
    const log = (msg: string, extra?: any) => {
      try {
        console.log(`[HM_LAUNCH ${launchId}] ${msg}`, extra ?? '');
      } catch {}
    };
    const maskKey = (k?: string | null) => {
      if (!k) return null;
      if (k.length <= 8) return '****';
      return `${k.slice(0, 4)}…${k.slice(-4)}`;
    };

    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const {
      job_description,
      company_name,
      company_size,
      industry,
      titles: inferredTitles,
      selected_titles,
      campaign_title,
      leadSource,
    } = (req.body || {}) as InferPayload & { campaign_title?: string; leadSource?: string };
    if (!job_description) return res.status(400).json({ error: 'job_description required' });
    const titles = (selected_titles && selected_titles.length ? selected_titles : inferredTitles) || [];
    if (!titles.length) return res.status(400).json({ error: 'titles required' });
    if (leadSource && leadSource !== 'apollo') {
      return res.status(400).json({
        error: 'Unsupported lead source for automated sourcing. Use Apollo for now.',
        code: 'UNSUPPORTED_LEAD_SOURCE',
      });
    }

    log('start', { userId, company: company_name, leadSource: leadSource || 'apollo' });

    // Create job req (use RPC to avoid trigger/RLS surprises)
    let jobReqId: string | null = null;
    try {
      const rpcRes = await supabaseDb.rpc('create_job_with_pipeline', {
        job_title: campaign_title || titles[0]?.title || 'Hiring Manager Outreach',
        job_user: userId,
        job_department: null,
      });
      if (rpcRes.error || !rpcRes.data) {
        log('job requisition rpc failed', { error: rpcRes.error });
        return res.status(500).json({
          error: 'Failed to create job requisition',
          code: 'JOB_REQ_CREATE_FAILED',
          detail: rpcRes.error?.message,
        });
      }
      jobReqId = rpcRes.data as string;
      log('job requisition created via RPC', { jobReqId });
    } catch (err: any) {
      log('job requisition rpc threw', { message: err?.message });
      return res.status(500).json({
        error: 'Failed to create job requisition',
        code: 'JOB_REQ_CREATE_FAILED',
        detail: err?.message,
      });
    }

    // Update job with description/company/industry/status
    const jobUpdate = await supabaseDb
      .from('job_requisitions')
      .update({
        description: job_description,
        status: 'draft',
      })
      .eq('id', jobReqId)
      .select()
      .maybeSingle();
    if (jobUpdate.error) {
      log('job requisition update failed', { error: jobUpdate.error });
      return res.status(500).json({
        error: 'Failed to update job requisition',
        code: 'JOB_REQ_UPDATE_FAILED',
        detail: jobUpdate.error?.message,
      });
    }
    const jobReq = jobUpdate.data;

    // Create campaign in classic campaigns table
    const campIns = await supabaseDb
      .from('campaigns')
      .insert({
        user_id: userId,
        title: campaign_title || `HM Outreach: ${company_name || 'Unnamed company'}`,
        description: job_description,
        status: 'draft',
        job_id: jobReq?.id || jobReqId || null,
      })
      .select()
      .single();
    const campaign = campIns.data;
    if (campIns.error || !campaign) {
      log('campaign insert failed', { error: campIns.error });
      return res.status(500).json({
        error: 'Failed to create campaign',
        code: 'CAMPAIGN_CREATE_FAILED',
        detail: campIns.error?.message,
      });
    }

    // Resolve Apollo API key
    const { data: settings } = await supabaseDb
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', userId)
      .maybeSingle();
    const personalKey = settings?.apollo_api_key;
    const superAdminKey = process.env.SUPER_ADMIN_APOLLO_API_KEY;
    const platformKey = process.env.HIREPILOT_APOLLO_API_KEY;
    log('apollo key resolved', {
      personal: maskKey(personalKey),
      superAdmin: maskKey(superAdminKey),
      platform: maskKey(platformKey),
    });
    const apiKey = personalKey || superAdminKey || platformKey;
    if (!apiKey) {
      log('missing apollo key - aborting');
      return res.status(400).json({
        error: 'Missing Apollo API key',
        hint: 'Add your Apollo key in Integrations, or contact support to enable platform key.',
        code: 'APOLLO_KEY_MISSING',
      });
    }

    // Helper to broaden titles a bit for later phases
    const baseRole = (() => {
      const first = titles[0]?.title || '';
      const m = first.match(/of\s+(.+)/i);
      if (m?.[1]) return m[1].trim();
      const parts = first.split(' ');
      return parts.slice(1).join(' ').trim() || parts.join(' ').trim();
    })();
    const broadenedTitles = Array.from(
      new Set([
        ...titles.map((t) => t.title),
        baseRole ? `VP of ${baseRole}` : 'VP',
        baseRole ? `Director of ${baseRole}` : 'Director',
        baseRole ? `Head of ${baseRole}` : 'Head of Department',
      ])
    );

    type Phase = 1 | 2 | 3;
    const searchPhases: { phase: Phase; titles: string[]; qKeywords?: string }[] = [
      { phase: 1, titles: titles.map((t) => t.title).slice(0, 3), qKeywords: [company_name, industry].filter(Boolean).join(' ') || undefined },
      { phase: 2, titles: broadenedTitles.slice(0, 5), qKeywords: industry || undefined },
      { phase: 3, titles: broadenedTitles.slice(0, 7), qKeywords: undefined },
    ];

    let apolloLeads: any[] = [];
    let usedPhase: Phase = 1;
    for (const cfg of searchPhases) {
      try {
        log('calling searchAndEnrichPeople', { phase: cfg.phase, titles: cfg.titles, qKeywords: cfg.qKeywords });
        const { leads } = (await searchAndEnrichPeople({
          api_key: apiKey,
          person_titles: cfg.titles,
          q_keywords: cfg.qKeywords,
          page: 1,
          per_page: 50,
        } as any)) as any;
        apolloLeads = leads || [];
        usedPhase = cfg.phase;
        log('searchAndEnrichPeople returned', { phase: cfg.phase, count: apolloLeads.length });
        if (apolloLeads.length === 0) continue;
        // If we get anything, stop widening. If we want larger volumes, we could keep widening; for now stop at first non-empty.
        break;
      } catch (err: any) {
        log('searchAndEnrichPeople threw', { phase: cfg.phase, message: err?.message });
        return res.status(502).json({
          error: 'Lead sourcing failed',
          code: 'LEAD_SOURCING_FAILED',
          detail: err?.message || 'Unknown error',
          phase: cfg.phase,
        });
      }
    }

    if (!apolloLeads || apolloLeads.length === 0) {
      log('no leads returned after widening - aborting');
      return res.status(422).json({
        error: 'No hiring manager leads found for this job',
        code: 'NO_LEADS_FOUND',
        suggestions: [
          'Try broadening titles (VP/Director/Head).',
          'Remove company filter or confirm company name spelling.',
          'Use Apollo instead of Sales Navigator for initial sourcing.',
        ],
        phase: usedPhase,
      });
    }

    const leadsPayloadAll = (apolloLeads || []).map((l: any) => ({
      user_id: userId,
      name: `${l.firstName || ''} ${l.lastName || ''}`.trim() || l.email || 'Unknown',
      email: l.email || null,
      title: l.title || null,
      company: l.company || company_name || null,
      linkedin_url: l.linkedinUrl || null,
      campaign_id: campaign?.id,
      source: 'apollo',
    }));

    let insertedCount = 0;
    let insertError = null as any;
    let insertedLeads = null as any;
    try {
      const ins = await supabaseDb.from('leads').insert(leadsPayloadAll).select('id');
      insertedLeads = ins.data;
      insertError = ins.error;
    } catch (err: any) {
      insertError = err;
    }
    if (insertError) {
      // Fallback: try only those with email if the table requires email
      log('insert leads failed, attempting email-only fallback', { insertError });
      const emailOnly = leadsPayloadAll.filter((m) => !!m.email);
      if (!emailOnly.length) {
        return res.status(500).json({ error: 'Failed to insert leads', code: 'LEADS_INSERT_FAILED', detail: insertError?.message });
      }
      const ins2 = await supabaseDb.from('leads').insert(emailOnly).select('id');
      if (ins2.error) {
        log('fallback insert leads failed', { leadsErr: ins2.error });
        return res.status(500).json({ error: 'Failed to insert leads', code: 'LEADS_INSERT_FAILED', detail: ins2.error?.message });
      }
      insertedLeads = ins2.data;
    }
    insertedCount = insertedLeads?.length ?? 0;
    log('inserted leads', { count: insertedCount, payloadCount: leadsPayloadAll.length });

    // Mark campaign active
    await supabaseDb.from('campaigns').update({ status: 'active' }).eq('id', campaign?.id);

    // Email notification (simple)
    try {
      const { data: userRow } = await supabaseDb.from('users').select('email').eq('id', userId).maybeSingle();
      if (userRow?.email) {
        await sendEmail(
          userRow.email,
          'Your hiring manager campaign launched',
          `We found ${insertedCount} leads for your hiring manager outreach campaign.`,
          `<p>We found <strong>${insertedCount}</strong> leads for your hiring manager outreach campaign targeting ${company_name || 'this role'}.</p>`
        );
      }
    } catch (e) {
      console.warn('launch email failed', e);
    }

    return res.json({
      campaign,
      jobReq,
      leads_sourced: apolloLeads.length,
      leads_inserted: insertedCount,
      titles_used: titles.map((t) => t.title),
      status: 'active',
      phase_used: usedPhase,
    });
  } catch (e: any) {
    console.error('hiring-manager-launch error', e);
    res.status(500).json({ error: e?.message || 'launch_failed' });
  }
});

export default router;
