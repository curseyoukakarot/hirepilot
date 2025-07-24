import express, { Request, Response } from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { supabase } from '../../../lib/supabase';
import { requireAuth } from '../../../../middleware/authMiddleware';
import { ApiRequest } from '../../../../types/api';
import { enrichWithHunter } from '../../../../services/hunter/enrichLead';
import { enrichWithSkrapp } from '../../../../services/skrapp/enrichLead';
import { enrichLead as enrichWithApollo } from '../../../../services/apollo/enrichLead';
import { decryptCookie } from '../../../utils/encryption';
import { getDecodoClient } from '../../../utils/decodo';

const router = express.Router();

// Decodo API configuration
const DECODO_API_URL = 'https://scraper-api.smartproxy.com/v1/tasks';
const DECODO_API_KEY = process.env.DECODO_API_KEY;

// Rate limiting - max 5 enrichments per user per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5;
const userEnrichmentCounts = new Map<string, { count: number; resetTime: number }>();

interface EnrichmentRequest {
  leadId: string;
  profileUrl: string;
}

interface EnrichmentResult {
  source: 'decodo' | 'hunter' | 'skrapp' | 'apollo';
  success: boolean;
  data?: {
    email?: string;
    phone?: string;
    headline?: string;
    summary?: string;
    location?: string;
    experience?: any[];
    education?: any[];
    skills?: string[];
    [key: string]: any;
  };
  error?: string;
  confidence?: number;
}

interface DecodoProfileResponse {
  task_id: string;
  status: string;
  html?: string;
  data?: any;
  error?: string;
}

// Rate limiting middleware
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimits = userEnrichmentCounts.get(userId);

  if (!userLimits || now > userLimits.resetTime) {
    // Reset or initialize rate limit
    userEnrichmentCounts.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return true;
  }

  if (userLimits.count >= RATE_LIMIT_MAX) {
    return false;
  }

  userLimits.count++;
  return true;
}

// Extract domain from company name or email
function extractDomain(company: string, email?: string): string | null {
  if (email && email.includes('@')) {
    return email.split('@')[1];
  }

  if (!company) return null;

  // Convert company name to potential domain
  return company
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .replace(/(inc|corp|llc|ltd|company|co)$/i, '') + '.com';
}

// Parse LinkedIn profile HTML to extract profile data
function parseLinkedInProfile(html: string): any {
  const $ = cheerio.load(html);
  const profileData: any = {};

  try {
    // Extract basic info
    profileData.headline = $('.text-heading-xlarge, .top-card-layout__headline, .pv-text-details__headline').first().text().trim();
    profileData.summary = $('.pv-about__summary-text, .summary .pv-entity__summary-info, .about .pv-shared-text-with-see-more__text').first().text().trim();
    
    // Extract location
    profileData.location = $('.text-body-small.inline.t-black--light.break-words, .pv-text-details__left-panel .geo-region, .location .geo-region').first().text().trim();

    // Extract experience
    const experience: any[] = [];
    $('.artdeco-list__item .pvs-entity, .pv-entity__summary-info').each((index, element) => {
      const $el = $(element);
      const title = $el.find('.t-16.t-black.t-bold, .pv-entity__summary-info-v2 h3').text().trim();
      const company = $el.find('.t-14.t-black--light, .pv-entity__secondary-title').text().trim();
      const duration = $el.find('.t-14.t-black--light.t-normal, .pv-entity__bullet-item').text().trim();
      
      if (title) {
        experience.push({ title, company, duration });
      }
    });
    profileData.experience = experience.slice(0, 5); // Limit to 5 most recent

    // Extract education
    const education: any[] = [];
    $('.education .pvs-entity, .pv-profile-section__card-item').each((index, element) => {
      const $el = $(element);
      const school = $el.find('.t-16.t-black.t-bold, h3').text().trim();
      const degree = $el.find('.t-14.t-black--light, .pv-entity__secondary-title').text().trim();
      
      if (school) {
        education.push({ school, degree });
      }
    });
    profileData.education = education.slice(0, 3); // Limit to 3 most recent

    // Extract skills (if available)
    const skills: string[] = [];
    $('.pvs-skill .t-bold .visually-hidden, .pv-skill-category-entity__name span').each((index, element) => {
      const skill = $(element).text().trim();
      if (skill && skills.length < 10) {
        skills.push(skill);
      }
    });
    profileData.skills = skills;

    // Try to extract contact info (usually not publicly available)
    const contactInfo = $('.contact-info .ci-email, .contact-links .contact-info').text();
    if (contactInfo.includes('@')) {
      const emailMatch = contactInfo.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        profileData.email = emailMatch[1];
      }
    }

    console.log('[parseLinkedInProfile] Extracted profile data:', {
      hasHeadline: !!profileData.headline,
      hasSummary: !!profileData.summary,
      hasLocation: !!profileData.location,
      experienceCount: profileData.experience?.length || 0,
      educationCount: profileData.education?.length || 0,
      skillsCount: profileData.skills?.length || 0,
      hasEmail: !!profileData.email
    });

    return profileData;
  } catch (error) {
    console.error('[parseLinkedInProfile] Error parsing profile:', error);
    return {};
  }
}

/**
 * Retrieve user's LinkedIn cookie for enrichment
 */
async function getUserLinkedInCookie(userId: string): Promise<string | null> {
  try {
    const { data: cookieData, error } = await supabase
      .from('linkedin_cookies')
      .select('encrypted_cookie, valid, expires_at')
      .eq('user_id', userId)
      .eq('valid', true)
      .single();

    if (error || !cookieData) {
      console.log(`[EnrichmentAuth] No valid cookie found for user ${userId}`);
      return null;
    }

    // Check if cookie is expired
    if (cookieData.expires_at) {
      const expiresAt = new Date(cookieData.expires_at);
      if (expiresAt < new Date()) {
        console.log(`[EnrichmentAuth] Cookie expired for user ${userId}`);
        return null;
      }
    }

    // Decrypt and return cookie
    const decryptedCookie = decryptCookie(cookieData.encrypted_cookie);
    
    // Update last_used_at timestamp
    await supabase
      .from('linkedin_cookies')
      .update({ last_used_at: new Date().toISOString() })
      .eq('user_id', userId);

    return decryptedCookie;

  } catch (error: any) {
    console.error('[EnrichmentAuth] Error retrieving cookie:', error.message);
    return null;
  }
}

// STEP 1: Decodo Profile Scraping
async function enrichWithDecodo(profileUrl: string, userId: string): Promise<EnrichmentResult | null> {
  if (!DECODO_API_KEY) {
    return {
      source: 'decodo',
      success: false,
      error: 'DECODO_API_KEY not configured'
    };
  }

  try {
    console.log('[Enrichment] Attempting Decodo profile enrichment');
    
    // Get LinkedIn authentication cookie
    const linkedinCookie = await getUserLinkedInCookie(userId);
    
    const decodoClient = getDecodoClient();
    const html = await decodoClient.scrapeLinkedInProfile(profileUrl, linkedinCookie);
    
    if (!html || html.includes('Sign in to LinkedIn')) {
      if (linkedinCookie) {
        // Cookie might be invalid, mark it
        await supabase
          .from('linkedin_cookies')
          .update({ valid: false })
          .eq('user_id', userId);
        console.warn('[Enrichment] LinkedIn authentication failed, cookie marked as invalid');
      }
      return null;
    }
    
    const profileData = parseLinkedInProfile(html);
    
    if (profileData.headline || profileData.summary || profileData.experience?.length) {
      console.log('[Enrichment] Decodo enrichment successful');
      return {
        success: true,
        source: 'decodo',
        data: profileData
      };
    }
    
    return null;
    
  } catch (error: any) {
    console.error('[Enrichment] Decodo enrichment failed:', error.message);
    return null;
  }
}

// STEP 2: Hunter Email Enrichment
async function enrichWithHunterService(fullName: string, company: string): Promise<EnrichmentResult> {
  try {
    const domain = extractDomain(company);
    if (!domain) {
      return {
        source: 'hunter',
        success: false,
        error: 'Could not determine company domain'
      };
    }

    // Get Hunter API key from environment or user settings
    const hunterApiKey = process.env.HUNTER_API_KEY;
    if (!hunterApiKey) {
      return {
        source: 'hunter',
        success: false,
        error: 'Hunter API key not configured'
      };
    }

    console.log('[enrichWithHunterService] Searching for email:', { fullName, domain });
    
    const email = await enrichWithHunter(hunterApiKey, fullName, domain);
    
    if (email) {
      return {
        source: 'hunter',
        success: true,
        data: { email },
        confidence: 80
      };
    }

    return {
      source: 'hunter',
      success: false,
      error: 'No email found'
    };

  } catch (error: any) {
    return {
      source: 'hunter',
      success: false,
      error: error.message
    };
  }
}

// STEP 3: Skrapp Email Enrichment
async function enrichWithSkrappService(fullName: string, company: string): Promise<EnrichmentResult> {
  try {
    const domain = extractDomain(company);
    if (!domain) {
      return {
        source: 'skrapp',
        success: false,
        error: 'Could not determine company domain'
      };
    }

    // Get Skrapp API key from environment
    const skrappApiKey = process.env.SKRAPP_API_KEY;
    if (!skrappApiKey) {
      return {
        source: 'skrapp',
        success: false,
        error: 'Skrapp API key not configured'
      };
    }

    console.log('[enrichWithSkrappService] Searching for email:', { fullName, domain });
    
    const email = await enrichWithSkrapp(skrappApiKey, fullName, domain);
    
    if (email) {
      return {
        source: 'skrapp',
        success: true,
        data: { email },
        confidence: 75
      };
    }

    return {
      source: 'skrapp',
      success: false,
      error: 'No email found'
    };

  } catch (error: any) {
    return {
      source: 'skrapp',
      success: false,
      error: error.message
    };
  }
}

// STEP 4: Apollo Enrichment (Final Fallback)
async function enrichWithApolloService(leadId: string, userId: string, firstName: string, lastName: string, company: string, linkedinUrl: string): Promise<EnrichmentResult> {
  try {
    console.log('[enrichWithApolloService] Using Apollo as final fallback');
    
    const result = await enrichWithApollo({
      leadId,
      userId,
      firstName,
      lastName,
      company,
      linkedinUrl
    });

    if (result.success && result.data) {
      return {
        source: 'apollo',
        success: true,
        data: {
          email: result.data.email,
          phone: result.data.phone,
          headline: result.data.title,
          location: result.data.location
        },
        confidence: 70
      };
    }

    return {
      source: 'apollo',
      success: false,
      error: 'Apollo enrichment failed'
    };

  } catch (error: any) {
    return {
      source: 'apollo',
      success: false,
      error: error.message
    };
  }
}

// Main enrichment endpoint
router.post('/enrich', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiRequest).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { leadId, profileUrl }: EnrichmentRequest = req.body;

    // Validation
    if (!leadId || !profileUrl) {
      res.status(400).json({ 
        error: 'Missing required fields: leadId and profileUrl are required' 
      });
      return;
    }

    // Validate LinkedIn profile URL
    if (!profileUrl.includes('linkedin.com/in/')) {
      res.status(400).json({ 
        error: 'profileUrl must be a valid LinkedIn profile URL' 
      });
      return;
    }

    // Rate limiting check
    if (!checkRateLimit(userId)) {
      res.status(429).json({ 
        error: 'Rate limit exceeded. Maximum 5 enrichments per minute.' 
      });
      return;
    }

    // Get lead record
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('user_id', userId)
      .single();

    if (leadError || !lead) {
      res.status(404).json({ error: 'Lead not found or access denied' });
      return;
    }

    console.log(`[enrichLeadProfile] Starting enrichment for lead: ${lead.first_name} ${lead.last_name}`);

         // Check if user has enough credits
     try {
       const CreditService = (await import('../../../../services/creditService')).CreditService;
       const hasCredits = await CreditService.hasSufficientCredits(userId, 1);
       if (!hasCredits) {
         res.status(402).json({ 
           error: 'Insufficient credits for enrichment' 
         });
         return;
       }
     } catch (creditError) {
       console.error('[enrichLeadProfile] Credit check failed:', creditError);
       // Continue without credit check if service is unavailable
     }

    let enrichmentResult: EnrichmentResult | null = null;
    const enrichmentLog: string[] = [];

    // STEP 1: Try Decodo Profile Scraping
    console.log('[enrichLeadProfile] Step 1: Trying Decodo profile scraping...');
    enrichmentLog.push('Step 1: Decodo profile scraping');
    
    const decodoResult = await enrichWithDecodo(profileUrl, userId);
    if (decodoResult && decodoResult.success && decodoResult.data) {
      enrichmentResult = decodoResult;
      enrichmentLog.push('✅ Decodo: Success - enrichment complete');
    } else {
      enrichmentLog.push(`❌ Decodo: ${decodoResult?.error || 'Failed'}`);
      
      // STEP 2: Try Hunter if Decodo failed
      const fullName = `${lead.first_name} ${lead.last_name}`.trim();
      if (fullName && lead.company) {
        console.log('[enrichLeadProfile] Step 2: Trying Hunter email enrichment...');
        enrichmentLog.push('Step 2: Hunter email enrichment');
        
        const hunterResult = await enrichWithHunterService(fullName, lead.company);
        if (hunterResult.success && hunterResult.data?.email) {
          enrichmentResult = hunterResult;
          enrichmentLog.push('✅ Hunter: Success - email found');
        } else {
          enrichmentLog.push(`❌ Hunter: ${hunterResult.error || 'Failed'}`);
          
          // STEP 3: Try Skrapp if Hunter failed
          console.log('[enrichLeadProfile] Step 3: Trying Skrapp email enrichment...');
          enrichmentLog.push('Step 3: Skrapp email enrichment');
          
          const skrappResult = await enrichWithSkrappService(fullName, lead.company);
          if (skrappResult.success && skrappResult.data?.email) {
            enrichmentResult = skrappResult;
            enrichmentLog.push('✅ Skrapp: Success - email found');
          } else {
            enrichmentLog.push(`❌ Skrapp: ${skrappResult.error || 'Failed'}`);
            
            // STEP 4: Final fallback to Apollo
            console.log('[enrichLeadProfile] Step 4: Using Apollo as final fallback...');
            enrichmentLog.push('Step 4: Apollo final fallback');
            
            const apolloResult = await enrichWithApolloService(
              leadId, 
              userId, 
              lead.first_name, 
              lead.last_name, 
              lead.company, 
              profileUrl
            );
            
            if (apolloResult.success) {
              enrichmentResult = apolloResult;
              enrichmentLog.push('✅ Apollo: Success - enrichment complete');
            } else {
              enrichmentLog.push(`❌ Apollo: ${apolloResult.error || 'Failed'}`);
            }
          }
        }
      } else {
        enrichmentLog.push('❌ Skipping Hunter/Skrapp: Missing name or company');
      }
    }

    // Update lead with enrichment results
    if (enrichmentResult && enrichmentResult.success) {
      const updateData: any = {
        enriched_at: new Date().toISOString(),
        enrichment_source: enrichmentResult.source,
        updated_at: new Date().toISOString()
      };

      // Add enrichment data to existing enrichment_data
      const existingEnrichment = lead.enrichment_data || {};
      updateData.enrichment_data = {
        ...existingEnrichment,
        [enrichmentResult.source]: {
          ...enrichmentResult.data,
          confidence: enrichmentResult.confidence,
          enriched_at: new Date().toISOString(),
          enrichment_log: enrichmentLog
        }
      };

      // Update specific fields if available
      if (enrichmentResult.data?.email) {
        updateData.email = enrichmentResult.data.email;
      }
      if (enrichmentResult.data?.phone) {
        updateData.phone = enrichmentResult.data.phone;
      }
      if (enrichmentResult.data?.headline) {
        updateData.title = enrichmentResult.data.headline;
      }
      if (enrichmentResult.data?.location) {
        updateData.location = enrichmentResult.data.location;
      }

      // Update lead in database
      const { data: updatedLead, error: updateError } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId)
        .select()
        .single();

      if (updateError) {
        console.error('[enrichLeadProfile] Database update failed:', updateError);
        res.status(500).json({ error: 'Failed to update lead with enriched data' });
        return;
      }

             // Deduct credit for successful enrichment
       try {
         const CreditService = (await import('../../../../services/creditService')).CreditService;
         await CreditService.useCreditsEffective(userId, 1);
         await CreditService.logCreditUsage(
           userId, 
           1, 
           'api_usage', 
           `Lead enrichment via ${enrichmentResult.source}: ${lead.first_name} ${lead.last_name}`
         );
       } catch (creditError) {
         console.error('[enrichLeadProfile] Credit deduction failed:', creditError);
         // Don't fail the request if credit deduction fails
       }

      console.log(`[enrichLeadProfile] Enrichment successful via ${enrichmentResult.source}`);

      res.json({
        success: true,
        lead: updatedLead,
        enrichment: {
          source: enrichmentResult.source,
          confidence: enrichmentResult.confidence,
          data: enrichmentResult.data,
          log: enrichmentLog
        }
      });
    } else {
      // All enrichment methods failed
      console.log('[enrichLeadProfile] All enrichment methods failed');
      
      // Update lead with failed enrichment attempt
      await supabase
        .from('leads')
        .update({
          enrichment_data: {
            ...(lead.enrichment_data || {}),
            last_enrichment_attempt: {
              attempted_at: new Date().toISOString(),
              log: enrichmentLog,
              result: 'failed'
            }
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      res.status(422).json({
        success: false,
        error: 'All enrichment methods failed',
        log: enrichmentLog
      });
    }

  } catch (error: any) {
    console.error('[enrichLeadProfile] Fatal error:', error);
    res.status(500).json({ 
      error: 'Enrichment failed', 
      message: error.message 
    });
  }
});

export default router; 