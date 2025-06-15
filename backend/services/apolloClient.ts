import { enrichBatch } from '../utils/apolloApi';
import { EnrichedPerson } from '../types/apollo';
import { supabaseDb } from '../lib/supabase';

export interface ApolloClient {
  apiKey: string;
  enrichLead: (lead: { id: string }) => Promise<EnrichedPerson>;
}

/**
 * DefaultApolloClient implements ApolloClient for Apollo enrichment.
 * All logic and configuration is preserved exactly as before.
 */
export class DefaultApolloClient implements ApolloClient {
  public apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Enrich a lead by ID using Apollo API.
   * @param lead - The lead object with an id property.
   * @returns EnrichedPerson
   */
  async enrichLead(lead: { id: string }): Promise<EnrichedPerson> {
    if (!lead.id) {
      return {
        id: lead.id,
        email: null,
        email_status: 'unknown',
        first_name: '',
        last_name: '',
        title: '',
        linkedin_url: null,
        city: '',
        state: '',
        country: ''
      };
    }

    const enrichedLeads = await enrichBatch(this.apiKey, [lead.id]);
    const enrichedLead = enrichedLeads[0];

    if (!enrichedLead) {
      return {
        id: lead.id,
        email: null,
        email_status: 'unknown',
        first_name: '',
        last_name: '',
        title: '',
        linkedin_url: null,
        city: '',
        state: '',
        country: ''
      };
    }

    // Normalize organization property to match EnrichedPerson type
    let normalizedOrganization = undefined;
    if (enrichedLead.organization) {
      normalizedOrganization = {
        id: (enrichedLead.organization as any).id || '',
        name: enrichedLead.organization.name || '',
        website_url: enrichedLead.organization.website_url || undefined,
        estimated_annual_revenue: (enrichedLead.organization as any).estimated_annual_revenue || undefined,
        headquarters_location: (enrichedLead.organization as any).headquarters_location || undefined,
        founded_year: (enrichedLead.organization as any).founded_year || undefined,
        estimated_num_employees: (enrichedLead.organization as any).estimated_num_employees || undefined,
        industry: (enrichedLead.organization as any).industry || undefined
      };
    }

    return {
      ...enrichedLead,
      linkedin_url: enrichedLead.linkedin_url ?? null,
      city: enrichedLead.city ?? '',
      state: enrichedLead.state ?? '',
      country: enrichedLead.country ?? '',
      organization: normalizedOrganization
    };
  }
} 