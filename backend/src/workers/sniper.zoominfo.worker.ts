import { Worker, Queue } from 'bullmq';
import * as cheerio from 'cheerio';
import { connection } from '../queues/redis';
import { supabaseDb } from '../../lib/supabase';
import { scrapeZoomInfoCompany } from '../utils/decodo';

type ZoomInfoJob = {
  runId: string;
  userId: string;
  company_name: string;
  company_domain?: string | null;
  location?: string | null;
  job_department?: string | null;
  max_contacts: number;
  zoominfo_enabled: boolean;
};

const queueName = 'sniper:zoominfo_enrich';
const apolloQueue = new Queue('sniper:apollo_decision_makers', { connection });

export const zoomInfoCompanyWorker = new Worker<ZoomInfoJob>(
  queueName,
  async (job) => {
    const { runId, userId, company_name, company_domain, job_department, max_contacts, zoominfo_enabled } = job.data;
    if (!zoominfo_enabled) return { skipped: true };

    // Cache check (best-effort)
    try {
      if (company_domain) {
        const { data: cached } = await supabaseDb
          .from('zoominfo_company_cache')
          .select('id, payload, last_scraped_at')
          .eq('company_domain', company_domain)
          .maybeSingle();
        if (cached) {
          // Could short-circuit, but still proceed to schedule Apollo below
        }
      }
    } catch {}

    // Build a search URL as a fallback (company pages are opaque)
    const query = encodeURIComponent([company_name, company_domain].filter(Boolean).join(' '));
    const url = `https://www.zoominfo.com/search/company?q=${query}`;
    const { html } = await scrapeZoomInfoCompany(url);
    const contacts = parseZoomInfoContacts(html || '', { department: job_department, limit: max_contacts });

    // Insert candidates into sniper_results
    const insertedIds: string[] = [];
    if (contacts.length) {
      const toInsert = contacts.map((c) => ({
        run_id: runId,
        user_id: userId,
        source_type: 'zoominfo_decision_maker',
        source_platform: 'zoominfo',
        normalized: {
          company_name,
          company_domain: company_domain || null,
          job_title: c.title,
          full_name: c.name,
          department: c.department || null,
          seniority: c.seniority || null,
          location: c.location || null,
          linkedin_url: c.linkedin_url || null,
          email: null,
          phone: null,
          zoominfo_url: c.zoominfo_url || null
        },
        raw: c
      }));
      const { data, error } = await supabaseDb.from('sniper_results').insert(toInsert as any).select('id');
      if (!error && Array.isArray(data)) {
        insertedIds.push(...data.map((r: any) => r.id));
      }
    }

    // Schedule Apollo enrichment (even if 0 contacts, fallback worker can derive)
    await apolloQueue.add('apollo_from_zoominfo', {
      runId,
      userId,
      company_name,
      company_domain: company_domain || null,
      contacts: contacts.map((c, i) => ({
        full_name: c.name,
        job_title: c.title,
        location: c.location || null,
        zoominfo_sniper_result_id: insertedIds[i] || null
      })),
      max_contacts: job.data.max_contacts,
      zoominfo_enabled: true
    });

    return { candidates: contacts.length };
  },
  { connection }
);

function parseZoomInfoContacts(html: string, opts: { department?: string | null; limit: number }): Array<{
  name: string;
  title: string;
  department?: string | null;
  seniority?: string | null;
  location?: string | null;
  linkedin_url?: string | null;
  zoominfo_url?: string | null;
}> {
  const $ = cheerio.load(html || '');
  const out: any[] = [];
  // Best-effort parsing; ZoomInfo HTML varies. Look for anchors with person paths.
  $('a[href*="/p/"], a[href*="/people/"]').each((_i, el) => {
    if (out.length >= opts.limit) return false;
    const a = $(el);
    const href = a.attr('href') || '';
    const zoominfo_url = href.startsWith('http') ? href : `https://www.zoominfo.com${href}`;
    const card = a.closest('div');
    const name = a.text().trim();
    const title = card.find('div:contains("Title")').last().text().trim() || card.find('span').eq(1).text().trim() || '';
    const location = card.find('div:contains("Location")').last().text().trim() || null;
    const linkedin_url = (card.find('a[href*="linkedin.com"]').attr('href') || null) as string | null;
    let department: string | null = null;
    let seniority: string | null = null;
    if (opts.department) department = opts.department;
    // Derive seniority from title
    const t = title.toLowerCase();
    if (/chief|c[-\s]?level|cso|ceo|cto|coo/.test(t)) seniority = 'C-Level';
    else if (/\bvp\b|vice president|svp|evp/.test(t)) seniority = 'VP';
    else if (/head|director/.test(t)) seniority = 'Director';
    else if (/manager/.test(t)) seniority = 'Manager';
    out.push({ name, title, department, seniority, location, linkedin_url, zoominfo_url });
  });
  return out.slice(0, opts.limit);
}


