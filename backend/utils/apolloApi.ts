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

// Helper function to expand job title variants for ALL titles
function expandTitleVariants(title: string): string[] {
  const baseTitle = title.toLowerCase().trim();
  const variants = [baseTitle];
  
  // Generic patterns that work for ANY title
  const words = baseTitle.split(/\s+/);
  
  // Add variations without common words
  const commonWords = ['of', 'the', 'and', '&', 'at'];
  const filteredWords = words.filter(word => !commonWords.includes(word));
  if (filteredWords.length !== words.length) {
    variants.push(filteredWords.join(' '));
  }
  
  // Add variations with/without senior/jr prefixes
  if (baseTitle.includes('senior') || baseTitle.includes('sr')) {
    const withoutSenior = baseTitle.replace(/\b(senior|sr\.?)\s+/gi, '').trim();
    if (withoutSenior !== baseTitle) variants.push(withoutSenior);
  } else {
    variants.push(`senior ${baseTitle}`);
    variants.push(`sr ${baseTitle}`);
  }
  
  if (baseTitle.includes('junior') || baseTitle.includes('jr')) {
    const withoutJunior = baseTitle.replace(/\b(junior|jr\.?)\s+/gi, '').trim();
    if (withoutJunior !== baseTitle) variants.push(withoutJunior);
  }
  
  // Specific role-based expansions
  if (baseTitle.includes('director')) {
    const dept = words.filter(w => w !== 'director' && w !== 'of').join(' ').trim();
    if (dept) variants.push(`head of ${dept}`);
  }
  
  if (baseTitle.includes('manager')) {
    const department = words.filter(w => w !== 'manager').join(' ');
    if (department) {
      variants.push(`${department} lead`);
      variants.push(`lead ${department}`);
    }
  }
  
  if (baseTitle.includes('engineer')) {
    const specialty = words.filter(w => w !== 'engineer').join(' ');
    if (specialty) {
      variants.push(`${specialty} developer`);
      variants.push(`${specialty} dev`);
    }
    variants.push(baseTitle.replace('engineer', 'developer'));
  }

  // Senior leadership expansions respecting department in the title
  if (baseTitle.includes('vp') || baseTitle.includes('vice president') || baseTitle.includes('svp') || baseTitle.includes('evp')) {
    const dept = words.filter(w => !['vp','svp','evp','vice','president','of'].includes(w)).join(' ').trim();
    if (dept) {
      variants.push(`vp ${dept}`);
      variants.push(`vice president ${dept}`);
      variants.push(`svp ${dept}`);
      variants.push(`head of ${dept}`);
      variants.push(`${dept} vp`);
      variants.push(`vice president of ${dept}`);
    }
  }
  
  // Remove empty strings and duplicates
  return [...new Set(variants.filter(v => v.trim().length > 0))];
}

// Helper function to normalize location variants  
function normalizeLocationVariants(location: string): string[] {
  const variants: string[] = [];

  // Normalize whitespace and casing
  const raw = location.trim();

  // Handle formats like "Dallas, TX" or "Dallas, Texas"
  if (raw.includes(',')) {
    const parts = raw.split(',').map(p => p.trim()).filter(Boolean);

    // If user provided City, State[, Country] → constrain strictly to that city
    if (parts.length >= 2) {
      const city = parts[0];
      const stateInput = parts[1];
      const countryInput = parts[2] || 'US';

      // Map common state abbreviations
      const stateMap: { [key: string]: string } = {
        FL: 'Florida', CA: 'California', NY: 'New York', TX: 'Texas',
        IL: 'Illinois', WA: 'Washington', MA: 'Massachusetts', GA: 'Georgia',
        PA: 'Pennsylvania', NC: 'North Carolina', CO: 'Colorado', AZ: 'Arizona',
        VA: 'Virginia', MI: 'Michigan', OH: 'Ohio', OR: 'Oregon', MN: 'Minnesota',
      };

      const stateFull = stateMap[stateInput.toUpperCase()] || stateInput;
      const country = countryInput.toUpperCase() === 'UNITED STATES' ? 'US' : countryInput;

      // Only include the city-level variant. Including the state-level variant
      // caused broad matches (e.g., Dallas search returning Houston/Austin).
      variants.push(`${city}, ${stateFull}, ${country}`);

      // Metro aliases for tighter-but-inclusive coverage where Apollo expects them
      const metroAliasMap: Record<string, string> = {
        'Dallas': 'Dallas-Fort Worth',
        'San Francisco': 'San Francisco Bay Area',
        'NYC': 'New York',
        'Los Angeles': 'Los Angeles',
      };
      const alias = metroAliasMap[city];
      if (alias) {
        variants.push(`${alias}, ${stateFull}, ${country}`);
      }
      return variants;
    }
  }

  // Single token: assume state or city; append US by default
  variants.push(`${raw}, US`);
  return variants;
}

export async function searchPeople(params: ApolloSearchParams) {
  try {
    // Check if this is a Boolean search
    const isBooleanSearch = params.person_titles?.[0] && /\b(AND|OR|NOT)\b/i.test(params.person_titles[0]);
    
    if (isBooleanSearch) {
      console.log('[Apollo] Boolean search detected, parsing terms for person_titles array');
      return await handleBooleanSearchCorrectly(params);
    }

    // Regular search logic
    const baseRequest: any = {
      per_page: Math.min(Math.max(params.per_page || 25, 1), 100),
      page: params.page || 1
    };
    const requestBody: any = { ...baseRequest, contact_email_status: 'verified' };

    // Add title variants (multiple for better matching)
    if (params.person_titles && params.person_titles.length > 0) {
      const titleVariants = expandTitleVariants(params.person_titles[0]);
      requestBody.person_titles = titleVariants;
      console.log('[Apollo] Expanding title variants for regular search:', titleVariants.length);
    }
    
    // Add location variants (proper Apollo format)
    if (params.person_locations && params.person_locations.length > 0) {
      const locationVariants = normalizeLocationVariants(params.person_locations[0]);
      requestBody.person_locations = locationVariants;
    }
    
    // Add keywords if provided
    if (params.q_keywords) {
      requestBody.q_keywords = params.q_keywords;
    }

    console.log('[Apollo] Making search request with CORRECT API format:', {
      ...requestBody,
      person_titles_count: requestBody.person_titles?.length || 0,
      person_locations_count: requestBody.person_locations?.length || 0,
      endpoint: 'mixed_people/search'
    });

    let response = await axios.post(`${APOLLO_API_URL}/mixed_people/search`, requestBody, {
      headers: {
        'X-Api-Key': params.api_key,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    // Handle both people and contacts in response
    let people = response.data?.people || [];
    let contacts = response.data?.contacts || [];
    let allResults = [...people, ...contacts];

    // Fallback: if no results with verified filter, retry without it to broaden search
    if (allResults.length === 0) {
      const relaxedBody = { ...baseRequest } as any;
      if (requestBody.person_titles) relaxedBody.person_titles = requestBody.person_titles;
      if (requestBody.person_locations) relaxedBody.person_locations = requestBody.person_locations;
      if (requestBody.q_keywords) relaxedBody.q_keywords = requestBody.q_keywords;

      try {
        const resp2 = await axios.post(`${APOLLO_API_URL}/mixed_people/search`, relaxedBody, {
          headers: {
            'X-Api-Key': params.api_key,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        people = resp2.data?.people || [];
        contacts = resp2.data?.contacts || [];
        allResults = [...people, ...contacts];
        console.log('[Apollo] Relaxed search returned:', allResults.length);
      } catch (e) {
        console.warn('[Apollo] Relaxed search failed:', (e as any).response?.data || (e as any).message);
      }
    }

    console.log('[Apollo] Search response summary:', {
      totalResults: allResults.length,
      peopleCount: people.length,
      contactsCount: contacts.length,
      searchedTitles: params.person_titles,
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

// FIXED: Use Apollo's native person_titles array OR logic (single API call)
async function handleBooleanSearchCorrectly(params: ApolloSearchParams) {
  const booleanQuery = params.person_titles?.[0];
  if (!booleanQuery) return { people: [] };

  console.log('[Apollo] Processing Boolean query with native person_titles array:', booleanQuery);

  // Parse Boolean query to extract individual terms for person_titles array
  const terms = parseBooleanQueryForPersonTitles(booleanQuery);
  console.log('[Apollo] Extracted terms for person_titles array:', terms);

  if (terms.length === 0) {
    console.log('[Apollo] No valid terms extracted from Boolean query');
    return { people: [] };
  }

  // SINGLE API call with person_titles array (Apollo handles OR logic natively)
  const requestBody: any = {
    per_page: Math.min(Math.max(params.per_page || 25, 1), 100),
    page: params.page || 1,
    contact_email_status: 'verified',
    person_titles: terms
  };

  // Add location if specified
  if (params.person_locations && params.person_locations.length > 0) {
    const locationVariants = normalizeLocationVariants(params.person_locations[0]);
    requestBody.person_locations = locationVariants;
  }

  console.log('[Apollo] Making SINGLE Boolean search request:', {
    ...requestBody,
    person_titles_count: requestBody.person_titles.length,
    api_approach: 'native_person_titles_array_OR'
  });

  const response = await axios.post(`${APOLLO_API_URL}/mixed_people/search`, requestBody, {
    headers: {
      'X-Api-Key': params.api_key,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });

  const people = response.data?.people || [];
  const contacts = response.data?.contacts || [];
  const allResults = [...people, ...contacts];

  console.log(`[Apollo] Boolean search complete with SINGLE API call: ${allResults.length} results for ${terms.length} terms`);

  return { people: allResults };
}

// Updated parser: Extract terms for person_titles array (no complex Boolean logic needed)
function parseBooleanQueryForPersonTitles(query: string): string[] {
  console.log('[Apollo] Parsing Boolean query for person_titles array:', query);
  
  const terms: string[] = [];
  
  // Extract quoted phrases (exact titles)
  const quotedMatches = query.match(/"([^"]+)"/g);
  if (quotedMatches) {
    quotedMatches.forEach(match => {
      const term = match.replace(/"/g, '').trim();
      if (term) terms.push(term);
    });
  }
  
  // Extract non-quoted terms (exclude Boolean operators and parentheses)
  const remainingQuery = query.replace(/"[^"]+"/g, ''); // Remove quoted parts
  const words = remainingQuery.split(/\s+/)
    .filter(word => word.trim() && !['AND', 'OR', 'NOT', '(', ')'].includes(word.toUpperCase()))
    .filter(word => word.length > 1);
    
  words.forEach(word => {
    if (!terms.includes(word)) {
      terms.push(word);
    }
  });

  console.log('[Apollo] Final person_titles array terms:', terms);
  return terms.slice(0, 10); // Reasonable limit for person_titles array
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