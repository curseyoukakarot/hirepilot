import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { openai } from '../../lib/llm';
import { supabaseDb } from '../../lib/supabase';
import { searchAndEnrichPeople } from '../../utils/apolloApi';
import { sendEmail } from '../../services/sendgrid';

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
    const userId = (req as any)?.user?.id as string | undefined;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const { job_description, company_name, company_size, industry, titles: inferredTitles, selected_titles, campaign_title } = (req.body || {}) as InferPayload & { campaign_title?: string };
    if (!job_description) return res.status(400).json({ error: 'job_description required' });
    const titles = (selected_titles && selected_titles.length ? selected_titles : inferredTitles) || [];
    if (!titles.length) return res.status(400).json({ error: 'titles required' });

    // Create job req
    const jobIns = await supabaseDb
      .from('job_requisitions')
      .insert({
        user_id: userId,
        title: campaign_title || titles[0]?.title || 'Hiring Manager Outreach',
        description: job_description,
        status: 'draft',
        company: company_name || null,
        industry: industry || null,
      })
      .select()
      .single();
    const jobReq = jobIns.data;

    // Create campaign in classic campaigns table
    const campIns = await supabaseDb
      .from('campaigns')
      .insert({
        user_id: userId,
        title: campaign_title || `HM Outreach: ${company_name || 'Unnamed company'}`,
        description: job_description,
        status: 'ready',
        job_id: jobReq?.id || null,
        keywords: JSON.stringify({
          titles: titles.map((t) => t.title),
          company: company_name,
          industry,
          company_size,
        }),
      })
      .select()
      .single();
    const campaign = campIns.data;

    // Resolve Apollo API key
    const { data: settings } = await supabaseDb
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', userId)
      .maybeSingle();
    const personalKey = settings?.apollo_api_key;
    const superAdminKey = process.env.SUPER_ADMIN_APOLLO_API_KEY;
    const platformKey = process.env.HIREPILOT_APOLLO_API_KEY;
    const apiKey = personalKey || superAdminKey || platformKey;
    if (!apiKey) return res.status(401).json({ error: 'No valid Apollo API key found' });

    // Apollo search & enrich
    const personTitles = titles.map((t) => t.title).slice(0, 3);
    const qKeywords = [company_name, industry].filter(Boolean).join(' ');
    const { leads: apolloLeads } = await searchAndEnrichPeople({
      api_key: apiKey,
      person_titles: personTitles,
      q_keywords: qKeywords || undefined,
      page: 1,
      per_page: 50,
    } as any);

    const mappedLeads = (apolloLeads || []).map((l: any) => ({
      campaign_id: campaign?.id,
      user_id: userId,
      name: `${l.firstName || ''} ${l.lastName || ''}`.trim() || l.email || 'Unknown',
      email: l.email || null,
      title: l.title || null,
      company: l.company || company_name || null,
      linkedin_url: l.linkedinUrl || null,
      source: 'apollo',
    }));

    if (mappedLeads.length) {
      await supabaseDb.from('campaign_leads').insert(mappedLeads.map((m) => ({ ...m, campaign_id: campaign?.id })));
      await supabaseDb
        .from('leads')
        .insert(
          mappedLeads
            .filter((m) => !!m.email)
            .map((m) => ({
              user_id: userId,
              name: m.name,
              email: m.email,
              title: m.title,
              company: m.company,
              linkedin_url: m.linkedin_url,
              campaign_id: campaign?.id,
              source: 'apollo',
            }))
        )
        .catch(() => {});
    }

    // Mark campaign active
    await supabaseDb.from('campaigns').update({ status: 'active' }).eq('id', campaign?.id);

    // Email notification (simple)
    try {
      const { data: userRow } = await supabaseDb.from('users').select('email').eq('id', userId).maybeSingle();
      if (userRow?.email) {
        await sendEmail(
          userRow.email,
          'Your hiring manager campaign launched',
          `We found ${mappedLeads.length} leads for your hiring manager outreach campaign.`,
          `<p>We found <strong>${mappedLeads.length}</strong> leads for your hiring manager outreach campaign targeting ${company_name || 'this role'}.</p>`
        );
      }
    } catch (e) {
      console.warn('launch email failed', e);
    }

    return res.json({
      campaign,
      jobReq,
      leads_added: mappedLeads.length,
      titles_used: personTitles,
    });
  } catch (e: any) {
    console.error('hiring-manager-launch error', e);
    res.status(500).json({ error: e?.message || 'launch_failed' });
  }
});

export default router;
