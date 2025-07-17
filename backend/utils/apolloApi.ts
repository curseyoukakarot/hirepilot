import axios from 'axios';

// Simple wait helper function inline instead of importing
const _wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const APOLLO_API_URL = 'https://api.apollo.io/v1';

export interface ApolloSearchParams {
  api_key: string;
  person_titles?: string[];
  person_locations?: string[];
  q_keywords?: string;
  email_statuses?: string[];
  page: number;
  per_page: number;
}

interface ApolloSearchHit {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  title?: string;
  job_title?: string;  // Alternative field name from mixed_people/search
  city?: string;
  state?: string;
  country?: string;
  linkedin_url?: string;
  organization?: {
    name: string;
  };
  company?: {  // Alternative field name from mixed_people/search
    name: string;
  };
}

interface ApolloRecord {
  id: string;
  email: string | null;
  email_status: string;
  first_name: string;
  last_name: string;
  title: string;
  organization?: {
    name: string;
    website_url?: string;
  };
  linkedin_url?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface EnrichedPerson extends ApolloRecord {
  is_gdpr_locked: boolean;
}

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  emailStatus: string;
  title: string;
  company?: string;
  linkedinUrl?: string;
  city: string;
  state: string;
  country: string;
  isGdprLocked: boolean;
}

export async function searchPeople(params: ApolloSearchParams) {
  try {
    // Use the WORKING format from the OAuth implementation
    const searchPayload: any = {
      page: params.page || 1,
      per_page: params.per_page || 100
    };

    // Use simple parameter names that actually work (from OAuth implementation)
    if (params.person_titles && params.person_titles.length > 0) {
      searchPayload.title = params.person_titles[0];  // ✅ Use 'title', not 'person_titles'
    }
    if (params.q_keywords) {
      searchPayload.keywords = params.q_keywords;  // ✅ Keep as 'keywords'
    }
    if (params.person_locations && params.person_locations.length > 0) {
      searchPayload.location = params.person_locations[0];  // ✅ Use 'location', not 'person_locations'
    }

    console.log('[Apollo] Making search request with WORKING OAuth format:', {
      ...searchPayload,
      endpoint: 'mixed_people/search',
      api_key: '***'
    });

    const response = await axios.post(`${APOLLO_API_URL}/mixed_people/search`, searchPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      params: {
        api_key: params.api_key
      }
    });

    // Handle both people and contacts in response
    const people = response.data?.people || [];
    const contacts = response.data?.contacts || [];
    const allResults = [...people, ...contacts];

    if (allResults.length === 0) {
      console.log('[Apollo] No results found in response:', response.data);
      return { people: [] };
    }

    // Debug logging for search results
    console.log('[Apollo] Search response summary:', {
      totalResults: allResults.length,
      peopleCount: people.length,
      contactsCount: contacts.length,
      firstFewTitles: allResults.slice(0, 5).map(p => p.title || p.job_title) || [],
      searchedFor: params.person_titles,
      requestUrl: `${APOLLO_API_URL}/mixed_people/search`
    });

    return { people: allResults };
  } catch (error: any) {
    console.error('[Apollo] Search error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
}

export async function enrichBatch(apiKey: string, ids: string[]): Promise<EnrichedPerson[]> {
  if (!ids.length) return [];

  try {
    // Construct URL with required parameters
    const url = `${APOLLO_API_URL}/people/bulk_match?api_key=${apiKey}&reveal_personal_emails=true`;

    // Construct body with correct field name
    const body = {
      details: ids.map(id => ({ id }))
    };

    console.log('[Apollo] Enriching batch:', { 
      count: ids.length,
      requestUrl: url.replace(apiKey, '***'),
      requestBody: body
    });

    const response = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    // Handle both old (people) and new (matches) response formats
    const records = (response.data.matches ?? response.data.people ?? []) as ApolloRecord[];

    if (records.length === 0) {
      const errorMsg = `[Apollo] 0 matches returned – payload: ${JSON.stringify(response.data)}`;
      console.error(errorMsg);
      throw new Error('[Apollo] 0 matches returned – payload OK but schema unrecognised');
    }

    // Process GDPR-locked contacts
    const enrichedRecords: EnrichedPerson[] = records.map(record => ({
      ...record,
      email: record.email_status === 'gdpr_locked' ? null : record.email,
      is_gdpr_locked: record.email_status === 'gdpr_locked'
    }));

    // Log success details
    console.log('[Apollo] Enrichment succeeded:', {
      batchSize: ids.length,
      enrichedCount: enrichedRecords.length,
      gdprLocked: enrichedRecords.filter(r => r.is_gdpr_locked).length,
      withEmail: enrichedRecords.filter(r => r.email).length
    });

    return enrichedRecords;
  } catch (error: any) {
    // Detailed error logging with actual HTTP status
    console.error('[Apollo] Enrichment error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      ids
    });
    throw error;
  }
}

export async function searchAndEnrichPeople(params: ApolloSearchParams) {
  try {
    // 1. Search using mixed_people/search endpoint
    const searchResponse = await searchPeople(params);
    const searchHits = searchResponse.people as ApolloSearchHit[];
    
    if (searchHits.length === 0) {
      return { leads: [] };
    }

    // 2. Process in batches of 10
    const batches: string[][] = [];
    for (let i = 0; i < searchHits.length; i += 10) {
      batches.push(searchHits.slice(i, i + 10).map((p: ApolloSearchHit) => p.id));
    }

    // 3. Enrich each batch
    const enrichedPeople: EnrichedPerson[] = [];
    console.log(`[Apollo] Processing ${batches.length} batches for enrichment...`);

    for (const [index, batch] of batches.entries()) {
      try {
        console.log(`[Apollo] Processing batch ${index + 1}/${batches.length}`);
        const enriched = await enrichBatch(params.api_key, batch);
        enrichedPeople.push(...enriched);

        // Rate limit between batches
        if (index < batches.length - 1) {
          await _wait(1000);
        }
      } catch (error: any) {
        console.error(`[Apollo] Batch ${index + 1} failed:`, {
          error: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        // Continue with next batch
      }
    }

    // 4. Create enrichment map
    const enrichedMap = new Map(enrichedPeople.map(p => [p.id, p]));

    // 5. Merge search and enrichment data
    const leads: Lead[] = searchHits.map(hit => {
      const enriched = enrichedMap.get(hit.id);
      
      // If no enriched data found, log it
      if (!enriched) {
        console.log(`[Apollo] No enrichment data for lead:`, {
          id: hit.id,
          name: `${hit.first_name} ${hit.last_name}`
        });
      }

      return {
        id: hit.id,
        firstName: enriched?.first_name || hit.first_name,
        lastName: enriched?.last_name || hit.last_name,
        email: enriched?.email || null,  // Explicitly handle undefined case
        emailStatus: enriched?.email_status || 'unknown',
        title: enriched?.title || hit.title || hit.job_title || '',  // Handle both title formats
        company: enriched?.organization?.name || hit.organization?.name || hit.company?.name || '',
        linkedinUrl: enriched?.linkedin_url || hit.linkedin_url,
        city: enriched?.city || hit.city || '',
        state: enriched?.state || hit.state || '',
        country: enriched?.country || hit.country || '',
        isGdprLocked: enriched?.email_status === 'gdpr_locked'
      };
    });

    // Log final results
    console.log('[Apollo] Final results:', {
      totalLeads: leads.length,
      enrichedLeads: enrichedPeople.length,
      gdprLocked: leads.filter((l: Lead) => l.isGdprLocked).length,
      withEmail: leads.filter((l: Lead) => l.email).length
    });

    return { leads };
  } catch (error: any) {
    console.error('[Apollo] Search and enrich error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
  }
} 