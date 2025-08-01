import express, { Request, Response } from 'express';
import { supabase, supabaseDb } from '../../../../lib/supabase';
import { requireAuth } from '../../../../middleware/authMiddleware';
import { ApiRequest } from '../../../../types/api';
import { DecodoClient } from '../../../utils/decodo';
import { parseSalesNavigatorSearchResults } from '../../../utils/cheerio/salesNavParser';
import enrichmentProcessor from '../../../cron/enrichmentProcessor';
import { fetchSalesNavJson } from '../../../../services/linkedin/playwrightFetcher';
// encryption helpers imported dynamically where needed

const router = express.Router();

interface LinkedInTriggerRequest {
  campaignId: string;
  searchUrl: string;
  pagesToScrape?: number;
}

/**
 * Trigger LinkedIn Sales Navigator search using Decodo API
 * POST /api/campaigns/linkedin/trigger
 */
router.post('/trigger', requireAuth, async (req: ApiRequest, res: Response) => {
  try {
    const { campaignId, searchUrl, pagesToScrape = 3 }: LinkedInTriggerRequest = req.body;
    const userId = req.user!.id;

    console.log(`[LinkedInTrigger] Starting Sales Navigator search for campaign ${campaignId}`);

    // Validate required fields
    if (!campaignId || !searchUrl) {
      return res.status(400).json({ 
        error: 'campaignId and searchUrl are required' 
      });
    }

    // Validate search URL
    if (!searchUrl.includes('linkedin.com/sales')) {
      return res.status(400).json({ 
        error: 'Invalid LinkedIn Sales Navigator URL' 
      });
    }

    // Verify campaign exists and belongs to user
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', userId)
      .single();

    if (campaignError || !campaign) {
      console.error('[LinkedInTrigger] Campaign not found:', campaignError);
      return res.status(404).json({ 
        error: 'Campaign not found or access denied' 
      });
    }

    // Use centralized credit service (we will deduct after scraping based on actual leads)
    const { CreditService } = await import('../../../../services/creditService');

    // Basic sanity check: ensure the user has at least one credit before we start.
    const startingBalance = await CreditService.getRemainingCredits(userId);
    if (startingBalance <= 0) {
      return res.status(402).json({
        error: 'Insufficient credits. You currently have 0 credits.'
      });
    }

    // Update campaign status to "running"
    await supabase
      .from('campaigns')
      .update({ 
        status: 'running',
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId);

         // Initialize Decodo client
     const { getDecodoClient } = await import('../../../utils/decodo');
     const decodoClient = getDecodoClient();
    let totalLeads = 0;
    const allLeads: any[] = [];

    // Retrieve user's LinkedIn authentication cookie
    const linkedinCookie = await getUserLinkedInCookie(userId);
    
    if (!linkedinCookie) {
      return res.status(400).json({
        success: false,
        message: 'LinkedIn authentication required. Please connect your LinkedIn account to use Sales Navigator scraping.',
        numLeads: 0
      });
    }

    // Try Playwright JSON fetch if env flag enabled and Playwright is available
    if (process.env.PLAYWRIGHT_SALESNAV === '1' && linkedinCookie) {
      try {
        const decodedUrl = decodeURIComponent(searchUrl);
        console.log('[Playwright] Decoded URL:', decodedUrl);
        
        // Try different patterns for recentSearchId/recentSearchParam
        let recentMatch = decodedUrl.match(/recentSearchId=([0-9]+)/);
        if (!recentMatch) {
          recentMatch = decodedUrl.match(/recentSearchParam:\(id:([0-9]+)/);
        }
        
        const sessionMatch = decodedUrl.match(/sessionId[=:]([A-Za-z0-9%=]+)/);
        const searchId = recentMatch ? recentMatch[1] : '';
        const sessionId = sessionMatch ? sessionMatch[1] : '';
        
        // Extract CSRF token from Railway environment or cookie (keep full ajax:NUMBER format)
        let csrfToken = '';
        if (process.env.FULL_LINKEDIN_COOKIE) {
          const envCsrfMatch = process.env.FULL_LINKEDIN_COOKIE.match(/JSESSIONID="?(ajax:[0-9]+)/);
          csrfToken = envCsrfMatch ? envCsrfMatch[1] : '';
        }
        if (!csrfToken) {
          const cookieCsrfMatch = linkedinCookie.match(/JSESSIONID="?(ajax:[0-9]+)/);
          csrfToken = cookieCsrfMatch ? cookieCsrfMatch[1] : '';
        }
        
        console.log('[Playwright] Extracted params:', { searchId, sessionId, hasCsrfToken: !!csrfToken });

        if (searchId && sessionId && csrfToken) {
          const apiUrl = `https://www.linkedin.com/sales-api/salesApiLeadSearch?q=recentSearchId&start=0&count=25&recentSearchId=${searchId}&trackingParam=(sessionId:${sessionId})&decorationId=com.linkedin.sales.deco.desktop.searchv2.LeadSearchResult-14`;
          console.log('[Playwright] Fetching SalesNav JSON', apiUrl);
          
          // Use fresh cookie from environment if available, otherwise use database cookie
          const cookieToUse = process.env.FULL_LINKEDIN_COOKIE || linkedinCookie;
          console.log('[Playwright] Using cookie source:', process.env.FULL_LINKEDIN_COOKIE ? 'environment' : 'database');
          
          const result = await fetchSalesNavJson({ apiUrl, fullCookie: cookieToUse, csrfToken });
          
          // Handle both successful and error responses
          if (result.status === 200 && result.json?.elements?.length) {
            const jsonLeads = result.json.elements.map((e: any) => ({
              name: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
              title: e.occupation,
              company: e.companyName || (e.company && e.company.name) || '',
              profileUrl: `https://www.linkedin.com/in/${e.publicIdentifier}`,
              location: e.locationName || '',
              image: e.profilePicture?.displayImageReference ?? ''
            }));
            allLeads.push(...jsonLeads);
            totalLeads += jsonLeads.length;
            console.log(`[Playwright] ✅ Extracted ${jsonLeads.length} leads via JSON API`);
          } else if (result.status === 401) {
            console.warn('[Playwright] ❌ LinkedIn session expired (401) - user needs to refresh cookies');
          } else {
            console.warn('[Playwright] ⚠️ SalesNav JSON returned no leads', {
              status: result.status,
              hasData: !!result.json?.data,
              responsePreview: JSON.stringify(result.json).substring(0, 200)
            });
          }
        } else {
          console.warn('[Playwright] ⚠️ Missing required URL parameters:', { searchId, sessionId, csrfToken: !!csrfToken });
        }
      } catch (playErr) {
        console.error('[Playwright] SalesNav JSON fetch failed:', playErr.message);
        console.warn('[Playwright] Falling back to legacy HTML scraping...');
        // Continue to legacy scraping approach below
      }
    }


    try {
      // Scrape each page with LinkedIn authentication
      for (let page = 1; page <= pagesToScrape; page++) {
        console.log(`[LinkedInTrigger] Scraping page ${page}/${pagesToScrape}`);
        
        try {
          // Pass LinkedIn cookie to Decodo client
          const html = await decodoClient.scrapeSalesNavigatorSearch(searchUrl, page, linkedinCookie);
          
          // Parse the HTML to extract leads
          const pageLeads = parseSalesNavigatorSearchResults(html);
          
          if (pageLeads.length === 0) {
            console.log(`[LinkedInTrigger] No leads found on page ${page}, stopping`);
            break;
          }

          // Transform leads for database insertion
          const transformedLeads = pageLeads.map(lead => ({
            user_id: userId,
            campaign_id: campaignId,
            first_name: lead.name.split(' ')[0] || '',
            last_name: lead.name.split(' ').slice(1).join(' ') || '',
            name: lead.name,
            title: lead.title,
            company: lead.company,
            location: lead.location,
            linkedin_url: lead.profileUrl,
            source: 'sales_navigator',
            status: 'New',
            image_url: lead.image || null,
            enrichment_data: {
              connection_degree: lead.connectionDegree || '',
              scraped_page: page,
              scraped_at: new Date().toISOString()
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));

          allLeads.push(...transformedLeads);
          totalLeads += pageLeads.length;

          console.log(`[LinkedInTrigger] Page ${page}: Found ${pageLeads.length} leads`);

          // Add delay between pages to be respectful
          if (page < pagesToScrape) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

        } catch (pageError: any) {
          console.error(`[LinkedInTrigger] Error scraping page ${page}:`, pageError);
          // Continue with next page instead of failing completely
          continue;
        }
      }

      if (allLeads.length === 0) {
        // Update campaign status to failed
        await supabase
          .from('campaigns')
          .update({ 
            status: 'failed',
            error_message: 'No leads found in Sales Navigator search',
            updated_at: new Date().toISOString()
          })
          .eq('id', campaignId);

        return res.status(400).json({ 
          error: 'No leads found in the Sales Navigator search results' 
        });
      }

      // Insert leads into database (handle duplicates)
      const { data: insertedLeads, error: insertError } = await supabase
        .from('leads')
        .upsert(allLeads, { 
          onConflict: 'linkedin_url,campaign_id',
          ignoreDuplicates: true 
        })
        .select('id, linkedin_url');

      if (insertError) {
        console.error('[LinkedInTrigger] Error inserting leads:', insertError);
        throw new Error(`Failed to save leads: ${insertError.message}`);
      }

      const actualInserted = insertedLeads?.length || 0;
      console.log(`[LinkedInTrigger] Successfully inserted ${actualInserted} unique leads`);

      // Calculate credits to deduct based on unique leads inserted (1 credit per lead)
      const creditsToDeduct = actualInserted;

      const hasCreditsAfterScrape = await CreditService.hasSufficientCredits(userId, creditsToDeduct);
      if (!hasCreditsAfterScrape) {
        return res.status(402).json({
          error: `Insufficient credits. You need ${creditsToDeduct} scraping credits but have less than that.`
        });
      }

      // Deduct credits per lead
      await CreditService.useCreditsEffective(userId, creditsToDeduct);
      await CreditService.logCreditUsage(
        userId,
        creditsToDeduct,
        'campaign_creation',
        `Sales Navigator scraping for campaign ${campaignId}`
      );

      // Update campaign status and stats
      await supabase
        .from('campaigns')
        .update({ 
          status: 'completed',
          total_leads: actualInserted,
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      // Queue enrichment jobs for leads with profile URLs
      const leadsToEnrich = insertedLeads?.filter(lead => lead.linkedin_url) || [];
      
      if (leadsToEnrich.length > 0) {
        console.log(`[LinkedInTrigger] Queueing ${leadsToEnrich.length} leads for enrichment`);
        
                 for (const lead of leadsToEnrich) {
           try {
             // Import the EnrichmentProcessor class and use the static method
             const { EnrichmentProcessor } = await import('../../../cron/enrichmentProcessor');
             await (EnrichmentProcessor as any).queueJob(
               lead.id,
               userId,
               lead.linkedin_url,
               5 // Normal priority
             );
           } catch (enrichError) {
             console.error(`[LinkedInTrigger] Failed to queue enrichment for lead ${lead.id}:`, enrichError);
           }
         }
      }

      console.log(`[LinkedInTrigger] Successfully completed Sales Navigator scraping for campaign ${campaignId}`);

      res.json({
        success: true,
        message: `Successfully scraped ${actualInserted} leads from Sales Navigator`,
        data: {
          campaignId,
          totalLeads: actualInserted,
          pagesScraped: pagesToScrape,
          creditsUsed: creditsToDeduct,
          remainingCredits: await CreditService.getRemainingCredits(userId),
          enrichmentJobsQueued: leadsToEnrich.length
        }
      });

    } catch (scrapingError: any) {
      console.error('[LinkedInTrigger] Scraping failed:', scrapingError);
      
      // Update campaign status to failed
      await supabase
        .from('campaigns')
        .update({ 
          status: 'failed',
          error_message: scrapingError.message || 'Sales Navigator scraping failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      res.status(500).json({ 
        error: 'Sales Navigator scraping failed',
        details: scrapingError.message 
      });
    }

  } catch (error: any) {
    console.error('[LinkedInTrigger] Unexpected error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

/**
 * Retrieve user's LinkedIn cookie for authentication
 */
async function getUserLinkedInCookie(userId: string): Promise<string | null> {
  try {
    const { data: cookieData, error } = await supabaseDb
      .from('linkedin_cookies')
      .select('session_cookie, is_valid, status, expires_at')
      .eq('user_id', userId)
      .single();

    if (error || !cookieData) {
      console.warn('[LinkedInAuth] Cookie query result', { error, cookieData });
      console.log(`[LinkedInAuth] No valid cookie found for user ${userId}`);
      return null;
    }

    // Ensure cookie marked valid
    if (cookieData.is_valid === false || (cookieData.status && cookieData.status !== 'valid')) {
      console.log(`[LinkedInAuth] Cookie marked invalid for user ${userId}`);
      return null;
    }

    // Check if cookie is expired
    if (cookieData.expires_at) {
      const expiresAt = new Date(cookieData.expires_at);
      if (expiresAt < new Date()) {
        console.log(`[LinkedInAuth] Cookie expired for user ${userId}`);
        // Mark as invalid
        await supabaseDb
          .from('linkedin_cookies')
          .update({ valid: false })
          .eq('user_id', userId);
        return null;
      }
    }

    let plaintextCookie: string | null = null;

    // Fallback for legacy unencrypted storage
    if (!plaintextCookie && cookieData.session_cookie) {
      try {
        // Try decrypting legacy AES cookie first
        const { decryptLegacyAesCookie } = await import('../../../utils/encryption');
        plaintextCookie = decryptLegacyAesCookie(cookieData.session_cookie);
        console.log('[LinkedInAuth] Decrypted legacy session_cookie');
      } catch (legacyErr) {
        console.warn('[LinkedInAuth] Unable to decrypt legacy session_cookie, using as-is');
        plaintextCookie = cookieData.session_cookie;
      }
    }

    if (!plaintextCookie) {
      console.error('[LinkedInAuth] Unable to retrieve a usable cookie record');
      return null;
    }
    
    // Update last_used_at timestamp
    await supabaseDb
      .from('linkedin_cookies')
      .update({ last_used_at: new Date().toISOString() })
      .eq('user_id', userId);

    console.log(`[LinkedInAuth] Retrieved valid cookie for user ${userId}`);
    return plaintextCookie;

  } catch (error: any) {
    console.error('[LinkedInAuth] Error retrieving cookie:', error.message);
    return null;
  }
}

export default router; 