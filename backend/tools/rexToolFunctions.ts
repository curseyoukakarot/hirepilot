// rexToolFunctions.ts
// MCP-compatible placeholder implementations for REX tools

import { supabaseDb } from '../lib/supabase';
import { notifySlack } from '../lib/slack';
import sgMail from '@sendgrid/mail';
import { searchAndEnrichPeople } from '../utils/apolloApi';
import { enrichLead as apolloEnrichLead } from '../services/apollo/enrichLead';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { personalizeMessage } from '../utils/messageUtils';

export async function sourceLeads({
  userId,
  campaignId,
  source,
  filters
}: {
  userId: string;
  campaignId: string;
  source: 'apollo' | 'linkedin';
  filters: Record<string, any>;
}) {
  // Resolve campaign id: allow non-UUID sentinel (e.g., 'latest' or slug) by mapping to user's latest or creating a new campaign
  let targetCampaignId = campaignId;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(campaignId || ''));
  if (!isUuid) {
    // Default behavior: create a NEW campaign unless explicitly told to reuse 'latest'
    if (String(campaignId || '').toLowerCase() === 'latest') {
      const { data: ctx } = await supabaseDb
        .from('rex_user_context')
        .select('latest_campaign_id')
        .eq('supabase_user_id', userId)
        .maybeSingle();
      if (ctx?.latest_campaign_id) {
        targetCampaignId = ctx.latest_campaign_id;
      } else {
        const title = String(filters?.title || filters?.keywords || 'Sourcing Campaign').slice(0, 80);
        const { data: newCamp, error: newErr } = await supabaseDb
          .from('sourcing_campaigns')
          .insert({ title, created_by: userId, audience_tag: 'rex' })
          .select('id')
          .single();
        if (newErr) throw newErr;
        targetCampaignId = newCamp.id;
      }
    } else {
      const title = String(campaignId || filters?.title || filters?.keywords || 'Sourcing Campaign').slice(0, 80);
      const { data: newCamp, error: newErr } = await supabaseDb
        .from('sourcing_campaigns')
        .insert({ title, created_by: userId, audience_tag: 'rex' })
        .select('id')
        .single();
      if (newErr) throw newErr;
      targetCampaignId = newCamp.id;
    }
  } else {
    // UUID supplied: ensure it exists in sourcing_campaigns; if not, create one and map title from legacy campaigns if available
    const { data: exists } = await supabaseDb
      .from('sourcing_campaigns')
      .select('id')
      .eq('id', targetCampaignId)
      .maybeSingle();
    if (!exists?.id) {
      let title = String(filters?.title || filters?.keywords || 'Sourcing Campaign').slice(0, 80);
      try {
        const { data: legacy } = await supabaseDb
          .from('campaigns')
          .select('title')
          .eq('id', targetCampaignId)
          .maybeSingle();
        if (legacy?.title) title = legacy.title;
      } catch {}
      const { data: newCamp, error: newErr } = await supabaseDb
        .from('sourcing_campaigns')
        .insert({ id: targetCampaignId, title, created_by: userId, audience_tag: 'rex' })
        .select('id')
        .single();
      if (newErr) throw newErr;
      targetCampaignId = newCamp.id;
    }
  }
  // Temporary: Treat LinkedIn requests as Apollo fallback so users get results now
  if (source === 'linkedin') {
    console.warn('[sourceLeads] LinkedIn requested; falling back to Apollo search for immediate results');
  }

  // 1. Determine Apollo API key
  let apolloApiKey: string | undefined;
  const { data: settingsRow } = await supabaseDb
    .from('user_settings')
    .select('apollo_api_key')
    .eq('user_id', userId)
    .single();

  apolloApiKey = settingsRow?.apollo_api_key ?? process.env.HIREPILOT_APOLLO_API_KEY;

  if (!apolloApiKey) throw new Error('No Apollo API key configured');

  // 2. Build Apollo search params using the same logic as Campaign Wizard
  const desiredCount = Math.max(1, Math.min(200, Number(filters?.count || filters?.limit || filters?.per_page || 25)));
  const searchParams: any = {
    api_key: apolloApiKey,
    page: 1,
    per_page: Math.min(100, desiredCount)
  };
  const titleInput = String(filters?.title || filters?.jobTitle || filters?.keywords || '').trim();
  const locationInput = String(filters?.location || filters?.person_locations || '').trim();
  if (filters?.booleanSearch && titleInput) {
    // Boolean query placed into person_titles for Apollo native OR
    searchParams.person_titles = [titleInput];
  } else if (titleInput) {
    searchParams.person_titles = [titleInput];
  }
  if (locationInput) {
    searchParams.person_locations = [locationInput];
  }
  if (filters?.q_keywords) searchParams.q_keywords = filters.q_keywords;

  // 3. Search & enrich people
  // Fetch multiple pages if needed to reach desiredCount
  let allLeads: any[] = [];
  let currentPage = 1;
  while (allLeads.length < desiredCount && currentPage <= 5) {
    const pageParams = { ...searchParams, page: currentPage } as any;
    const { leads } = await searchAndEnrichPeople(pageParams);
    allLeads.push(...leads);
    if (!leads || leads.length < pageParams.per_page) break; // no more pages
    currentPage += 1;
  }

  if (!allLeads.length) return { imported: 0 };

  // 4. Insert leads into sourcing_leads (dedupe by email within campaign)
  // Tighten title filtering post-fetch for accuracy
  const mustTitles: string[] = (titleInput ? [titleInput] : []).concat(titleInput.toLowerCase().includes('vp') ? ['vice president of sales','vp sales','vp of sales'] : []);
  const rigidMatch = (title: string) => {
    const tl = String(title || '').toLowerCase();
    return mustTitles.length === 0 || mustTitles.some(t => tl.includes(t));
  };

  const filteredLeads = allLeads.filter(l => rigidMatch(l.title));

  const uniqueLeads = filteredLeads.filter((l: any, idx: number, arr: any[]) => {
    if (!l.email) return false;
    return arr.findIndex(a => a.email === l.email) === idx;
  });

  const leadRows = uniqueLeads.map((l: any) => ({
    campaign_id: targetCampaignId,
    name: [l.firstName, l.lastName].filter(Boolean).join(' ').trim() || null,
    title: l.title || null,
    company: l.company || null,
    linkedin_url: l.linkedinUrl || null,
    email: l.email || null,
    domain: l.domain || null,
    enriched: !!l.email
  }));

  // Upsert by (campaign_id, email) if constraint exists; otherwise filter out existing emails first
  // Best-effort: try insert and ignore duplicates
  const { data: insertedLeads, error } = await supabaseDb
    .from('sourcing_leads')
    .insert(leadRows)
    .select();

  if (error) {
    console.error('[sourceLeads] sourcing_leads insert error', error);
    throw new Error('Failed to insert leads');
  }

  await notifySlack(`📥 Imported ${insertedLeads?.length || 0} leads into sourcing campaign ${targetCampaignId}`);

  return { imported: insertedLeads?.length || 0, campaign_id: targetCampaignId };
}

/**
 * Filter existing leads for a user/campaign by simple criteria
 * Supported filters:
 *  - has_email: boolean
 *  - verified_only: boolean (checks enrichment_data.apollo.email_status === 'verified')
 *  - personal_email_only: boolean (heuristic: common personal domains)
 *  - limit: number (default 25)
 */
export async function filterLeads({
  userId,
  campaignId,
  filters
}: {
  userId: string;
  campaignId?: string;
  filters?: Record<string, any>;
}) {
  function normalize(text: string): string {
    return (text || '').toLowerCase().trim();
  }

  function inferSeniority(titleLower: string): 'c_level' | 'evp' | 'svp' | 'vp' | 'director' | 'manager' | 'lead' | 'senior' | 'mid' | 'junior' | 'unknown' {
    if (!titleLower) return 'unknown';
    if (/chief|cxo|c-level|cto|ceo|cfo|coo/.test(titleLower)) return 'c_level';
    if (/(exec|executive)\s*vice\s*president|\bevps?\b/.test(titleLower)) return 'evp';
    if (/senior\s*vice\s*president|\bsvps?\b/.test(titleLower)) return 'svp';
    if (/\bvp\b|vice\s*president/.test(titleLower)) return 'vp';
    if (/director|head\s+of/.test(titleLower)) return 'director';
    if (/manager/.test(titleLower)) return 'manager';
    if (/lead\b/.test(titleLower)) return 'lead';
    if (/\bsenior\b|\bsr\b/.test(titleLower)) return 'senior';
    if (/associate|specialist|representative|coordinator/.test(titleLower)) return 'mid';
    if (/junior|jr\b|entry/.test(titleLower)) return 'junior';
    return 'unknown';
  }

  function expandTitleSynonyms(raw: string): string[] {
    const t = normalize(raw);
    const out = new Set<string>();
    out.add(t);
    // Account Executive family
    if (/account\s+executive|\bae\b/.test(t)) {
      ['account executive','ae','sales executive','account exec','account rep'].forEach(s => out.add(s));
    }
    // Talent leadership family
    if (/vp.*talent|vice.*talent/.test(t)) {
      ['vp of talent','vp talent','vice president talent','vp talent acquisition','vp people','vp people operations','vp hr','vice president human resources'].forEach(s => out.add(s));
    }
    // Generic cleanups
    out.add(t.replace('of ', '')); // e.g., vp of talent -> vp talent
    return Array.from(out);
  }

  function titleMatches(targetTitle: string, opts: { titles?: string[]; strictLevel?: boolean }): boolean {
    const tl = normalize(targetTitle);
    if (!opts.titles || opts.titles.length === 0) return true;

    // Must match one of the synonyms via substring
    const anyMatch = opts.titles.some(s => tl.includes(normalize(s)));
    if (!anyMatch) return false;

    if (opts.strictLevel) {
      // Compare seniority of requested titles vs candidate
      const requestedLevels = new Set(opts.titles.map(s => inferSeniority(normalize(s))));
      const candidateLevel = inferSeniority(tl);
      // If any requested level is specific (not unknown/mid/junior/senior), require exact match
      const concrete = Array.from(requestedLevels).filter(l => ['vp','director','manager','c_level','evp','svp','lead'].includes(l as string));
      if (concrete.length > 0) {
        return concrete.includes(candidateLevel);
      }
    }
    return true;
  }

  // Resolve target campaign if a sentinel like 'latest' is provided
  let targetCampaignId = campaignId;
  if (campaignId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId)) {
    const { data: ctx } = await supabaseDb
      .from('rex_user_context')
      .select('latest_campaign_id')
      .eq('supabase_user_id', userId)
      .maybeSingle();
    targetCampaignId = ctx?.latest_campaign_id || undefined;
  }

  const limit = Math.max(1, Math.min(200, Number(filters?.limit || filters?.count || 25)));

  let query = supabaseDb
    .from('leads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (targetCampaignId) {
    query = query.eq('campaign_id', targetCampaignId);
  }

  if (filters?.has_email) {
    query = query.not('email', 'is', null).neq('email', '');
  }

  if (filters?.verified_only) {
    // JSON path filter: enrichment_data->apollo->>email_status = 'verified'
    query = query.filter('enrichment_data->apollo->>email_status', 'eq', 'verified');
  }

  // Pre-filter by title tokens/synonyms at the DB level, then refine in-memory
  let requestedTitles: string[] | undefined;
  if (filters?.title) {
    const baseTitles: string[] = Array.isArray(filters.title) ? filters.title : [String(filters.title)];
    requestedTitles = (filters?.synonyms === false ? baseTitles : baseTitles.flatMap(expandTitleSynonyms));
    // Build OR list for PostgREST .or() helper
    const orParts = requestedTitles.map(s => `title.ilike.%${s.replace(/[,]/g, ' ')}%`);
    if (orParts.length > 0) {
      // Supabase .or applies across existing AND constraints
      query = query.or(orParts.join(','));
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to filter leads: ${error.message}`);
  }

  let leads = data || [];

  if (filters?.personal_email_only) {
    const personalDomains = new Set([
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'me.com', 'aol.com', 'live.com', 'pm.me', 'proton.me', 'protonmail.com'
    ]);
    leads = leads.filter((l: any) => {
      const email: string | null = l.email || null;
      if (!email || !email.includes('@')) return false;
      const domain = email.split('@').pop()!.toLowerCase();
      return personalDomains.has(domain);
    });
  }

  // Refine title accuracy in-memory with optional strict seniority matching
  if (requestedTitles && requestedTitles.length > 0) {
    const strictLevel = Boolean(filters?.strict_level);
    leads = leads.filter((l: any) => titleMatches(l.title || '', { titles: requestedTitles, strictLevel: strictLevel }));
  }

  // Shape a compact response suitable for chat summaries
  const shaped = leads.map((l: any) => ({
    id: l.id,
    name: `${l.first_name || ''} ${l.last_name || ''}`.trim() || l.name || null,
    title: l.title || null,
    company: l.company || null,
    email: l.email || null,
    email_status: l.enrichment_data?.apollo?.email_status || null,
    linkedin_url: l.linkedin_url || null
  }));

  return { count: shaped.length, leads: shaped };
}

export async function enrichLead({
  userId,
  leadId,
  fields
}: {
  userId: string;
  leadId: string;
  fields: string[];
}) {
  // Fetch minimal lead data
  const { data: leadRow, error: leadErr } = await supabaseDb
    .from('leads')
    .select('first_name, last_name, company, linkedin_url')
    .eq('id', leadId)
    .single();

  if (leadErr || !leadRow) throw new Error('Lead not found');

  // Apollo enrichment only
  if (!fields.includes('email') && !fields.includes('phone')) {
    throw new Error('No enrichment fields requested');
  }

    try {
      const resp = await apolloEnrichLead({
        leadId,
        userId,
        firstName: leadRow.first_name,
        lastName: leadRow.last_name,
        company: leadRow.company,
        linkedinUrl: leadRow.linkedin_url
      });
      return { provider: 'apollo', ...resp };
    } catch (e) {
    throw new Error(`Apollo enrichment failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}

export async function enrichLeadProfile({
  userId,
  name,
  email,
  linkedinUrl
}: {
  userId: string;
  name: string;
  email?: string;
  linkedinUrl: string;
}) {
  console.log(`[REX enrichLeadProfile] Starting enrichment for: ${name}, email: ${email}, linkedinUrl: ${linkedinUrl}`);
  try {
    // Step 1: Find the lead in the database
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    // Normalize LinkedIn URL for better matching
    let normalizedUrl = '';
    if (linkedinUrl) {
      normalizedUrl = linkedinUrl
        .toLowerCase()
        .replace(/\/$/, '') // Remove trailing slash
        .replace(/\?.*$/, '') // Remove query parameters
        .replace(/^https?:\/\/(www\.)?/, '') // Remove protocol and www
        .replace(/linkedin\.com\//, '') // Remove base domain
        .replace(/sales\/lead\//, 'in/') // Normalize Sales Navigator to regular format
        .replace(/sales\/people\//, 'in/'); // Handle other Sales Navigator formats
    }
    
    console.log(`[REX] Searching for lead: name="${name}", firstName="${firstName}", lastName="${lastName}", normalizedUrl="${normalizedUrl}"`);

    let leads = null;
    let searchError = null;

    // Strategy 1: Try to find by LinkedIn URL (exact and fuzzy match)
    if (linkedinUrl) {
      console.log(`[REX] Strategy 1: Searching by LinkedIn URL`);
      
      // Try exact URL match first
      let { data, error } = await supabaseDb
        .from('leads')
        .select('*')
        .eq('user_id', userId)
        .eq('linkedin_url', linkedinUrl);
      
      // If no exact match, try with trailing slash
      if (!data || data.length === 0) {
        const result = await supabaseDb
          .from('leads')
          .select('*')
          .eq('user_id', userId)
          .eq('linkedin_url', `${linkedinUrl}/`);
        data = result.data;
        error = result.error;
      }
      
      // If still no match, try fuzzy matching with normalized URL
      if ((!data || data.length === 0) && normalizedUrl) {
        const result = await supabaseDb
          .from('leads')
          .select('*')
          .eq('user_id', userId)
          .ilike('linkedin_url', `%${normalizedUrl}%`);
        data = result.data;
        error = result.error;
      }
      
      leads = data;
      searchError = error;
      console.log(`[REX] Strategy 1 results: ${leads?.length || 0} leads found`);
    }

    // Strategy 2: If no URL match, try name matching
    if (!leads || leads.length === 0) {
      console.log(`[REX] Strategy 2: Searching by name`);
      let nameQuery = supabaseDb
        .from('leads')
        .select('*')
        .eq('user_id', userId)
        .ilike('first_name', `%${firstName}%`);
      
      if (lastName) {
        nameQuery = nameQuery.ilike('last_name', `%${lastName}%`);
      }
      
      if (email) {
        nameQuery = nameQuery.eq('email', email);
      }

      const { data, error } = await nameQuery;
      leads = data;
      searchError = error;
      console.log(`[REX] Strategy 2 results: ${leads?.length || 0} leads found`);
    }

    // Strategy 3: If we have both name and URL, try very broad search
    if ((!leads || leads.length === 0) && firstName) {
      console.log(`[REX] Strategy 3: Broad fuzzy search`);
      
      // Try searching for any lead with similar first name
      const { data, error } = await supabaseDb
        .from('leads')
        .select('*')
        .eq('user_id', userId)
        .ilike('first_name', `%${firstName}%`);

      leads = data;
      searchError = error;
      console.log(`[REX] Strategy 3 results: ${leads?.length || 0} leads found`);
      
      // If we found leads and have a URL, filter by URL similarity
      if (leads && leads.length > 0 && normalizedUrl) {
        const urlFilteredLeads = leads.filter(lead => 
          lead.linkedin_url && 
          (lead.linkedin_url.toLowerCase().includes(normalizedUrl) || 
           normalizedUrl.includes(lead.linkedin_url.toLowerCase().replace(/^https?:\/\/(www\.)?linkedin\.com\//, '')))
        );
        
        if (urlFilteredLeads.length > 0) {
          leads = urlFilteredLeads;
          console.log(`[REX] Strategy 3 URL filtered results: ${leads.length} leads found`);
        }
      }
    }

    if (searchError) {
      console.error(`[REX] Database search error:`, searchError);
      throw new Error(`Database search failed: ${searchError.message}`);
    }

    if (!leads || leads.length === 0) {
      console.log(`[REX] No leads found. Tried searching for name="${name}", email="${email || 'none'}", linkedinUrl="${linkedinUrl}"`);
      
      // Provide helpful debugging info
      const { data: allUserLeads } = await supabaseDb
        .from('leads')
        .select('first_name, last_name, linkedin_url')
        .eq('user_id', userId)
        .limit(5);
      
      console.log(`[REX] User has ${allUserLeads?.length || 0} total leads. Sample:`, allUserLeads?.slice(0, 3));
      
      throw new Error(`No lead found matching: "${name}" with LinkedIn: ${linkedinUrl}. Please ensure the lead exists in your database and the name/URL are correct.`);
    }

    // If multiple leads found, prefer exact name match or URL match
    let targetLead = leads[0];
    if (leads.length > 1) {
      console.log(`[REX] Multiple leads found (${leads.length}), selecting best match`);
      
      // Prefer exact name match
      const exactNameMatch = leads.find(lead => 
        lead.first_name?.toLowerCase() === firstName.toLowerCase() && 
        lead.last_name?.toLowerCase() === lastName.toLowerCase()
      );
      
      // Prefer exact URL match
      const exactUrlMatch = leads.find(lead => 
        lead.linkedin_url === linkedinUrl
      );
      
      targetLead = exactNameMatch || exactUrlMatch || leads[0];
      console.log(`[REX] Selected lead: ${targetLead.first_name} ${targetLead.last_name} (${targetLead.linkedin_url})`);
    }

    console.log(`[REX] Found lead: ${targetLead.first_name} ${targetLead.last_name} (ID: ${targetLead.id})`);

    // Step 2: Call the existing Apollo enrichment service directly
    const { enrichWithApollo } = await import('../src/services/apollo/enrichLead');
    
    console.log(`[REX] Starting Apollo enrichment for: ${targetLead.first_name} ${targetLead.last_name}`);
    
    const enrichmentResult = await enrichWithApollo({
      leadId: targetLead.id,
      userId,
      firstName: targetLead.first_name,
      lastName: targetLead.last_name,
      company: targetLead.company,
      linkedinUrl: targetLead.linkedin_url
    });

    if (!enrichmentResult.success) {
      const errorMsg = enrichmentResult.errors?.join(', ') || 'Apollo enrichment failed';
      throw new Error(`Enrichment failed: ${errorMsg}`);
    }

    // Fetch the updated lead data from database
    const { data: enrichedLead, error: fetchError } = await supabaseDb
      .from('leads')
      .select('*')
      .eq('id', targetLead.id)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch enriched lead data: ${fetchError.message}`);
    }

    // Step 3: Format the results for conversational presentation
    return formatEnrichmentResults(targetLead, enrichedLead);

  } catch (error) {
    console.error('[REX enrichLeadProfile] Error:', error);
    console.error('[REX enrichLeadProfile] Error stack:', (error as Error).stack);
    throw new Error(`Lead enrichment failed: ${(error as Error).message}`);
  }
}

function formatEnrichmentResults(originalLead: any, enrichedData: any) {
  const enrichmentData = enrichedData.enrichment_data || {};
  
  let result = `🚀 **Lead Enrichment Results for ${originalLead.first_name} ${originalLead.last_name}**\n\n`;

  // Basic Information
  result += `**📋 Basic Information:**\n`;
  result += `• Name: ${originalLead.first_name} ${originalLead.last_name}\n`;
  result += `• Title: ${originalLead.title || 'Not specified'}\n`;
  result += `• Company: ${originalLead.company || 'Not specified'}\n`;

  // Contact Information
  result += `\n**📞 Contact Information:**\n`;
  
  // Check for enriched email
  const emailSources = [];
  if (enrichmentData.hunter?.email) emailSources.push(`Hunter.io: ${enrichmentData.hunter.email}`);
  if (enrichmentData.skrapp?.email) emailSources.push(`Skrapp.io: ${enrichmentData.skrapp.email}`);
  if (enrichmentData.apollo?.email) emailSources.push(`Apollo: ${enrichmentData.apollo.email}`);
  if (originalLead.email) emailSources.push(`Direct: ${originalLead.email}`);
  
  if (emailSources.length > 0) {
    result += `• Email: ${emailSources[0]}\n`;
    if (emailSources.length > 1) {
      result += `  Additional emails: ${emailSources.slice(1).join(', ')}\n`;
    }
  } else {
    result += `• Email: Not found\n`;
  }

  // Phone
  if (enrichedData.phone || originalLead.phone) {
    result += `• Phone: ${enrichedData.phone || originalLead.phone}\n`;
  }

  // Location
  if (enrichmentData.apollo?.location) {
    const loc = enrichmentData.apollo.location;
    const locationParts = [];
    if (loc.city) locationParts.push(loc.city);
    if (loc.state) locationParts.push(loc.state);
    if (loc.country && loc.country !== 'United States') locationParts.push(loc.country);
    result += `• Location: ${locationParts.join(', ')}\n`;
  } else if (originalLead.location) {
    result += `• Location: ${originalLead.location}\n`;
  }

  // Professional Details
  if (enrichmentData.apollo) {
    result += `\n**💼 Professional Details:**\n`;
    
    if (enrichmentData.apollo.department) {
      result += `• Department: ${enrichmentData.apollo.department}\n`;
    }
    
    if (enrichmentData.apollo.seniority) {
      result += `• Seniority: ${enrichmentData.apollo.seniority}\n`;
    }
    
    if (enrichmentData.apollo.subdepartments?.length > 0) {
      result += `• Functions: ${enrichmentData.apollo.subdepartments.join(', ')}\n`;
    }
  }

  // Social Profiles
  const socialProfiles = [];
  if (enrichmentData.apollo?.twitter_url) socialProfiles.push(`Twitter: ${enrichmentData.apollo.twitter_url}`);
  if (enrichmentData.apollo?.github_url) socialProfiles.push(`GitHub: ${enrichmentData.apollo.github_url}`);
  if (enrichmentData.apollo?.facebook_url) socialProfiles.push(`Facebook: ${enrichmentData.apollo.facebook_url}`);
  
  if (socialProfiles.length > 0) {
    result += `\n**🌐 Social Profiles:**\n`;
    socialProfiles.forEach(profile => result += `• ${profile}\n`);
  }

  // Work History
  if (enrichmentData.apollo?.employment_history?.length > 0) {
    result += `\n**📈 Work History:**\n`;
    enrichmentData.apollo.employment_history.slice(0, 3).forEach((job: any) => {
      result += `• ${job.title || 'Position'} at ${job.organization_name || job.company || 'Company'}`;
      if (job.start_date) {
        const startYear = new Date(job.start_date).getFullYear();
        const endYear = job.end_date ? new Date(job.end_date).getFullYear() : 'Present';
        result += ` (${startYear} - ${endYear})`;
      }
      result += `\n`;
    });
  }

  // Enrichment Sources
  result += `\n**🔍 Data Sources:**\n`;
  const sources = [];
  if (enrichmentData.hunter) sources.push('Hunter.io');
  if (enrichmentData.skrapp) sources.push('Skrapp.io');
  if (enrichmentData.apollo) sources.push('Apollo');
  if (enrichmentData.decodo) sources.push('Decodo');
  
  result += `• Enriched via: ${sources.join(', ') || 'Direct input'}\n`;
  
  if (enrichedData.enriched_at) {
    const enrichedDate = new Date(enrichedData.enriched_at).toLocaleDateString();
    result += `• Last enriched: ${enrichedDate}\n`;
  }

  return result;
}

export async function sendMessage({
  userId,
  leadId,
  messageType,
  tone,
  jobDetails
}: {
  userId: string;
  leadId: string;
  messageType: string;
  tone: string;
  jobDetails: Record<string, any>;
}) {
  // Retrieve lead record
  const { data: lead, error: leadErr } = await supabaseDb
    .from('leads')
    .select('first_name,last_name,email')
    .eq('id', leadId)
    .single();

  if (leadErr || !lead?.email) throw new Error('Lead not found or missing email');

  // Get SendGrid credentials for user
  const { data: sgRow, error: sgErr } = await supabaseDb
    .from('user_sendgrid_keys')
    .select('api_key, default_sender')
    .eq('user_id', userId)
    .single();

  if (sgErr || !sgRow?.api_key) throw new Error('No SendGrid API key configured');

  sgMail.setApiKey(sgRow.api_key);

  const greeting = tone === 'casual' ? `Hey ${lead.first_name}` : `Hello ${lead.first_name}`;
  const subject = messageType === 'followup' ? 'Quick follow-up' : `Opportunity at ${jobDetails?.company || 'our team'}`;
  const body = `${greeting},<br/><br/>`+
    `I wanted to reach out regarding ${jobDetails?.title || 'a role'} ${jobDetails?.company ? `at ${jobDetails.company}` : ''}. `+
    `Let me know if you'd like to chat!<br/><br/>Best,<br/>HirePilot Team`;

  await sgMail.send({
    to: lead.email,
    from: sgRow.default_sender,
    subject,
    html: body
  });

  // Get lead's campaign context
  const { data: leadData } = await supabaseDb
    .from('leads')
    .select('campaign_id')
    .eq('id', leadId)
    .single();

  // Log message
  await supabaseDb.from('messages').insert({
    user_id: userId,
    lead_id: leadId,
    campaign_id: leadData?.campaign_id, // Include campaign attribution
    to_email: lead.email,
    subject,
    content: body,
    provider: 'sendgrid',
    status: 'sent',
    sent_at: new Date().toISOString()
  });

  return { leadId, status: 'sent', preview: body.slice(0, 120) + '...' };
}

// -----------------------------------------------------------------------------
// Tranche 1: Credits & Pipeline helpers
// -----------------------------------------------------------------------------

/**
 * Return credit usage and remaining balance for a user.
 * The query relies on the materialised `user_credits` table which tracks
 * total / used / remaining values. If the row does not exist we fall back to
 * zeros so the UI remains robust.
 */
export async function fetchCredits({ userId }: { userId: string }) {
  const { data, error } = await supabaseDb
    .from('user_credits')
    .select('total_credits, used_credits, remaining_credits')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[fetchCredits] Supabase error', error);
    throw new Error('Unable to fetch credits');
  }

  return {
    totalCredits: data?.total_credits ?? 0,
    creditsUsedThisMonth: data?.used_credits ?? 0,
    creditsRemaining: data?.remaining_credits ?? 0
  };
}

/**
 * Return list of candidates in a specific stage for the campaign's job.
 */
export async function getPipelineStats({
  campaignId,
  stage
}: {
  campaignId: string;
  stage: string;
}) {
  // Resolve the job attached to the campaign
  const { data: campaignRow, error: campErr } = await supabaseDb
    .from('campaigns')
    .select('job_id')
    .eq('id', campaignId)
    .single();

  if (campErr) {
    console.error('[getPipelineStats] Campaign lookup failed', campErr);
    throw new Error('Campaign not found');
  }

  const jobId = campaignRow.job_id;

  // Fetch candidates in the requested stage
  const { data: candidates, error } = await supabaseDb
    .from('candidate_jobs')
    .select(
      'candidate_id, status, candidates(id, first_name, last_name, email, status)' // nested select
    )
    .eq('job_id', jobId)
    .eq('status', stage);

  if (error) {
    console.error('[getPipelineStats] Supabase error', error);
    throw new Error('Unable to fetch pipeline stats');
  }

  // Shape for UI
  return (candidates || []).map((row: any) => ({
    candidateId: row.candidate_id,
    name: `${row.candidates.first_name} ${row.candidates.last_name}`.trim(),
    email: row.candidates.email,
    stage: row.status
  }));
}

/**
 * Move a candidate to a new pipeline stage and optionally send a Slack note.
 */
export async function moveCandidate({
  userId,
  candidateId,
  newStage
}: {
  userId?: string;
  candidateId: string;
  newStage: string;
}) {
  // Resolve candidate id if a name/email was provided
  let resolvedId = candidateId?.trim();
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resolvedId);
  if (!isUUID) {
    let row = null as any;
    if (resolvedId.includes('@')) {
      const { data } = await supabaseDb
        .from('candidates')
        .select('id, first_name, last_name, email')
        .eq('email', resolvedId)
        .maybeSingle();
      row = data;
    }
    if (!row) {
      const parts = resolvedId.split(/\s+/);
      const first = parts[0];
      const last = parts.slice(1).join(' ');
      let q = supabaseDb
        .from('candidates')
        .select('id, first_name, last_name, email')
        .ilike('first_name', `%${first}%`);
      if (last) q = q.ilike('last_name', `%${last}%`);
      const { data } = await q.limit(5);
      if (data && data.length > 0) row = data[0];
    }
    if (!row) {
      throw new Error(`Candidate '${candidateId}' not found`);
    }
    resolvedId = row.id;
  }

  // Attempt to map stage to enum; otherwise delegate to stage-by-title
  const ALLOWED_STATUS = ['sourced','contacted','interviewed','offered','hired','rejected'];
  const lc = newStage.toLowerCase().trim();
  if (!ALLOWED_STATUS.includes(lc)) {
    // If we cannot map to enum, try the job pipeline stage flow (requires userId)
    if (userId) {
      return await moveCandidateToStageId({ userId, candidate: resolvedId, stage: newStage });
    }
    throw new Error(`Stage '${newStage}' is not a valid status. Try using move_candidate_to_stage to move by pipeline stage title.`);
  }

  // Update the status in candidate_jobs (all linked jobs) using enum
  const { data: updatedRows, error } = await supabaseDb
    .from('candidate_jobs')
    .update({ status: lc, updated_at: new Date().toISOString() })
    .eq('candidate_id', resolvedId)
    .select();

  if (error) {
    console.error('[moveCandidate] Supabase error', error);
    throw new Error('Failed to move candidate');
  }

  // Grab candidate details for notification (use first row)
  if (updatedRows && updatedRows.length > 0) {
    try {
      const { data: candidate, error: candErr } = await supabaseDb
        .from('candidates')
        .select('first_name, last_name')
        .eq('id', resolvedId)
        .single();

  const name = candErr || !candidate ? candidateId : `${candidate.first_name} ${candidate.last_name}`;
  await notifySlack(`🛫 Candidate *${name}* moved to *${newStage}*`);
    } catch (e) {
      console.warn('[moveCandidate] Slack notify failed', e);
    }
  }

  return { candidateId: resolvedId, movedTo: newStage, success: true };
}

/**
 * Move a candidate to a pipeline stage by stage title (resolves candidate and stage ids).
 * Accepts human-friendly inputs so REX can act on natural language like
 * "move Michael Kwan to Peer Interview".
 */
export async function moveCandidateToStageId({
  userId,
  candidate,
  stage,
  jobId
}: {
  userId: string;
  candidate: string; // id, email, or "First Last"
  stage: string;     // stage title text
  jobId?: string;    // optional disambiguation when candidate is in multiple jobs
}) {
  // 1) Resolve candidate id
  let candidateId = candidate.trim();
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidateId);
  if (!isUUID) {
    // Try email first
    let row = null as any;
    if (candidate.includes('@')) {
      const { data } = await supabaseDb
        .from('candidates')
        .select('id, first_name, last_name, email')
        .eq('email', candidate)
        .maybeSingle();
      row = data;
    }
    // Fallback to name search (split by space)
    if (!row) {
      const parts = candidate.split(/\s+/);
      const first = parts[0];
      const last = parts.slice(1).join(' ');
      let q = supabaseDb
        .from('candidates')
        .select('id, first_name, last_name, email')
        .ilike('first_name', `%${first}%`);
      if (last) q = q.ilike('last_name', `%${last}%`);
      const { data } = await q.limit(5);
      if (data && data.length > 0) row = data[0];
    }
    if (!row) {
      throw new Error(`Candidate '${candidate}' not found`);
    }
    candidateId = row.id;
  }

  // 2) Determine job context via candidate_jobs
  let resolvedJobId = jobId || '';
  if (!resolvedJobId) {
    const { data: cj } = await supabaseDb
      .from('candidate_jobs')
      .select('id, job_id')
      .eq('candidate_id', candidateId);
    const jobIds = Array.from(new Set((cj || []).map(r => r.job_id))).filter(Boolean);
    if (jobIds.length === 0) {
      throw new Error('Candidate is not attached to any job');
    }
    if (jobIds.length > 1) {
      throw new Error('Candidate is attached to multiple jobs. Please specify jobId.');
    }
    resolvedJobId = jobIds[0];
  }

  // 3) Resolve stage by title in this job
  // Try schema A: pipeline_stages.job_id
  let { data: stageRow } = await supabaseDb
    .from('pipeline_stages')
    .select('id, title')
    .eq('job_id', resolvedJobId)
    .ilike('title', stage)
    .maybeSingle();
  // If missing, try schema B: job has pipeline_id and pipeline_stages.pipeline_id
  if (!stageRow?.id) {
    const { data: jobRow } = await supabaseDb
      .from('job_requisitions')
      .select('pipeline_id')
      .eq('id', resolvedJobId)
      .maybeSingle();
    if (jobRow?.pipeline_id) {
      const res = await supabaseDb
        .from('pipeline_stages')
        .select('id, title')
        .eq('pipeline_id', jobRow.pipeline_id)
        .ilike('title', stage)
        .maybeSingle();
      stageRow = res.data as any;
    }
  }
  if (!stageRow?.id) {
    // Help the user by listing available titles (try both schemas)
    let { data: allStages } = await supabaseDb
      .from('pipeline_stages')
      .select('title')
      .eq('job_id', resolvedJobId)
      .order('position', { ascending: true });
    if (!allStages || allStages.length === 0) {
      const { data: jobRow } = await supabaseDb
        .from('job_requisitions')
        .select('pipeline_id')
        .eq('id', resolvedJobId)
        .maybeSingle();
      if (jobRow?.pipeline_id) {
        const res = await supabaseDb
          .from('pipeline_stages')
          .select('title')
          .eq('pipeline_id', jobRow.pipeline_id)
          .order('position', { ascending: true });
        allStages = res.data as any;
      }
    }
    const titles = (allStages || []).map((s: any) => s.title).join(', ');
    throw new Error(`Stage '${stage}' not found for this job. Available stages: ${titles || 'none'}`);
  }

  // 4) Update candidate_jobs row(s) for this candidate + job
  // 4) Update candidate_jobs row(s) for this candidate + job
  let updated: any[] | null = null;
  let error: any = null;
  // Try modern schema: stage_id column
  let upd = await supabaseDb
    .from('candidate_jobs')
    .update({ stage_id: stageRow.id, updated_at: new Date().toISOString() })
    .eq('candidate_id', candidateId)
    .eq('job_id', resolvedJobId)
    .select();
  updated = upd.data as any;
  error = upd.error;
  if (error && error.code === '42703') {
    // Column does not exist; fallback to legacy schema: status text
    const fallback = await supabaseDb
      .from('candidate_jobs')
      .update({ status: stageRow.title, updated_at: new Date().toISOString() })
      .eq('candidate_id', candidateId)
      .eq('job_id', resolvedJobId)
      .select();
    updated = fallback.data as any;
    error = fallback.error;
  }
  if (error) {
    console.error('[moveCandidateToStageId] Supabase error', error);
    throw new Error('Failed to move candidate');
  }

  // 5) Slack notify (best effort)
  try {
    const { data: cand } = await supabaseDb
      .from('candidates')
      .select('first_name, last_name')
      .eq('id', candidateId)
      .single();
    const name = cand ? `${cand.first_name || ''} ${cand.last_name || ''}`.trim() : candidateId;
    await notifySlack(`🧭 Candidate *${name}* moved to *${stageRow.title}*`);
  } catch (e) {
    console.warn('[moveCandidateToStageId] Slack notify failed', e);
  }

  return {
    candidateId,
    jobId: resolvedJobId,
    stageId: stageRow.id,
    stageTitle: stageRow.title,
    rowsUpdated: updated?.length || 0,
    success: true
  };
}

// -----------------------------------------------------------------------------
// Tranche 3: Automations & utilities
// -----------------------------------------------------------------------------

/**
 * Trigger a Zapier webhook by name. Expects env var ZAPIER_WEBHOOK_BASE like
 * https://hooks.zapier.com/hooks/catch/XXXXXXX.
 */
export async function triggerZapier({
  webhookName,
  payload
}: {
  webhookName: string;
  payload: Record<string, any>;
}) {
  const base = process.env.ZAPIER_WEBHOOK_BASE;
  if (!base) throw new Error('ZAPIER_WEBHOOK_BASE env not configured');

  const url = `${base}/${webhookName}`;

  const resp = await axios.post(url, payload, { timeout: 10000 }).catch(e => {
    console.error('[triggerZapier] HTTP error', e.response?.data || e.message);
    throw new Error('Zapier webhook call failed');
  });

  return { webhookName, status: resp.status, triggered: true };
}

/**
 * Trigger a Make.com workflow via its public webhook ID.
 */
export async function triggerMakeWorkflow({
  workflowId,
  payload
}: {
  workflowId: string;
  payload: Record<string, any>;
}) {
  const url = `https://hook.integromat.com/${workflowId}`;

  const resp = await axios.post(url, payload, { timeout: 10000 }).catch(e => {
    console.error('[triggerMakeWorkflow] HTTP error', e.response?.data || e.message);
    throw new Error('Make.com webhook failed');
  });

  return { workflowId, status: resp.status, triggered: true };
}

/**
 * Fetch a help article markdown from Supabase storage bucket `help-center` or
 * return not found.
 */
export async function openHelpArticle({ topic }: { topic: string }) {
  try {
    const { data, error } = await supabaseDb.storage.from('help-center').download(`${topic}.md`);
    if (error || !data) {
      return {
        topic,
        title: `Help article: ${topic}`,
        content: 'Article not found.'
      };
    }

    const buffer = await data.arrayBuffer();
    const content = Buffer.from(buffer).toString('utf-8');

    return { topic, title: `Help article: ${topic}`, content };
  } catch (e) {
    console.error('[openHelpArticle] error', e);
    return { topic, title: `Help article: ${topic}`, content: 'Failed to load article.' };
  }
}

/**
 * Check SendGrid delivery/open status for an email message.
 */
export async function getEmailStatus({ emailId }: { emailId: string }) {
  // 1. Locate message row
  const { data: msgRow, error } = await supabaseDb
    .from('messages')
    .select('id, sg_message_id, user_id, status, opened, clicked, sent_at')
    .or(`id.eq.${emailId},sg_message_id.eq.${emailId}`)
    .maybeSingle();

  if (error || !msgRow) {
    throw new Error('Message not found');
  }

  const msgId = msgRow.sg_message_id || emailId;

  // 2. Fetch SendGrid key
  const { data: keyRow, error: keyErr } = await supabaseDb
    .from('user_sendgrid_keys')
    .select('api_key')
    .eq('user_id', msgRow.user_id)
    .single();

  if (keyErr || !keyRow?.api_key) {
    return { emailId: msgId, status: msgRow.status, opened: msgRow.opened, clicked: msgRow.clicked };
  }

  // 3. Call SendGrid messages API
  try {
    const sg = axios.create({
      baseURL: 'https://api.sendgrid.com/v3',
      headers: { Authorization: `Bearer ${keyRow.api_key}` }
    });

    const query = encodeURIComponent(`msg_id='${msgId}'`);
    const resp = await sg.get(`/messages?query=${query}`);

    const events = resp.data.messages?.[0] || {};

    return {
      emailId: msgId,
      status: events.event || msgRow.status,
      opened: events.opens_count ? events.opens_count > 0 : msgRow.opened,
      clicked: events.clicks_count ? events.clicks_count > 0 : msgRow.clicked,
      lastEventTime: events.last_event_time || null
    };
  } catch (e) {
    console.error('[getEmailStatus] SendGrid API error', e.response?.data || e.message);
    // Fallback to DB values
    return { emailId: msgId, status: msgRow.status, opened: msgRow.opened, clicked: msgRow.clicked };
  }
}

// -----------------------------------------------------------------------------
// Zapier / Make setup helpers
// -----------------------------------------------------------------------------

/**
 * Ensure the user has an API key (creates one if absent) and return it.
 */
export async function generateApiKey({ userId }: { userId: string }) {
  // Check existing
  const { data: existing } = await supabaseDb
    .from('api_keys')
    .select('key')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.key) return { apiKey: existing.key };

  const apiKey = uuidv4();
  const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  const { error } = await supabaseDb
    .from('api_keys')
    .insert({ user_id: userId, key: apiKey, environment });

  if (error) throw new Error('Failed to create API key');
  return { apiKey };
}

/**
 * Save a webhook URL + event for the user and return the generated secret.
 */
export async function registerWebhook({
  userId,
  url,
  event
}: {
  userId: string;
  url: string;
  event: string;
}) {
  const secret = uuidv4();
  const { data, error } = await supabaseDb
    .from('webhooks')
    .insert({ user_id: userId, url, event, secret })
    .select('id, secret')
    .single();

  if (error) throw new Error('Failed to save webhook');
  return { webhookId: data.id, secret: data.secret };
}

export function listZapierEndpoints() {
  const base = process.env.BACKEND_URL || 'https://api.thehirepilot.com';
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '') || 'https://your-project.supabase.co';
  
  return {
    actions: {
      createOrUpdateLead: `${base}/api/zapier/leads`,
      enrichLead: `${base}/api/zapier/enrich`,
      testEvent: `${base}/api/zapier/test-event`
    },
    triggers: {
      // New comprehensive trigger (recommended)
      universalEvents: `${base}/api/zapier/triggers/events`,
      supabaseEdgeFunction: `${supabaseUrl}/functions/v1/zap-events`,
      
      // Legacy triggers (deprecated)
      newLead: `${base}/api/zapier/triggers/new-leads`,
      pipelineStageChanged: `${base}/api/zapier/triggers/pipeline-stage-changes`
    },
    eventTypes: {
      leads: [
        'lead_created', 'lead_updated', 'lead_converted', 
        'lead_enriched', 'lead_sourced', 'lead_responded'
      ],
      candidates: [
        'candidate_created', 'candidate_updated', 'candidate_tagged',
        'candidate_interviewed', 'candidate_offered', 'candidate_hired', 'candidate_rejected'
      ],
      pipeline: [
        'pipeline_stage_updated', 'pipeline_created', 'candidate_moved_to_stage'
      ],
      messaging: [
        'message_sent', 'message_reply', 'email_bounced', 'email_opened', 'email_clicked'
      ],
      campaigns: [
        'campaign_created', 'campaign_launched', 'campaign_completed'
      ],
      calendar: [
        'calendar_scheduled'
      ]
    },
    usage: {
      polling: 'Use ?event_type=lead_created&since=2024-01-15T10:00:00Z for filtering',
      webhooks: 'Register webhook URLs via the UI or API to receive real-time events',
      testing: `POST ${base}/api/zapier/test-event with {"event_type": "lead_created"}`
    }
  };
}

/** Return list of available senders for a user */
export async function listSenders({ userId }: { userId: string }) {
  const options:any[]=[];
  // SendGrid
  const { data: sg } = await supabaseDb.from('user_sendgrid_keys').select('default_sender').eq('user_id',userId).maybeSingle();
  if(sg?.default_sender){ options.push({ provider:'sendgrid', from: sg.default_sender }); }
  // Outlook / Gmail tokens in integrations table
  const { data: integrations } = await supabaseDb.from('integrations').select('provider, email').eq('user_id',userId);
  for(const row of integrations||[]){
    if(['google','outlook'].includes(row.provider) && row.email){
      options.push({ provider: row.provider, from: row.email });
    }
  }
  return options;
}

// -----------------------------------------------------------------------------
// Message Scheduling Functions
// -----------------------------------------------------------------------------

/**
 * Schedule bulk messages to multiple leads for future delivery
 */
export async function scheduleBulkMessages({
  userId,
  leadIds,
  templateId,
  scheduledFor,
  channel
}: {
  userId: string;
  leadIds: string[];
  templateId?: string;
  scheduledFor: string;
  channel: 'google' | 'outlook' | 'sendgrid';
}) {
  // Get template content if provided
  let templateContent = '';
  if (templateId) {
    const { data: template, error: templateError } = await supabaseDb
      .from('email_templates')
      .select('content')
      .eq('id', templateId)
      .eq('user_id', userId)
      .single();
    
    if (templateError || !template) {
      throw new Error('Template not found');
    }
    templateContent = template.content;
  }

  // Get lead details
  const { data: leads, error: leadsError } = await supabaseDb
    .from('leads')
    .select('*')
    .in('id', leadIds)
    .eq('user_id', userId);

  if (leadsError || !leads || leads.length === 0) {
    throw new Error('No valid leads found');
  }

  // Create scheduled message records
  const scheduledMessages = leads.map((lead: any) => {
    const personalizedContent = templateContent ? 
      personalizeMessage(templateContent, lead) : 
      `Hello ${lead.first_name || lead.name || 'there'},

I wanted to reach out regarding an opportunity that might interest you.

Best regards,
Your Recruiting Team`;

    return {
      user_id: userId,
      lead_id: lead.id,
      content: personalizedContent,
      template_id: templateId || null,
      channel,
      scheduled_for: scheduledFor,
      status: 'scheduled',
      created_at: new Date().toISOString()
    };
  });

  const { data, error } = await supabaseDb
    .from('scheduled_messages')
    .insert(scheduledMessages)
    .select();

  if (error) {
    console.error('[scheduleBulkMessages] Insert error:', error);
    throw new Error('Failed to schedule messages');
  }

  await notifySlack(`📅 Scheduled ${data.length} messages for ${new Date(scheduledFor).toLocaleString()}`);

  return {
    scheduled: data.length,
    scheduledFor,
    channel,
    messageIds: data.map((msg: any) => msg.id)
  };
}

/**
 * Get scheduled messages for a user
 */
export async function getScheduledMessages({
  userId,
  status = 'scheduled'
}: {
  userId: string;
  status?: 'scheduled' | 'sent' | 'failed' | 'sending';
}) {
  const { data: messages, error } = await supabaseDb
    .from('scheduled_messages')
    .select(`
      id,
      lead_id,
      content,
      channel,
      scheduled_for,
      status,
      created_at,
      leads(first_name, last_name, email, company)
    `)
    .eq('user_id', userId)
    .eq('status', status)
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('[getScheduledMessages] Error:', error);
    throw new Error('Failed to fetch scheduled messages');
  }

  return (messages || []).map((msg: any) => ({
    id: msg.id,
    leadName: `${msg.leads?.first_name || ''} ${msg.leads?.last_name || ''}`.trim() || 'Unknown',
    leadEmail: msg.leads?.email || 'No email',
    leadCompany: msg.leads?.company || 'Unknown company',
    channel: msg.channel,
    scheduledFor: msg.scheduled_for,
    status: msg.status,
    preview: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '')
  }));
}

/**
 * Cancel a scheduled message
 */
export async function cancelScheduledMessage({
  userId,
  messageId
}: {
  userId: string;
  messageId: string;
}) {
  const { data, error } = await supabaseDb
    .from('scheduled_messages')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('id', messageId)
    .eq('user_id', userId)
    .eq('status', 'scheduled')
    .select()
    .single();

  if (error || !data) {
    throw new Error('Message not found or already processed');
  }

  await notifySlack(`❌ Cancelled scheduled message to lead ${data.lead_id}`);

  return { messageId, status: 'cancelled', success: true };
}

/**
 * Get scheduler status and stats
 */
export async function getSchedulerStatus({ userId }: { userId: string }) {
  // Get counts by status
  const { data: statusCounts, error } = await supabaseDb
    .from('scheduled_messages')
    .select('status')
    .eq('user_id', userId);

  if (error) {
    throw new Error('Failed to fetch scheduler status');
  }

  const counts = (statusCounts || []).reduce((acc: any, row: any) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});

  // Get next scheduled message
  const { data: nextMessage } = await supabaseDb
    .from('scheduled_messages')
    .select('scheduled_for, leads(first_name, last_name)')
    .eq('user_id', userId)
    .eq('status', 'scheduled')
    .order('scheduled_for', { ascending: true })
    .limit(1)
    .single();

  return {
    schedulerRunning: true, // The scheduler is always running in our setup
    totalScheduled: counts.scheduled || 0,
    totalSent: counts.sent || 0,
    totalFailed: counts.failed || 0,
    totalCancelled: counts.cancelled || 0,
    nextScheduledMessage: nextMessage ? {
      scheduledFor: nextMessage.scheduled_for,
      leadName: `${(nextMessage as any).leads?.first_name || ''} ${(nextMessage as any).leads?.last_name || ''}`.trim()
    } : null
  };
}

/**
 * Get actual lead count for a campaign (not email metrics)
 */
export async function getCampaignLeadCount({
  userId,
  campaignId
}: {
  userId: string;
  campaignId: string;
}) {
  // Resolve campaign if it's a special keyword like 'latest'
  let targetCampaignId = campaignId;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId);
  
  if (!isUUID) {
    // Treat 'latest' or any non-uuid as request for most recent campaign for user
    const { data: ctxRow } = await supabaseDb
      .from('rex_user_context')
      .select('latest_campaign_id')
      .eq('supabase_user_id', userId)
      .maybeSingle();
    
    if (!ctxRow?.latest_campaign_id) {
      throw new Error('No recent campaign found for user');
    }
    targetCampaignId = ctxRow.latest_campaign_id;
  }

  // Get total lead count for the campaign
  const { count: totalLeads, error: totalError } = await supabaseDb
    .from('leads')
    .select('id', { count: 'exact' })
    .eq('campaign_id', targetCampaignId)
    .eq('user_id', userId);

  if (totalError) {
    throw new Error(`Failed to get lead count: ${totalError.message}`);
  }

  // Get enriched lead count (leads with emails)
  const { count: enrichedLeads, error: enrichedError } = await supabaseDb
    .from('leads')
    .select('id', { count: 'exact' })
    .eq('campaign_id', targetCampaignId)
    .eq('user_id', userId)
    .not('email', 'is', null)
    .neq('email', '');

  if (enrichedError) {
    throw new Error(`Failed to get enriched lead count: ${enrichedError.message}`);
  }

  // Get campaign details
  const { data: campaign, error: campaignError } = await supabaseDb
    .from('campaigns')
    .select('title, status, created_at, updated_at, total_leads, enriched_leads')
    .eq('id', targetCampaignId)
    .eq('user_id', userId)
    .single();

  if (campaignError) {
    throw new Error(`Failed to get campaign details: ${campaignError.message}`);
  }

  return {
    campaign_id: targetCampaignId,
    campaign_title: campaign.title,
    campaign_status: campaign.status,
    actual_total_leads: totalLeads || 0,
    actual_enriched_leads: enrichedLeads || 0,
    stored_total_leads: campaign.total_leads || 0,
    stored_enriched_leads: campaign.enriched_leads || 0,
    unenriched_leads: (totalLeads || 0) - (enrichedLeads || 0),
    enrichment_rate: totalLeads > 0 ? Math.round((enrichedLeads || 0) / totalLeads * 100) : 0,
    created_at: campaign.created_at,
    updated_at: campaign.updated_at
  };
} 

/**
 * Test a Zapier/Make integration by sending a sample event
 */
export async function testZapierIntegration({
  userId,
  eventType,
  webhookUrl
}: {
  userId: string;
  eventType: string;
  webhookUrl?: string;
}) {
  const { ZAP_EVENT_TYPES, emitZapEvent } = await import('../lib/zapEventEmitter');
  
  // Validate event type
  const validEventTypes = Object.values(ZAP_EVENT_TYPES);
  if (!validEventTypes.includes(eventType as any)) {
    throw new Error(`Invalid event type. Valid types: ${validEventTypes.join(', ')}`);
  }

  // If webhook URL provided, register it temporarily for testing
  let webhookId;
  if (webhookUrl) {
    try {
      const result = await registerWebhook({ userId, url: webhookUrl, event: eventType });
      webhookId = result.webhookId;
    } catch (error) {
      throw new Error(`Failed to register webhook: ${error.message}`);
    }
  }

  // Get sample data for the event type
  const sampleData = {
    _test: true,
    _test_timestamp: new Date().toISOString(),
    _test_user_id: userId,
    ...getSampleEventData(eventType)
  };

  try {
    // Emit the test event
    await emitZapEvent({
      userId,
      eventType: eventType as any,
      eventData: sampleData,
      sourceTable: 'test',
      sourceId: `test-${Date.now()}`
    });

    return {
      success: true,
      eventType,
      message: `Test event '${eventType}' sent successfully!`,
      sampleData,
      webhookUrl: webhookUrl || 'Sent to all registered webhooks for this event type',
      note: 'Check your Zapier/Make webhook to see if it received the test data'
    };
  } finally {
    // Clean up temporary webhook if created
    if (webhookId) {
      try {
        await supabaseDb.from('webhooks').delete().eq('id', webhookId);
      } catch (e) {
        console.warn('Failed to cleanup test webhook:', e);
      }
    }
  }
}

/**
 * Get sample data for different event types
 */
function getSampleEventData(eventType: string): Record<string, any> {
  const sampleData: Record<string, any> = {
    lead_created: {
      id: 'test-lead-123',
      email: 'jane.doe@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      company: 'Acme Corp',
      title: 'Software Engineer',
      status: 'new',
      linkedin_url: 'https://linkedin.com/in/janedoe'
    },
    candidate_hired: {
      id: 'test-candidate-456',
      first_name: 'John',
      last_name: 'Smith',
      email: 'john.smith@example.com',
      status: 'hired',
      previous_status: 'offered',
      hired_at: new Date().toISOString()
    },
    message_sent: {
      id: 'test-message-789',
      lead_id: 'test-lead-123',
      subject: 'Exciting Opportunity at Your Company',
      provider: 'sendgrid',
      status: 'sent'
    },
    email_opened: {
      lead_id: 'test-lead-123',
      message_id: 'test-message-789',
      event_timestamp: new Date().toISOString(),
      user_agent: 'Mozilla/5.0 (Mac)'
    }
  };

  return sampleData[eventType] || {
    message: `Sample data for ${eventType}`,
    timestamp: new Date().toISOString()
  };
}

/**
 * Suggest automation workflows based on user's use case
 */
export async function suggestAutomationWorkflows({
  userId,
  useCase,
  tools = []
}: {
  userId: string;
  useCase: string;
  tools?: string[];
}) {
  const workflows: Record<string, any> = {
    'crm_sync': {
      title: 'Sync Candidates to CRM',
      description: 'Automatically add hired candidates to your CRM system',
      trigger: 'candidate_hired',
      actions: [
        'Create contact in HubSpot/Salesforce',
        'Add to "New Hires" pipeline',
        'Send welcome email sequence'
      ],
      zapierSteps: [
        '1. Trigger: HirePilot "Candidate Hired" event',
        '2. Action: Create HubSpot contact with candidate details',
        '3. Action: Send Slack notification to HR team',
        '4. Action: Add to Google Sheets tracking'
      ]
    },
    'interview_scheduling': {
      title: 'Automated Interview Scheduling',
      description: 'Schedule interviews when candidates move to interview stage',
      trigger: 'candidate_moved_to_interview',
      actions: [
        'Create Calendly booking link',
        'Send email with interview details',
        'Notify hiring manager via Slack'
      ],
      zapierSteps: [
        '1. Trigger: HirePilot "Candidate Moved to Interview" event',
        '2. Action: Create Calendly event with candidate',
        '3. Action: Send personalized email via Gmail',
        '4. Action: Post in Slack #hiring channel'
      ]
    },
    'lead_nurturing': {
      title: 'Lead Nurturing Sequence',
      description: 'Follow up with leads who opened emails but didn\'t reply',
      trigger: 'email_opened',
      actions: [
        'Wait 3 days',
        'Send follow-up email',
        'Add to nurture campaign',
        'Update lead score'
      ],
      zapierSteps: [
        '1. Trigger: HirePilot "Email Opened" event',
        '2. Filter: Only if no reply received',
        '3. Delay: Wait 3 days',
        '4. Action: Send follow-up via email provider'
      ]
    },
    'offer_management': {
      title: 'Automated Offer Process',
      description: 'Generate and send offer letters when candidates reach offer stage',
      trigger: 'candidate_offered',
      actions: [
        'Generate offer letter in DocuSign',
        'Send to candidate for signature',
        'Notify legal team',
        'Create calendar reminder for follow-up'
      ],
      zapierSteps: [
        '1. Trigger: HirePilot "Candidate Offered" event',
        '2. Action: Create DocuSign envelope with offer details',
        '3. Action: Send signature request to candidate',
        '4. Action: Create Google Calendar reminder for 48hr follow-up'
      ]
    },
    'team_notifications': {
      title: 'Team Communication Hub',
      description: 'Keep your team informed about hiring progress',
      trigger: 'candidate_moved_to_stage',
      actions: [
        'Post updates in Slack',
        'Update team dashboard',
        'Send email digest to managers'
      ],
      zapierSteps: [
        '1. Trigger: HirePilot "Candidate Moved to Stage" event',
        '2. Action: Post formatted message in Slack',
        '3. Action: Update Notion hiring dashboard',
        '4. Filter + Action: Email manager if moved to final stages'
      ]
    }
  };

  // Find matching workflows
  const matchingWorkflows = Object.entries(workflows).filter(([key, workflow]) => {
    const searchTerms = useCase.toLowerCase();
    return (
      key.includes(searchTerms) ||
      workflow.title.toLowerCase().includes(searchTerms) ||
      workflow.description.toLowerCase().includes(searchTerms) ||
      workflow.trigger.includes(searchTerms)
    );
  });

  if (matchingWorkflows.length === 0) {
    return {
      suggestions: Object.values(workflows).slice(0, 3),
      message: `No specific workflows found for "${useCase}". Here are some popular automation ideas:`,
      customAdvice: `For "${useCase}", consider using these events: candidate_created, lead_enriched, message_reply`
    };
  }

  return {
    suggestions: matchingWorkflows.map(([_, workflow]) => workflow),
    message: `Found ${matchingWorkflows.length} automation workflows for "${useCase}":`,
    setupTip: 'Use the Zapier Integration Card in Settings to get your API key and webhook URLs'
  };
}

/**
 * Guide user through setting up a specific integration
 */
export async function setupIntegrationGuide({
  userId,
  platform,
  eventType
}: {
  userId: string;
  platform: 'zapier' | 'make';
  eventType: string;
}) {
  // Get user's API key or help them create one
  const { data: existingKey } = await supabaseDb
    .from('api_keys')
    .select('key')
    .eq('user_id', userId)
    .maybeSingle();

  const apiKey = existingKey?.key || 'You need to generate an API key first';
  const backendUrl = process.env.BACKEND_URL || 'https://api.thehirepilot.com';

  const guides = {
    zapier: {
      title: `Setting up Zapier Integration for ${eventType}`,
      steps: [
        {
          step: 1,
          title: 'Get Your API Key',
          action: existingKey?.key ? 
            `✅ You already have an API key: ${apiKey}` :
            '🔑 Go to Settings → Integrations → Zapier Integration and click "Generate API Key"'
        },
        {
          step: 2,
          title: 'Create New Zap in Zapier',
          action: 'Go to zapier.com and click "Create Zap"'
        },
        {
          step: 3,
          title: 'Set Up Trigger',
          action: `Choose "Webhooks by Zapier" as trigger → "Catch Hook" → Copy the webhook URL`
        },
        {
          step: 4,
          title: 'Register Webhook in HirePilot',
          action: `In HirePilot Settings, use the Guided Setup to register your webhook URL for event: ${eventType}`
        },
        {
          step: 5,
          title: 'Test the Integration',
          action: `Use the test button or ask me: "REX, test my ${eventType} integration"`
        },
        {
          step: 6,
          title: 'Add Actions',
          action: 'In Zapier, add actions like "Create Google Sheets row", "Send Slack message", etc.'
        }
      ],
      endpoints: {
        polling: `${backendUrl}/api/zapier/triggers/events?event_type=${eventType}`,
        webhook: 'Register via HirePilot UI for push notifications'
      }
    },
    make: {
      title: `Setting up Make.com Integration for ${eventType}`,
      steps: [
        {
          step: 1,
          title: 'Get Your API Key',
          action: existingKey?.key ?
            `✅ You already have an API key: ${apiKey}` :
            '🔑 Go to Settings → Integrations → Zapier Integration and click "Generate API Key"'
        },
        {
          step: 2,
          title: 'Create New Scenario in Make',
          action: 'Go to make.com and click "Create a new scenario"'
        },
        {
          step: 3,
          title: 'Add HTTP Module',
          action: 'Add "HTTP" → "Make a request" as your trigger module'
        },
        {
          step: 4,
          title: 'Configure Polling',
          action: `Set URL: ${backendUrl}/api/zapier/triggers/events?event_type=${eventType}&since={{now}}`
        },
        {
          step: 5,
          title: 'Add Authentication',
          action: `Add header: X-API-Key with value: ${apiKey}`
        },
        {
          step: 6,
          title: 'Test & Add Actions',
          action: 'Test the trigger, then add actions like Airtable, Slack, Gmail, etc.'
        }
      ],
      endpoints: {
        polling: `${backendUrl}/api/zapier/triggers/events?event_type=${eventType}`,
        edgeFunction: `${process.env.SUPABASE_URL || 'https://your-project.supabase.co'}/functions/v1/zap-events`
      }
    }
  };

  return {
    guide: guides[platform],
    quickTest: `To test this integration, say: "REX, test my ${eventType} integration"`,
    troubleshooting: {
      noEvents: 'If no events show up, make sure you have recent activity in HirePilot that would trigger this event type',
      authentication: 'If you get 401 errors, double-check your API key is correct',
      eventFormat: 'Events come with metadata including _test: true for test events'
    }
  };
}

/**
 * Troubleshoot integration issues
 */
export async function troubleshootIntegration({
  userId,
  platform,
  issue
}: {
  userId: string;
  platform: string;
  issue: string;
}) {
  // Check user's setup
  const { data: apiKeyData } = await supabaseDb
    .from('api_keys')
    .select('key, created_at')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: webhooks } = await supabaseDb
    .from('webhooks')
    .select('url, event, created_at')
    .eq('user_id', userId);

  const { data: recentEvents } = await supabaseDb
    .from('zap_events')
    .select('event_type, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  const solutions: Record<string, any> = {
    'no_events': {
      title: 'No Events Showing Up',
      diagnosis: [
        apiKeyData ? '✅ API key exists' : '❌ No API key found',
        recentEvents?.length ? `✅ ${recentEvents.length} recent events found` : '❌ No recent events',
        webhooks?.length ? `✅ ${webhooks.length} webhooks registered` : '❌ No webhooks registered'
      ],
      solutions: [
        !apiKeyData && 'Generate an API key in Settings → Integrations',
        !recentEvents?.length && 'Try performing actions in HirePilot (create leads, move candidates, etc.)',
        !webhooks?.length && 'Register webhook URLs using the Guided Setup',
        'Test with: "REX, test my lead_created integration"'
      ].filter(Boolean)
    },
    'authentication_error': {
      title: 'Authentication / 401 Errors',
      diagnosis: [
        apiKeyData ? '✅ API key exists' : '❌ No API key found',
        `API key created: ${apiKeyData?.created_at || 'Never'}`
      ],
      solutions: [
        'Verify your X-API-Key header is exactly: ' + (apiKeyData?.key || 'Generate an API key first'),
        'Make sure there are no extra spaces or characters',
        'For Make.com, add the header in the HTTP module settings',
        'For Zapier, use Custom Request with the API key header'
      ]
    },
    'missing_data': {
      title: 'Events Missing Expected Data',
      diagnosis: [
        `Recent event types: ${recentEvents?.map(e => e.event_type).join(', ') || 'None'}`,
        'Event data structure varies by event type'
      ],
      solutions: [
        'Use the test endpoint to see exact event structure',
        'Different events have different data fields (lead events vs candidate events)',
        'Check the event_data field for the main payload',
        'Look for _test: true in test events'
      ]
    }
  };

  const issueKey = issue.toLowerCase().replace(/\s+/g, '_');
  const matchedSolution = solutions[issueKey] || solutions['no_events'];

  return {
    issue: issue,
    platform: platform,
    diagnosis: matchedSolution.diagnosis,
    solutions: matchedSolution.solutions,
    currentSetup: {
      hasApiKey: !!apiKeyData,
      webhookCount: webhooks?.length || 0,
      recentEventCount: recentEvents?.length || 0,
      lastEventType: recentEvents?.[0]?.event_type || 'None'
    },
    nextSteps: [
      'Try testing: "REX, test my lead_created integration"',
      'Check the integration card in Settings for detailed endpoints',
      'Review recent events: "REX, show my recent automation events"'
    ]
  };
}

/**
 * Show recent automation events for debugging
 */
export async function getRecentAutomationEvents({
  userId,
  eventType,
  limit = 10
}: {
  userId: string;
  eventType?: string;
  limit?: number;
}) {
  let query = supabaseDb
    .from('zap_events')
    .select('event_type, event_data, source_table, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (eventType) {
    query = query.eq('event_type', eventType);
  }

  const { data: events, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  return {
    events: (events || []).map(event => ({
      eventType: event.event_type,
      timestamp: event.created_at,
      source: event.source_table,
      isTest: event.event_data?._test || false,
      summary: generateEventSummary(event.event_type, event.event_data)
    })),
    totalFound: events?.length || 0,
    filter: eventType ? `Filtered by: ${eventType}` : 'All event types',
    tip: 'Use these events to verify your automations are receiving the right data'
  };
}

export async function linkedin_connect({
  userId,
  linkedin_urls,
  message,
  scheduled_at
}: {
  userId: string;
  linkedin_urls: string[];
  message?: string;
  scheduled_at?: string;
}) {
  try {
    // Validate required parameters
    if (!linkedin_urls || linkedin_urls.length === 0) {
      throw new Error('At least one LinkedIn URL is required');
    }

    // Validate message length if provided
    if (message && message.length > 300) {
      throw new Error('Message cannot exceed 300 characters');
    }

    // Validate LinkedIn URLs
    const invalidUrls = linkedin_urls.filter(url => !url.includes('linkedin.com/in/'));
    if (invalidUrls.length > 0) {
      throw new Error(`Invalid LinkedIn URL format: ${invalidUrls.join(', ')}`);
    }

    // Check user's daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count: dailyCount, error: countError } = await supabaseDb
      .from('linkedin_outreach_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'sent')
      .gte('sent_at', today.toISOString());

    if (countError) {
      throw new Error(`Failed to check daily limit: ${countError.message}`);
    }

    const DAILY_LIMIT = 10;
    const remainingRequests = DAILY_LIMIT - (dailyCount || 0);
    
    if (linkedin_urls.length > remainingRequests) {
      throw new Error(`Cannot queue ${linkedin_urls.length} requests. Daily limit allows ${remainingRequests} more requests today.`);
    }

    // Calculate total credits needed
    const creditCostPerRequest = 20;
    const totalCreditsNeeded = linkedin_urls.length * creditCostPerRequest;

    // Check user credits
    const { data: userCredits, error: creditsError } = await supabaseDb
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single();

    if (creditsError) {
      throw new Error(`Failed to check user credits: ${creditsError.message}`);
    }

    if (!userCredits || userCredits.credits < totalCreditsNeeded) {
      throw new Error(`Insufficient credits. Need ${totalCreditsNeeded} credits, have ${userCredits?.credits || 0}`);
    }

    // Check for duplicate URLs
    const { data: existingRequests, error: duplicateError } = await supabaseDb
      .from('linkedin_outreach_queue')
      .select('linkedin_url')
      .eq('user_id', userId)
      .in('linkedin_url', linkedin_urls)
      .neq('status', 'failed');

    if (duplicateError) {
      throw new Error(`Failed to check for duplicates: ${duplicateError.message}`);
    }

    const duplicateUrls = existingRequests?.map(req => req.linkedin_url) || [];
    if (duplicateUrls.length > 0) {
      throw new Error(`LinkedIn requests already exist for: ${duplicateUrls.join(', ')}`);
    }

    // Prepare queue items
    const scheduledDate = scheduled_at ? new Date(scheduled_at) : new Date();
    const queueItems = linkedin_urls.map(url => ({
      user_id: userId,
      linkedin_url: url,
      message: message?.trim() || null,
      scheduled_at: scheduledDate.toISOString(),
      credit_cost: creditCostPerRequest,
    }));

    // Insert queue items
    const { data: insertedItems, error: insertError } = await supabaseDb
      .from('linkedin_outreach_queue')
      .insert(queueItems)
      .select();

    if (insertError) {
      throw new Error(`Failed to queue LinkedIn requests: ${insertError.message}`);
    }

    // Deduct credits
    const { error: updateCreditsError } = await supabaseDb
      .from('users')
      .update({ credits: userCredits.credits - totalCreditsNeeded })
      .eq('id', userId);

    if (updateCreditsError) {
      // Rollback queue items if credit deduction fails
      await supabaseDb
        .from('linkedin_outreach_queue')
        .delete()
        .in('id', insertedItems!.map(item => item.id));
      
      throw new Error(`Failed to deduct credits: ${updateCreditsError.message}`);
    }

    // Log the action
    await supabaseDb
      .from('credit_transactions')
      .insert({
        user_id: userId,
        credits_used: totalCreditsNeeded,
        action: 'linkedin_request',
        details: { urls: linkedin_urls, message: message?.substring(0, 50) }
      });

    return {
      success: true,
      message: `Successfully queued ${linkedin_urls.length} LinkedIn connection request(s)`,
      queued_count: linkedin_urls.length,
      credits_used: totalCreditsNeeded,
      scheduled_at: scheduledDate.toISOString(),
      queue_ids: insertedItems!.map(item => item.id)
    };

  } catch (error) {
    console.error('LinkedIn connect tool error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// -----------------------------------------------------------------------------
// Lead → Candidate Conversion
// -----------------------------------------------------------------------------
export async function convertLeadToCandidate({
  userId,
  leadId
}: {
  userId: string;
  leadId: string;
}) {
  // 1) Fetch the lead (must exist and be owned by user)
  const { data: lead, error: leadError } = await supabaseDb
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (leadError || !lead) {
    throw new Error('Lead not found');
  }

  // Ownership check where possible
  if (lead.user_id && lead.user_id !== userId) {
    throw new Error('Access denied: you do not own this lead');
  }

  // 2) Derive first/last name if only name is present
  let firstName = lead.first_name as string | null;
  let lastName = lead.last_name as string | null;
  if ((!firstName || !lastName) && lead.name) {
    const parts = String(lead.name).trim().split(/\s+/);
    firstName = firstName || parts[0] || '';
    lastName = lastName || parts.slice(1).join(' ') || '';
  }

  // 3) Insert candidate
  const { data: candidate, error: candidateError } = await supabaseDb
    .from('candidates')
    .insert({
      lead_id: lead.id,
      user_id: userId,
      first_name: firstName || '',
      last_name: lastName || '',
      // Some environments require non-null email; fall back to empty string
      email: lead.email || '',
      phone: lead.phone || null,
      avatar_url: (lead as any).avatar_url || null,
      status: 'sourced',
      enrichment_data: {
        ...(lead.enrichment_data || {}),
        current_title: lead.title || null
      },
      resume_url: null,
      notes: null,
      title: lead.title || null,
      linkedin_url: lead.linkedin_url || null
    })
    .select()
    .single();

  if (candidateError) {
    console.error('[convertLeadToCandidate] Insert error:', candidateError);
    throw new Error('Failed to create candidate');
  }

  // 4) Record conversion event (best effort)
  try {
    const { EmailEventService } = await import('../services/emailEventService');
    await EmailEventService.storeEvent({
      user_id: userId,
      campaign_id: (lead as any).campaign_id,
      lead_id: lead.id,
      provider: 'system',
      message_id: `conversion_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      event_type: 'conversion',
      metadata: {
        candidate_id: candidate.id,
        lead_name: `${firstName || ''} ${lastName || ''}`.trim(),
        lead_email: lead.email,
        lead_title: lead.title,
        lead_company: lead.company,
        converted_at: new Date().toISOString()
      }
    });
  } catch (e) {
    // Do not fail conversion if analytics logging fails
  }

  // 5) Delete lead (best effort, but if it fails return candidate anyway)
  try {
    await supabaseDb.from('leads').delete().eq('id', leadId);
  } catch (e) {
    // ignore
  }

  return { success: true, candidate };
}

/**
 * Generate human-readable summary of an event
 */
function generateEventSummary(eventType: string, eventData: any): string {
  if (eventData?._test) {
    return `🧪 Test event for ${eventType}`;
  }

  switch (eventType) {
    case 'lead_created':
      return `Lead created: ${eventData?.first_name} ${eventData?.last_name} at ${eventData?.company}`;
    case 'candidate_hired':
      return `${eventData?.first_name} ${eventData?.last_name} was hired!`;
    case 'candidate_moved_to_stage':
      return `${eventData?.candidate_name} moved to ${eventData?.stage_title}`;
    case 'message_sent':
      return `Message sent: "${eventData?.subject}" to ${eventData?.lead_id}`;
    case 'email_opened':
      return `Email opened by lead ${eventData?.lead_id}`;
    default:
      return `${eventType} event occurred`;
  }
} 