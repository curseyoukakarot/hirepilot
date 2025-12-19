import axios from 'axios';
import { supabase } from '../../lib/supabase';
import { getUserIntegrations } from '../../../utils/userIntegrationsHelper';
import { enrichWithHunter } from '../../../services/hunter/enrichLead';
import { enrichWithSkrapp, enrichCompanyWithSkrapp } from '../../../services/skrapp/enrichLead';
import { getSystemSettingBoolean } from '../../utils/systemSettings';

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
  // Track API key usage for billing/analytics
  api_key_info?: {
    using_personal_key: boolean;          // true = NO credits charged (user's Apollo)
    key_type: 'personal' | 'super_admin'; // personal = free, super_admin = charge credits
  };
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
  let entityType: 'lead' | 'candidate' = 'lead';
  let tableName: 'leads' | 'candidates' = 'leads';
  let record: any = null;
  
  try {
    // Fetch the record: prefer lead; fall back to candidate for candidate view
    {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('user_id', userId)
        .maybeSingle();
      if (!error && data) {
        entityType = 'lead';
        tableName = 'leads';
        record = data;
      }
    }
    if (!record) {
      const { data: cand } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', leadId)
        .eq('user_id', userId)
        .maybeSingle();
      if (cand) {
        entityType = 'candidate';
        tableName = 'candidates';
        record = cand;
      }
    }

    if (!record) {
      const errorMsg = 'Record not found or access denied';
      console.error('[Enrichment] Error fetching record for enrichment');
      return {
        success: false,
        provider: 'none',
        errors: [errorMsg],
        fallbacks_used: []
      };
    }

    // NEW: Prioritized enrichment flow with preference toggle
    // Only proceed with premium providers if required data exists
    if (!record.email && firstName && lastName && company) {
      console.log('[Enrichment] Starting prioritized enrichment flow for lead:', { leadId, firstName, lastName, company });
      
      try {
        // Get user's integrations (Hunter.io and Skrapp.io API keys)
        const integrations = await getUserIntegrations(userId);
        const skrappApolloFallbackEnabled = await getSystemSettingBoolean('skrapp_apollo_fallback_enabled', false);
        
        // Prepare data for enrichment services
        const fullName = `${firstName} ${lastName}`.trim();
        let domain = '';

        // Helper: robust domain derivation from existing enrichment data or heuristics
        function deriveDomain(rec: any, fallbackCompany?: string): string {
          const apolloOrg = rec?.enrichment_data?.apollo?.organization || {};
          const fromApollo = String(apolloOrg.domain || apolloOrg.website_url || '')
            .replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
          if (fromApollo) return fromApollo.toLowerCase();
          const decodoSite = String(rec?.enrichment_data?.decodo?.company_website || rec?.enrichment_data?.decodo?.website || '')
            .replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
          if (decodoSite) return decodoSite.toLowerCase();
          const co = String(fallbackCompany || '').trim();
          if (co.includes('.')) return co.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
          if (co) return `${co.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}.com`;
          return '';
        }

        domain = deriveDomain(record, company);

        const preference = (integrations as any).enrichment_source || 'apollo';
        console.log('[Enrichment] Prepared enrichment data:', { fullName, domain, preference, skrappApolloFallbackEnabled, hasHunterKey: !!(integrations as any).hunter_api_key, hasSkrappKey: !!(integrations as any).skrapp_api_key });

        let emailFoundFrom: 'hunter' | 'skrapp' | null = null;

        if (preference === 'apollo') {
          // Skip premium providers entirely when preference is Apollo
          console.log('[Enrichment] Preference set to Apollo - skipping Hunter/Skrapp');
        } else if (preference === 'skrapp') {
          // Skrapp-first path: Try Skrapp for email + company enrichment, then fallback to Apollo
          if (!skrappApolloFallbackEnabled) {
            console.log('[Enrichment] Skrapp disabled by system setting - skipping Skrapp-first path');
          } else {
          const skrappKey = String((integrations as any).skrapp_api_key || '').trim();
          if (skrappKey && domain) {
            try {
              console.log('[Enrichment] Preference skrapp: Trying Skrapp.io first...');
              const skrappEmail = await enrichWithSkrapp(skrappKey, fullName, domain, company || record?.enrichment_data?.apollo?.organization?.name);
              const companyInfo = await enrichCompanyWithSkrapp(skrappKey, domain).catch(() => null);
              if (skrappEmail) {
                const enrichmentData = {
                  ...(record.enrichment_data || {}),
                  skrapp: {
                    email: skrappEmail,
                    source: 'skrapp.io',
                    enriched_at: new Date().toISOString(),
                    domain: domain,
                    full_name: fullName,
                    company: companyInfo || undefined
                  }
                };
                const update: any = {
                  email: skrappEmail,
                  enrichment_data: enrichmentData,
                  updated_at: new Date().toISOString()
                };
                if (entityType === 'lead') {
                  update.enrichment_source = 'skrapp';
                  update.enriched_at = new Date().toISOString();
                }
                const { error: updErr } = await supabase
                  .from(tableName)
                  .update(update)
                  .eq('id', leadId)
                  .eq('user_id', userId);
                if (!updErr) {
                  emailFoundFrom = 'skrapp';
                  enrichment_source = 'skrapp';
                } else {
                  errors.push('DB update failed after Skrapp enrichment');
                }
              } else {
                console.log('[Enrichment] Skrapp returned no valid email');
              }
            } catch (e: any) {
              console.warn('[Enrichment] Skrapp-first enrichment failed:', e?.message || e);
            }
          } else {
            console.log('[Enrichment] Preference skrapp but no USER Skrapp API key available. Skipping Skrapp.');
          }
          }
        } else if (((integrations as any).hunter_api_key || process.env.HUNTER_API_KEY) && domain) {
          // Legacy/default order when no explicit preference provided: Hunter -> Skrapp -> Apollo
          console.log('[Enrichment] Trying Hunter.io enrichment...');
          try {
            const hunterKey = (integrations as any).hunter_api_key || process.env.HUNTER_API_KEY || '';
            const hunterEmail = await enrichWithHunter(hunterKey, fullName, domain);
            if (hunterEmail) {
              console.log('[Enrichment] Hunter.io found email, updating lead...');
              // Update lead with Hunter.io email
              const enrichmentData = {
                ...(record.enrichment_data || {}),
                hunter: {
                  email: hunterEmail,
                  source: 'hunter.io',
                  enriched_at: new Date().toISOString(),
                  domain: domain,
                  full_name: fullName
                }
              };

              // Build update payload depending on entity type
              const hunterUpdate: any = {
                email: hunterEmail,
                enrichment_data: enrichmentData,
                updated_at: new Date().toISOString()
              };
              if (entityType === 'lead') {
                hunterUpdate.enrichment_source = 'hunter';
                hunterUpdate.enriched_at = new Date().toISOString();
              }

              const { error: updateError } = await supabase
                .from(tableName)
                .update(hunterUpdate)
                .eq('id', leadId)
                .eq('user_id', userId);

              if (updateError) {
                console.error('[Enrichment] Error updating lead with Hunter email:', updateError);
                errors.push('Database update failed after Hunter.io enrichment');
                // Continue to fallback even if DB update failed
              } else {
                console.log('[Enrichment] Successfully enriched with Hunter.io');
                emailFoundFrom = 'hunter';
                enrichment_source = 'hunter';
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

        // Try Skrapp.io if Hunter.io failed and Skrapp API key is available (legacy/default path)
        const skrappKeyDefault = String((integrations as any).skrapp_api_key || '').trim();
        if (skrappApolloFallbackEnabled && preference !== 'apollo' && skrappKeyDefault && domain) {
          console.log('[Enrichment] Trying Skrapp.io enrichment...');
          try {
            const skrappEmail = await enrichWithSkrapp(skrappKeyDefault, fullName, domain, company || record?.enrichment_data?.apollo?.organization?.name);
            if (skrappEmail) {
              console.log('[Enrichment] Skrapp.io found email, updating lead...');
              // Update lead with Skrapp.io email
              const enrichmentData = {
                ...(record.enrichment_data || {}),
                skrapp: {
                  email: skrappEmail,
                  source: 'skrapp.io',
                  enriched_at: new Date().toISOString(),
                  domain: domain,
                  full_name: fullName
                }
              };

              const skrappUpdate: any = {
                email: skrappEmail,
                enrichment_data: enrichmentData,
                updated_at: new Date().toISOString()
              };
              if (entityType === 'lead') {
                skrappUpdate.enrichment_source = 'skrapp';
                skrappUpdate.enriched_at = new Date().toISOString();
              }

              const { error: updateError } = await supabase
                .from(tableName)
                .update(skrappUpdate)
                .eq('id', leadId)
                .eq('user_id', userId);

              if (updateError) {
                console.error('[Enrichment] Error updating lead with Skrapp email:', updateError);
                errors.push('Database update failed after Skrapp.io enrichment');
                // Continue to fallback even if DB update failed
              } else {
                console.log('[Enrichment] Successfully enriched with Skrapp.io');
                emailFoundFrom = 'skrapp';
                enrichment_source = 'skrapp';
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
        } else if (skrappApolloFallbackEnabled && integrations.skrapp_api_key && !domain) {
          console.log('[Enrichment] Skrapp.io API key available but no domain extracted from company');
          errors.push('Skrapp.io skipped: no valid domain found');
        }

        if (preference !== 'apollo') {
          console.log('[Enrichment] Premium providers did not find email, falling back to Apollo...');
          fallbacks_used.push('premium_providers -> apollo');
        }
      } catch (integrationsError: any) {
        console.warn('[Enrichment] Error fetching user integrations, falling back to Apollo:', integrationsError);
        errors.push(`Integration access error: ${integrationsError.message || 'Unknown error'}`);
        fallbacks_used.push('integrations_error -> apollo');
      }
    } else {
      console.log('[Enrichment] Lead already has email or missing required data, proceeding with Apollo enrichment...');
      if (record.email) {
        errors.push('Lead already has email - enriching profile data only');
      } else {
        errors.push('Missing required data for premium enrichment (name/company)');
      }
    }

    // APOLLO ENRICHMENT: proceed always for profile data; keep enrichment_source as the premium provider if email already found
    console.log('[Enrichment] Starting Apollo enrichment...');
    if (!enrichment_source || enrichment_source === 'none') {
      enrichment_source = 'apollo';
    }

    // Get Apollo API key - prioritize user's personal key (no credits charged)
    let apolloApiKey: string | undefined;
    let usingPersonalKey = false;
    
    // 1. First priority: Use user's personal Apollo API key (NO CREDITS CHARGED - their own Apollo account)
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('apollo_api_key')
      .eq('user_id', userId)
      .single();

    if (!settingsError && settings?.apollo_api_key) {
      apolloApiKey = settings.apollo_api_key;
      usingPersonalKey = true;
      console.log('[Apollo] Using personal Apollo API key - NO CREDITS CHARGED (user\'s own account)');
    } else {
      // 2. Fallback: Use super admin key (CREDITS CHARGED - platform's Apollo account)
      if (process.env.SUPER_ADMIN_APOLLO_API_KEY) {
        apolloApiKey = process.env.SUPER_ADMIN_APOLLO_API_KEY;
        console.log('[Apollo] Using SUPER_ADMIN_APOLLO_API_KEY - CREDITS WILL BE CHARGED (platform account)');
      } else {
        const errorMsg = 'No Apollo API key available - enrichment cannot proceed';
        console.error('[Enrichment] No Apollo API key found (personal or super admin)');
        errors.push(errorMsg);
        return {
          success: false,
          provider: 'none',
          errors,
          fallbacks_used
        };
      }
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

    console.log('[Apollo] Search parameters:', {
      originalName: `${firstName} ${lastName}`,
      cleanedName: `${searchParams.first_name} ${searchParams.last_name}`,
      company, linkedinUrl,
      searchParams,
      apiKeyLocation: 'header'
    });

    // Use Apollo's Match API for enrichment (not search)
    let response;
    // Prepare match parameters for enrichment API
    const matchParams: any = {
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

    const callApolloMatch = async (apiKey?: string) => {
      return axios.post('https://api.apollo.io/api/v1/people/match', matchParams, {
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey || ''
        },
        timeout: 10000 // 10 second timeout
      });
    };

    const handleApolloFailure = () => {
      return {
        success: false,
        provider: 'none' as const,
        errors,
        fallbacks_used
      };
    };

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await callApolloMatch(apolloApiKey);
        break;
      } catch (apolloApiError: any) {
        const statusCode = apolloApiError?.response?.status;
        const errorCode = apolloApiError?.response?.data?.error_code;
        const canFallbackToSuperAdmin =
          attempt === 0 &&
          usingPersonalKey &&
          statusCode === 403 &&
          errorCode === 'API_INACCESSIBLE' &&
          !!process.env.SUPER_ADMIN_APOLLO_API_KEY;

        if (canFallbackToSuperAdmin) {
          console.warn('[Apollo] Personal API key lacks Match API access; retrying with SUPER_ADMIN_APOLLO_API_KEY');
          apolloApiKey = process.env.SUPER_ADMIN_APOLLO_API_KEY;
          usingPersonalKey = false;
          continue;
        }

        console.error('[Apollo] Match API request failed:', apolloApiError);
        errors.push(`Apollo API error: ${apolloApiError.message || 'Service unavailable'}`);
        return handleApolloFailure();
      }
    }

    if (!response) {
      const fallbackError = 'Apollo Match API could not be reached after retries';
      console.error('[Apollo] Match API request failed:', fallbackError);
      errors.push(fallbackError);
      return handleApolloFailure();
    }

    console.log('[Apollo] Match API Response:', {
      status: response.status,
      personFound: !!response.data?.person,
      personName: response.data?.person ? 
        `${response.data.person.first_name} ${response.data.person.last_name}` : 'None',
      hasEmail: !!response.data?.person?.email,
      hasPhone: !!response.data?.person?.phone_numbers?.length
    });

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
    
    // Only add email if we found a valid one and record doesn't already have one
    if (person.email && !person.email.startsWith('email_not_unlocked') && !record.email) {
      updateData.email = person.email;
    }
    
    // Only add phone if we found one and lead doesn't already have one
    // Apollo Match API returns phone numbers in phone_numbers array
    const phoneNumber = person.phone_numbers?.[0]?.sanitized_number || person.phone;
    if (phoneNumber && !record.phone) {
      updateData.phone = phoneNumber;
    }
    
    // Update LinkedIn URL if Apollo found one and it's different from the current one
    // This ensures the main linkedin_url field is updated with the enriched LinkedIn URL
    if (person.linkedin_url && person.linkedin_url !== record.linkedin_url) {
      updateData.linkedin_url = person.linkedin_url;
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
      linkedin_url: person.linkedin_url, // Store the enriched LinkedIn URL
      // Store Apollo's suggestions without overwriting original data
      apollo_suggested_name: `${person.first_name} ${person.last_name}`,
      apollo_suggested_title: person.title,
      apollo_suggested_company: person.organization?.name,
      // Indicate if Apollo was used as fallback after other providers
      used_as_fallback: !!(record.enrichment_data?.hunter || record.enrichment_data?.skrapp),
      enriched_at: new Date().toISOString()
    };

    updateData.enrichment_data = {
      ...(record.enrichment_data || {}),
      apollo: apolloEnrichmentData
    };
    
    if (entityType === 'lead') {
      updateData.enrichment_source = enrichment_source;
      updateData.enriched_at = new Date().toISOString();
    }
    
    let { error: updateError } = await supabase
      .from(tableName)
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
          .from(tableName)
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

    // Post-Apollo: if no email yet and we now have a solid domain, try Skrapp one more time to get a Valid email
    try {
      const skrappApolloFallbackEnabled = await getSystemSettingBoolean('skrapp_apollo_fallback_enabled', false);
      if (!skrappApolloFallbackEnabled) {
        // Disabled platform-wide unless enabled by Super Admin.
        return {
          success: true,
          provider: 'apollo',
          data: person,
          errors: errors.length > 0 ? errors : undefined,
          fallbacks_used: fallbacks_used.length > 0 ? fallbacks_used : undefined,
          api_key_info: {
            using_personal_key: usingPersonalKey,
            key_type: usingPersonalKey ? 'personal' : 'super_admin'
          }
        };
      }
      const haveEmail = !!(updateData.email || record.email);
      const apolloDomain = String(person?.organization?.domain || person?.organization?.website_url || '').replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0];
      const fallbackDomain = (() => {
        const co = String(company || person?.organization?.name || '').trim();
        if (co.includes('.')) return co.toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0];
        if (co) return `${co.toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9]/g,'')}.com`;
        return '';
      })();
      const finalDomain = apolloDomain || fallbackDomain;
      const skrappKeyAfter = String((await getUserIntegrations(userId)).skrapp_api_key || '').trim();
      if (!haveEmail && skrappKeyAfter && finalDomain) {
        const postFullName = `${firstName || ''} ${lastName || ''}`.trim();
        console.log('[Enrichment] Post-Apollo: retrying Skrapp with Apollo domain:', finalDomain);
        const postEmail = await enrichWithSkrapp(skrappKeyAfter, postFullName, finalDomain, person?.organization?.name || company);
        if (postEmail) {
          const postData: any = {
            email: postEmail,
            enrichment_data: {
              ...(updateData.enrichment_data || record.enrichment_data || {}),
              skrapp: {
                email: postEmail,
                source: 'skrapp.io',
                enriched_at: new Date().toISOString(),
                domain: finalDomain,
                full_name: postFullName
              }
            },
            updated_at: new Date().toISOString()
          };
          await supabase.from(tableName).update(postData).eq('id', leadId).eq('user_id', userId);
          return {
            success: true,
            provider: 'skrapp',
            data: { ...person, email: postEmail },
            errors: errors.length ? errors : undefined,
            fallbacks_used
          };
        }
      }
    } catch (e: any) {
      console.warn('[Enrichment] Post-Apollo Skrapp retry failed:', e?.message || e);
    }

    return {
      success: true,
      provider: 'apollo',
      data: person,
      errors: errors.length > 0 ? errors : undefined,
      fallbacks_used: fallbacks_used.length > 0 ? fallbacks_used : undefined,
      // Track API key usage for billing/analytics
      api_key_info: {
        using_personal_key: usingPersonalKey,  // true = NO credits, false = CHARGE credits
        key_type: usingPersonalKey ? 'personal' : 'super_admin'
      }
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