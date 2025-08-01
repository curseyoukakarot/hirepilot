import axios from 'axios';
import { supabase } from '../../lib/supabase';
import { getUserIntegrations } from '../../../utils/userIntegrationsHelper';
import { enrichWithHunter } from '../../../services/hunter/enrichLead';
import { enrichWithSkrapp } from '../../../services/skrapp/enrichLead';

interface EnrichmentParams {
  leadId: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  linkedinUrl?: string;
}

interface EnrichmentResult {
  success: boolean;
  provider: 'hunter' | 'skrapp' | 'apollo' | 'none';
  data?: any;
  errors?: string[];
  fallbacks_used?: string[];
}

/**
 * Enrich lead with prioritized email discovery and robust error handling
 * 1. Try Hunter.io (if user has API key and role permits)
 * 2. Try Skrapp.io (if user has API key and role permits) 
 * 3. Fallback to Apollo enrichment
 * 
 * Features robust error handling:
 * - Silent fallbacks between providers
 * - Internal error logging without breaking the flow
 * - Enrichment source tracking
 * - Graceful degradation for all failure scenarios
 */

export async function enrichWithApollo({ leadId, userId, firstName, lastName, company, linkedinUrl }: EnrichmentParams): Promise<EnrichmentResult> {
  const errors: string[] = [];
  const fallbacks_used: string[] = [];
  let enrichment_source = 'none';
  
  try {
    // Get the current lead data to preserve original information
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('user_id', userId)
      .single();

    if (leadError || !lead) {
      const errorMsg = 'Lead not found or access denied';
      console.error('[Enrichment] Error fetching lead:', leadError);
      return {
        success: false,
        provider: 'none',
        errors: [errorMsg],
        fallbacks_used: []
      };
    }

    // NEW: Prioritized enrichment flow - try Hunter.io and Skrapp.io first
    // Only proceed if lead doesn't already have an email
    if (!lead.email && firstName && lastName && company) {
      console.log('[Enrichment] Starting prioritized enrichment flow for lead:', { leadId, firstName, lastName, company });
      
      try {
        // Get user's integrations (Hunter.io and Skrapp.io API keys)
        const integrations = await getUserIntegrations(userId);
        
        // Prepare data for enrichment services
        const fullName = `${firstName} ${lastName}`.trim();
        let domain = '';
        
        // Extract domain from company or try to derive it
        if (company) {
          // If company looks like a domain, use it directly
          if (company.includes('.')) {
            domain = company.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
          } else {
            // Try common domain patterns
            domain = `${company.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}.com`;
          }
        }

        console.log('[Enrichment] Prepared enrichment data:', { fullName, domain, hasHunterKey: !!integrations.hunter_api_key, hasSkrappKey: !!integrations.skrapp_api_key });

        // Try Hunter.io first if API key is available
        if (integrations.hunter_api_key && domain) {
          console.log('[Enrichment] Trying Hunter.io enrichment...');
          try {
            const hunterEmail = await enrichWithHunter(integrations.hunter_api_key, fullName, domain);
            if (hunterEmail) {
              console.log('[Enrichment] Hunter.io found email, updating lead...');
              // Update lead with Hunter.io email
              const enrichmentData = {
                ...(lead.enrichment_data || {}),
                hunter: {
                  email: hunterEmail,
                  source: 'hunter.io',
                  enriched_at: new Date().toISOString(),
                  domain: domain,
                  full_name: fullName
                }
              };

              const { error: updateError } = await supabase
                .from('leads')
                .update({
                  email: hunterEmail,
                  enrichment_data: enrichmentData,
                  enrichment_source: 'hunter',
                  enriched_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', leadId)
                .eq('user_id', userId);

              if (updateError) {
                console.error('[Enrichment] Error updating lead with Hunter email:', updateError);
                errors.push('Database update failed after Hunter.io enrichment');
                // Continue to fallback even if DB update failed
              } else {
                console.log('[Enrichment] Successfully enriched with Hunter.io');
                return {
                  success: true,
                  provider: 'hunter',
                  data: { email: hunterEmail, source: 'hunter.io', enrichment_data: enrichmentData },
                  errors: errors.length > 0 ? errors : undefined,
                  fallbacks_used: fallbacks_used.length > 0 ? fallbacks_used : undefined
                };
              }
            } else {
              console.log('[Enrichment] Hunter.io returned no email results');
              errors.push('Hunter.io found no email for this domain/name combination');
            }
          } catch (hunterError: any) {
            console.warn('[Enrichment] Hunter.io enrichment failed:', hunterError);
            errors.push(`Hunter.io error: ${hunterError.message || 'Service unavailable'}`);
            fallbacks_used.push('hunter -> skrapp');
            // Continue to next provider silently
          }
        } else if (integrations.hunter_api_key && !domain) {
          console.log('[Enrichment] Hunter.io API key available but no domain extracted from company');
          errors.push('Hunter.io skipped: no valid domain found');
        }

        // Try Skrapp.io if Hunter.io failed and Skrapp API key is available
        if (integrations.skrapp_api_key && domain) {
          console.log('[Enrichment] Trying Skrapp.io enrichment...');
          try {
            const skrappEmail = await enrichWithSkrapp(integrations.skrapp_api_key, fullName, domain);
            if (skrappEmail) {
              console.log('[Enrichment] Skrapp.io found email, updating lead...');
              // Update lead with Skrapp.io email
              const enrichmentData = {
                ...(lead.enrichment_data || {}),
                skrapp: {
                  email: skrappEmail,
                  source: 'skrapp.io',
                  enriched_at: new Date().toISOString(),
                  domain: domain,
                  full_name: fullName
                }
              };

              const { error: updateError } = await supabase
                .from('leads')
                .update({
                  email: skrappEmail,
                  enrichment_data: enrichmentData,
                  enrichment_source: 'skrapp',
                  enriched_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', leadId)
                .eq('user_id', userId);

              if (updateError) {
                console.error('[Enrichment] Error updating lead with Skrapp email:', updateError);
                errors.push('Database update failed after Skrapp.io enrichment');
                // Continue to fallback even if DB update failed
              } else {
                console.log('[Enrichment] Successfully enriched with Skrapp.io');
                return {
                  success: true,
                  provider: 'skrapp',
                  data: { email: skrappEmail, source: 'skrapp.io', enrichment_data: enrichmentData },
                  errors: errors.length > 0 ? errors : undefined,
                  fallbacks_used: fallbacks_used.length > 0 ? fallbacks_used : undefined
                };
              }
            } else {
              console.log('[Enrichment] Skrapp.io returned no email results');
              errors.push('Skrapp.io found no email for this domain/name combination');
            }
          } catch (skrappError: any) {
            console.warn('[Enrichment] Skrapp.io enrichment failed:', skrappError);
            errors.push(`Skrapp.io error: ${skrappError.message || 'Service unavailable'}`);
            fallbacks_used.push('skrapp -> apollo');
            // Continue to Apollo fallback silently
          }
        } else if (integrations.skrapp_api_key && !domain) {
          console.log('[Enrichment] Skrapp.io API key available but no domain extracted from company');
          errors.push('Skrapp.io skipped: no valid domain found');
        }

        console.log('[Enrichment] Hunter.io and Skrapp.io did not find email, falling back to Apollo...');
        fallbacks_used.push('premium_providers -> apollo');
      } catch (integrationsError: any) {
        console.warn('[Enrichment] Error fetching user integrations, falling back to Apollo:', integrationsError);
        errors.push(`Integration access error: ${integrationsError.message || 'Unknown error'}`);
        fallbacks_used.push('integrations_error -> apollo');
      }
    } else {
      console.log('[Enrichment] Lead already has email or missing required data, proceeding with Apollo enrichment...');
      if (lead.email) {
        errors.push('Lead already has email - enriching profile data only');
      } else {
        errors.push('Missing required data for premium enrichment (name/company)');
      }
    }

    // APOLLO FALLBACK: If Hunter.io and Skrapp.io didn't find email, try Apollo enrichment
    console.log('[Enrichment] Starting Apollo enrichment as fallback...');
    enrichment_source = 'apollo';

    // Get user's Apollo API key
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', userId)
      .single();

    if (settingsError || !settings?.apollo_api_key) {
      const errorMsg = 'Apollo API key not found - enrichment cannot proceed';
      console.error('[Enrichment] Apollo API key error:', settingsError);
      errors.push(errorMsg);
      return {
        success: false,
        provider: 'none',
        errors,
        fallbacks_used
      };
    }

    // Prepare search parameters - clean name fields for better Apollo matching
    const searchParams: any = {};
    if (firstName && lastName) {
      // Clean firstName: remove titles, degrees, etc.
      const cleanFirstName = firstName.trim().replace(/\b(Mr|Mrs|Ms|Dr|PhD|MBA|MD)\.?\b/gi, '').trim();
      
      // Clean lastName: remove degrees, titles, suffixes
      const cleanLastName = lastName.trim()
        .replace(/\b(Jr|Sr|III?|IV|PhD|MBA|MD|Esq)\.?\b/gi, '') // Remove suffixes/degrees
        .replace(/,.*$/, '') // Remove everything after comma (like ", MBA")
        .trim();
      
      // Only use cleaned names if they're not empty
      searchParams.first_name = cleanFirstName || firstName;
      searchParams.last_name = cleanLastName || lastName;
    }
    if (company) {
      searchParams.organization_name = company;
    }
    if (linkedinUrl) {
      searchParams.linkedin_url = linkedinUrl;
    }

    // Add API key to params (Apollo expects it as query param)
    searchParams.api_key = settings.apollo_api_key;

    console.log('[Apollo] Search parameters:', {
      originalName: `${firstName} ${lastName}`,
      cleanedName: `${searchParams.first_name} ${searchParams.last_name}`,
      company, linkedinUrl,
      searchParams: { ...searchParams, api_key: '***' }
    });

    // Use Apollo's Match API for enrichment (not search)
    let response;
    try {
      // Prepare match parameters for enrichment API
      const matchParams: any = {
        api_key: settings.apollo_api_key,
        reveal_personal_emails: true // Key parameter to get email addresses
        // Note: reveal_phone_number requires webhook_url configuration
      };

      // Add available lead information for matching
      if (firstName && lastName) {
        matchParams.first_name = searchParams.first_name;
        matchParams.last_name = searchParams.last_name;
      }
      if (company) {
        matchParams.organization_name = company;
      }
      if (linkedinUrl) {
        matchParams.linkedin_url = linkedinUrl;
      }

      console.log('[Apollo] Using Match API for enrichment:', {
        originalName: `${firstName} ${lastName}`,
        cleanedName: `${matchParams.first_name} ${matchParams.last_name}`,
        company, linkedinUrl,
        endpoint: 'people/match'
      });

      response = await axios.post('https://api.apollo.io/api/v1/people/match', matchParams, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      console.log('[Apollo] Match API Response:', {
        status: response.status,
        personFound: !!response.data?.person,
        personName: response.data?.person ? 
          `${response.data.person.first_name} ${response.data.person.last_name}` : 'None',
        hasEmail: !!response.data?.person?.email,
        hasPhone: !!response.data?.person?.phone_numbers?.length
      });
    } catch (apolloApiError: any) {
      console.error('[Apollo] Match API request failed:', apolloApiError);
      errors.push(`Apollo API error: ${apolloApiError.message || 'Service unavailable'}`);
      return {
        success: false,
        provider: 'none',
        errors,
        fallbacks_used
      };
    }

    if (!response.data?.person) {
      const errorMsg = 'No matching person found in Apollo Match API';
      console.log('[Apollo] No person found for match criteria');
      errors.push(errorMsg);
      return {
        success: false,
        provider: 'none',
        errors,
        fallbacks_used
      };
    }

    const person = response.data.person;

    console.log('[Apollo] Found person:', {
      name: `${person.first_name} ${person.last_name}`,
      email: person.email,
      linkedin: person.linkedin_url,
      searchedFor: `${firstName} ${lastName}`,
      company: person.organization?.name
    });

    // Update lead with enrichment data - ONLY add contact info, preserve original identity
    const updateData: any = {};
    
    // Only add email if we found a valid one and lead doesn't already have one
    if (person.email && !person.email.startsWith('email_not_unlocked') && !lead.email) {
      updateData.email = person.email;
    }
    
    // Only add phone if we found one and lead doesn't already have one
    // Apollo Match API returns phone numbers in phone_numbers array
    const phoneNumber = person.phone_numbers?.[0]?.sanitized_number || person.phone;
    if (phoneNumber && !lead.phone) {
      updateData.phone = phoneNumber;
    }
    
    // Always update enrichment data but preserve original lead identity and any previous Hunter/Skrapp data
    const apolloEnrichmentData = {
      person_id: person.id,
      organization: person.organization,
      location: person.location,
      seniority: person.seniority,
      department: person.department,
      subdepartments: person.subdepartments,
      skills: person.skills,
      // Store Apollo's suggestions without overwriting original data
      apollo_suggested_name: `${person.first_name} ${person.last_name}`,
      apollo_suggested_title: person.title,
      apollo_suggested_company: person.organization?.name,
      // Indicate if Apollo was used as fallback after other providers
      used_as_fallback: !!(lead.enrichment_data?.hunter || lead.enrichment_data?.skrapp),
      enriched_at: new Date().toISOString()
    };

    updateData.enrichment_data = {
      ...(lead.enrichment_data || {}),
      apollo: apolloEnrichmentData
    };
    
    updateData.enrichment_source = enrichment_source;
    updateData.enriched_at = new Date().toISOString();
    
    let { error: updateError } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      errors.push(`Database update failed: ${updateError.message || 'Unknown error'}`);
      
      // Handle duplicate linkedin URL within campaign gracefully
      if (updateError.code === '23505') {
        console.warn('Duplicate linkedin_url within campaign; retrying update without linkedin_url');
        
        // Retry the update without potentially conflicting fields
        const retryUpdateData = {
          ...updateData,
          linkedin_url: undefined // Remove the conflicting field
        };
        
        const { error: secondError } = await supabase
          .from('leads')
          .update(retryUpdateData)
          .eq('id', leadId)
          .eq('user_id', userId);

        if (secondError) {
          console.error('Second update error:', secondError);
          errors.push(`Retry update failed: ${secondError.message}`);
          return {
            success: false,
            provider: 'apollo',
            data: person,
            errors,
            fallbacks_used
          };
        } else {
          console.log('[Enrichment] Successfully updated on retry');
          // Continue to success return below
        }
      } else {
        return {
          success: false,
          provider: 'apollo',
          data: person,
          errors,
          fallbacks_used
        };
      }
    }

    console.log('[Enrichment] Successfully enriched with Apollo');
    return {
      success: true,
      provider: 'apollo',
      data: person,
      errors: errors.length > 0 ? errors : undefined,
      fallbacks_used: fallbacks_used.length > 0 ? fallbacks_used : undefined
    };
  } catch (error: any) {
    console.error('[Enrichment] Unexpected error:', error);
    errors.push(`Unexpected error: ${error.message || 'Unknown error'}`);
    return {
      success: false,
      provider: 'none',
      errors,
      fallbacks_used
    };
  }
}

// Backward compatibility alias - this function now includes prioritized enrichment
export const enrichLead = enrichWithApollo;

/**
 * Simple wrapper for prioritized enrichment with cleaner naming
 * Use this for new code instead of enrichWithApollo
 */
export async function enrichLeadWithPriority(params: EnrichmentParams) {
  return enrichWithApollo(params);
} 