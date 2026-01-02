import { Worker } from 'bullmq';
import { connection } from '../queues/redis';
import { supabaseDb } from '../../lib/supabase';

type ApolloJob = {
  runId: string;
  userId: string;
  company_name: string;
  company_domain: string | null;
  contacts: Array<{ full_name: string; job_title: string; location: string | null }>;
  max_contacts: number;
};

export const apolloDecisionMakerWorker = new Worker<ApolloJob>(
  'sniper:apollo_decision_makers',
  async (job) => {
    const { runId, userId, company_name, contacts, max_contacts } = job.data;

    try {
      // Get Apollo key (shared if available)
      let apolloApiKey: string | undefined = process.env.SUPER_ADMIN_APOLLO_API_KEY;
      if (!apolloApiKey) {
        const { data: settings } = await supabaseDb.from('user_settings').select('apollo_api_key').eq('user_id', userId).maybeSingle();
        apolloApiKey = (settings as any)?.apollo_api_key || undefined;
      }
      if (!apolloApiKey) {
        // No Apollo; skip
        return { enriched: 0 };
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
        // Upsert into global leads table
        await upsertLead(userId, {
          name: `${en.firstName} ${en.lastName}`.trim(),
          email: en.email || '',
          title: en.title || '',
          company: company_name,
          location: [en.city, en.state, en.country].filter(Boolean).join(', '),
          linkedin_url: en.linkedinUrl || (en as any).linkedin_url || null,
          origin: 'sniper_apollo_decision_maker',
          origin_run_id: runId,
          origin_source: 'apollo'
        });
        updated += 1;
      }

      return { enriched: updated };
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


