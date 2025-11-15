import { Worker } from 'bullmq';
import { connection } from '../queues/redis';
import { supabaseDb } from '../../lib/supabase';

type ApolloJob = {
  runId: string;
  userId: string;
  company_name: string;
  company_domain: string | null;
  contacts: Array<{ full_name: string; job_title: string; location: string | null; zoominfo_sniper_result_id?: string | null }>;
  max_contacts: number;
  zoominfo_enabled: boolean;
};

export const apolloDecisionMakerWorker = new Worker<ApolloJob>(
  'sniper:apollo_decision_makers',
  async (job) => {
    const { runId, userId, company_name, contacts, max_contacts, zoominfo_enabled } = job.data;

    try {
      // Get Apollo key (shared if available)
      let apolloApiKey: string | undefined = process.env.SUPER_ADMIN_APOLLO_API_KEY;
      if (!apolloApiKey) {
        const { data: settings } = await supabaseDb.from('user_settings').select('apollo_api_key').eq('user_id', userId).maybeSingle();
        apolloApiKey = (settings as any)?.apollo_api_key || undefined;
      }
      if (!apolloApiKey) {
        // No Apollo; skip
        return { enriched: 0, zoominfoCharged: false };
      }

      // Derive search parameters
      const { searchAndEnrichPeople } = await import('../../utils/apolloApi');

      // If we have candidate titles, prefer them; otherwise search common DM titles per department
      const titles = uniqueTitles(contacts.map((c) => c.job_title)).slice(0, Math.max(1, Math.min(max_contacts, 5)));
      const searchParams: any = {
        api_key: apolloApiKey,
        person_titles: titles.length ? [titles.join(' OR ')] : undefined,
        q_keywords: company_name,
        page: 1,
        per_page: Math.max(max_contacts * 3, 25)
      };

      const { leads } = await searchAndEnrichPeople(searchParams);
      const enriched = (leads || []).filter((l: any) => !!l.email).slice(0, max_contacts);

      // Update sniper_results and upsert leads
      let updated = 0;
      for (const en of enriched) {
        // Find corresponding zoominfo result by name/title if provided
        const zr = await matchZoominfoResult(runId, userId, company_name, en);
        if (zr) {
          await supabaseDb
            .from('sniper_results')
            .update({
              normalized: {
                ...(zr.normalized || {}),
                email: en.email || null,
                phone: null,
                linkedin_url: en.linkedinUrl || (en as any).linkedin_url || null
              }
            } as any)
            .eq('id', zr.id);
        }
        // Upsert into global leads table
        await upsertLead(userId, {
          name: `${en.firstName} ${en.lastName}`.trim(),
          email: en.email || '',
          title: en.title || '',
          company: company_name,
          location: [en.city, en.state, en.country].filter(Boolean).join(', '),
          linkedin_url: en.linkedinUrl || (en as any).linkedin_url || null,
          origin: zr ? 'sniper_zoominfo_enriched' : 'sniper_apollo_decision_maker',
          origin_run_id: runId,
          origin_source: zr ? 'zoominfo' : 'apollo'
        });
        updated += 1;
      }

      // ZoomInfo credit logic: charge +1 if zoominfo_enabled and at least one email found and at least one zoominfo result exists
      let zoominfoCharged = false;
      if (zoominfo_enabled) {
        const hasZoominfoCandidates = contacts.some((c) => !!c.zoominfo_sniper_result_id);
        if (hasZoominfoCandidates && enriched.length > 0) {
          try {
            const { CreditService } = await import('../../services/creditService');
            await CreditService.deductCredits(job.data.userId, 1, 'api_usage', `ZoomInfo company unlock: ${company_name}`);
            zoominfoCharged = true;
          } catch (e) {
            // Non-fatal
          }
        }
      }

      return { enriched: updated, zoominfoCharged };
    } catch (e: any) {
      // Non-fatal: let job fail to retry if configured by queue
      throw e;
    }
  },
  { connection }
);

function uniqueTitles(titles: string[]): string[] {
  const set = new Set<string>();
  for (const t of titles) {
    const s = String(t || '').trim();
    if (s) set.add(s);
  }
  // If none, seed with common decision maker titles
  if (set.size === 0) {
    ['Head of', 'Director', 'VP', 'Manager'].forEach((p) => set.add(p));
  }
  return Array.from(set);
}

async function matchZoominfoResult(runId: string, userId: string, company: string, en: any): Promise<{ id: string; normalized: any } | null> {
  try {
    const { data } = await supabaseDb
      .from('sniper_results')
      .select('id, normalized')
      .eq('run_id', runId)
      .eq('user_id', userId)
      .eq('source_type', 'zoominfo_decision_maker');
    const nameLc = `${String(en.firstName || '').toLowerCase()} ${String(en.lastName || '').toLowerCase()}`.trim();
    const titleLc = String(en.title || '').toLowerCase();
    const cand = (data || []).find((r: any) => {
      const rn = String(r?.normalized?.full_name || '').toLowerCase();
      const rt = String(r?.normalized?.job_title || '').toLowerCase();
      const rc = String(r?.normalized?.company_name || '').toLowerCase();
      return rc.includes(company.toLowerCase()) && (rn.includes(nameLc) || rt.includes(titleLc));
    });
    return cand || null;
  } catch {
    return null;
  }
}

async function upsertLead(userId: string, p: {
  name: string;
  email: string;
  title: string;
  company: string;
  location: string | null;
  linkedin_url: string | null;
  origin: string;
  origin_run_id: string;
  origin_source: string;
}) {
  const row = {
    user_id: userId,
    name: p.name,
    email: p.email,
    title: p.title,
    company: p.company,
    location: p.location,
    linkedin_url: p.linkedin_url,
    source: p.origin,
    enrichment_source: p.origin_source,
    enrichment_data: {
      origin_run_id: p.origin_run_id
    }
  } as any;
  // Upsert by (user_id, email)
  try {
    const { data: existing } = await supabaseDb
      .from('leads')
      .select('id')
      .eq('user_id', userId)
      .eq('email', p.email)
      .maybeSingle();
    if (existing?.id) {
      await supabaseDb.from('leads').update(row).eq('id', existing.id);
    } else {
      await supabaseDb.from('leads').insert(row);
    }
  } catch {}
}


